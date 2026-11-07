import { getServerConfig } from "@/config";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;
type Fields = Record<string, string | number | boolean | null | undefined>;

function settings(): { enabled: boolean; level: Level } {
  try {
    const config = getServerConfig();
    return { enabled: config.LOG_ENABLED, level: config.LOG_LEVEL };
  } catch {
    // Invalid env must not stop us from reporting errors, including that one.
    return { enabled: true, level: "info" };
  }
}

// Filenames start with the guest's name, and paths and storage keys contain filenames.
const NAME_IN_FILENAME = /[A-Za-z0-9-]{1,40}__(?=[0-9a-f]{8}__\d{13}_)/g;

function format(level: Level, message: string, fields: Fields) {
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, typeof value === "string" ? value.replace(NAME_IN_FILENAME, "") : value] as const)
    // JSON encoding keeps each entry on one line, whatever the value contains.
    .map(([key, value]) => `${key}=${typeof value === "string" && /^[\w./:@-]+$/.test(value) ? value : JSON.stringify(value)}`);
  return [new Date().toISOString(), level.toUpperCase().padEnd(5), message, ...parts].join(" ");
}

function write(level: Level, message: string, fields: Fields = {}, error?: unknown) {
  const { enabled, level: minimum } = settings();
  if (!enabled || LEVELS[level] < LEVELS[minimum]) return;
  const line = format(level, message, fields);
  // Only the stack: error objects can carry whole HTTP responses from the NAS client.
  const stack = error instanceof Error ? error.stack : error;
  if (stack === undefined) console[level](line);
  else console[level](line, `\n${String(stack)}`);
}

/** Server-side logging. Never pass secrets, passwords or request headers as fields. */
export const log = {
  debug: (message: string, fields?: Fields) => write("debug", message, fields),
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields, error?: unknown) => write("error", message, fields, error),
};
