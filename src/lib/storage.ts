import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type FileStat, type WebDAVClient } from "webdav";
import { getServerConfig } from "@/config";
import { log } from "./logger";

/**
 * All file access goes through this interface, so the backend can be swapped.
 * Keys are relative, forward-slash paths such as `2026-11-07/full/x.jpg`.
 * Callers must validate key parts first (see src/lib/validation.ts).
 */
export interface Storage {
  /** Returns null when the file doesn't exist. */
  get(key: string): Promise<Buffer | null>;
  /** Creates parent folders as needed and overwrites any existing file. */
  put(key: string, data: Buffer): Promise<void>;
  /** Names of the files directly inside a folder. Empty if the folder doesn't exist. */
  list(folder: string): Promise<string[]>;
  /** Does nothing when the file doesn't exist. */
  remove(key: string): Promise<void>;
}

function hasCode(error: unknown, code: string) {
  return (error as NodeJS.ErrnoException)?.code === code;
}

function createLocalStorage(rootDir: string): Storage {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), rootDir);
  const resolve = (key: string) => path.join(/* turbopackIgnore: true */ root, ...key.split("/"));

  return {
    async get(key) {
      try {
        return await readFile(resolve(key));
      } catch (error) {
        if (hasCode(error, "ENOENT")) return null;
        throw error;
      }
    },
    async put(key, data) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
    },
    async list(folder) {
      try {
        const entries = await readdir(resolve(folder), { withFileTypes: true });
        return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
      } catch (error) {
        if (hasCode(error, "ENOENT")) return [];
        throw error;
      }
    },
    async remove(key) {
      await rm(resolve(key), { force: true });
    },
  };
}

function httpStatus(error: unknown) {
  return (error as { status?: number })?.status;
}

function createWebdavStorage(client: WebDAVClient, webdavRoot: string): Storage {
  const root = `/${webdavRoot.replace(/^\/+|\/+$/g, "")}`;
  const resolve = (key: string) => `${root}/${key}`;
  // Skips repeat "does this folder exist?" round-trips to the NAS within one server instance.
  const knownFolders = new Set<string>();

  async function ensureFolder(folder: string) {
    if (knownFolders.has(folder)) return;
    try {
      await client.createDirectory(folder, { recursive: true });
    } catch (error) {
      // 405 means it already exists, e.g. a parallel upload created it first.
      if (httpStatus(error) !== 405) throw error;
    }
    knownFolders.add(folder);
  }

  return {
    async get(key) {
      try {
        return (await client.getFileContents(resolve(key))) as Buffer;
      } catch (error) {
        if (httpStatus(error) === 404) return null;
        throw error;
      }
    },
    async put(key, data) {
      const file = resolve(key);
      await ensureFolder(file.slice(0, file.lastIndexOf("/")));
      await client.putFileContents(file, data, { overwrite: true, contentLength: data.length });
    },
    async list(folder) {
      try {
        const entries = (await client.getDirectoryContents(resolve(folder))) as FileStat[];
        return entries.filter((entry) => entry.type === "file").map((entry) => entry.basename);
      } catch (error) {
        if (httpStatus(error) === 404) return [];
        throw error;
      }
    },
    async remove(key) {
      try {
        await client.deleteFile(resolve(key));
      } catch (error) {
        if (httpStatus(error) !== 404) throw error;
      }
    },
  };
}

/** Times every storage call at debug level, which shows when the NAS is the slow part. */
function withTiming(inner: Storage, driver: string): Storage {
  async function timed<T>(operation: string, key: string, run: () => Promise<T>) {
    const startedAt = Date.now();
    const fields = { driver, key };
    try {
      const result = await run();
      log.debug(`storage ${operation}`, { ...fields, ms: Date.now() - startedAt });
      return result;
    } catch (error) {
      log.debug(`storage ${operation} failed`, { ...fields, ms: Date.now() - startedAt });
      throw error;
    }
  }
  return {
    get: (key) => timed("get", key, () => inner.get(key)),
    put: (key, data) => timed("put", key, () => inner.put(key, data)),
    list: (folder) => timed("list", folder, () => inner.list(folder)),
    remove: (key) => timed("remove", key, () => inner.remove(key)),
  };
}

let storage: Storage | undefined;

export function getStorage(): Storage {
  if (storage) return storage;
  const config = getServerConfig();
  const driver =
    config.STORAGE_DRIVER === "webdav"
      ? createWebdavStorage(
          createClient(config.WEBDAV_URL!, {
            username: config.WEBDAV_USERNAME,
            password: config.WEBDAV_PASSWORD,
          }),
          config.WEBDAV_ROOT,
        )
      : createLocalStorage(config.LOCAL_STORAGE_DIR);
  storage = withTiming(driver, config.STORAGE_DRIVER);
  return storage;
}

export async function readJson<T>(key: string): Promise<T | null> {
  const data = await getStorage().get(key);
  return data ? (JSON.parse(data.toString("utf-8")) as T) : null;
}

export async function writeJson(key: string, value: unknown) {
  await getStorage().put(key, Buffer.from(JSON.stringify(value, null, 2)));
}
