import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { getServerConfig } from "@/config";
import { getGuestNames } from "./guests";
import { getStorage } from "./storage";
import type { Photo } from "./types";
import { fileSafeName, parsePhotoFile, parseVideoFile } from "./validation";

export type MediaSize = "full" | "thumb" | "video";

function mediaKey(code: string, size: MediaSize, file: string) {
  return `${code}/${size}/${file}`;
}

/** A video's poster lives in thumb/ under the video's name, with a .jpg extension. */
function posterName(videoFile: string) {
  return videoFile.replace(/\.[a-z0-9]+$/, ".jpg");
}

/** Starts with the guest's name, so the NAS folder shows whose file is whose. */
async function newFileBase(code: string, guestId: string) {
  const names = await getGuestNames(code, [guestId]);
  return `${fileSafeName(names.get(guestId))}__${guestId}__${Date.now()}_${randomBytes(6).toString("hex")}`;
}

async function listPhotoFiles(code: string) {
  const names = await getStorage().list(`${code}/full`);
  return names.flatMap((file) => {
    const parsed = parsePhotoFile(file);
    return parsed ? [{ file, ...parsed }] : [];
  });
}

async function listVideoFiles(code: string) {
  const names = await getStorage().list(`${code}/video`);
  return names.flatMap((file) => {
    const parsed = parseVideoFile(file);
    return parsed ? [{ file, ...parsed }] : [];
  });
}

export async function countGuestPhotos(code: string, guestId: string) {
  const files = await listPhotoFiles(code);
  return files.filter((photo) => photo.guestId === guestId).length;
}

export async function countGuestVideos(code: string, guestId: string) {
  const files = await listVideoFiles(code);
  return files.filter((video) => video.guestId === guestId).length;
}

/** Photos and videos together, newest first. */
export async function listMedia(code: string): Promise<Photo[]> {
  const [photos, videos] = await Promise.all([listPhotoFiles(code), listVideoFiles(code)]);
  const names = await getGuestNames(code, [...photos, ...videos].map((item) => item.guestId));

  const items = [
    ...photos.map(({ file, guestId, timestamp }) => ({
      id: file,
      kind: "photo" as const,
      timestamp,
      guestId,
      thumb: file,
      fullUrl: `/api/photo/${code}/full/${file}`,
    })),
    ...videos.map(({ file, guestId, timestamp }) => ({
      id: file,
      kind: "video" as const,
      timestamp,
      guestId,
      thumb: posterName(file),
      fullUrl: `/api/photo/${code}/video/${file}`,
    })),
  ];

  return items
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      taken_by: names.get(item.guestId) ?? null,
      taken_at: new Date(item.timestamp).toISOString(),
      thumb_url: `/api/photo/${code}/thumb/${item.thumb}`,
      full_url: item.fullUrl,
    }));
}

export class InvalidMediaError extends Error {}

function makeThumbnail(image: ReturnType<typeof sharp>) {
  const config = getServerConfig();
  return image
    .clone()
    .resize(config.THUMB_MAX_EDGE_PX, config.THUMB_MAX_EDGE_PX, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: config.THUMB_JPEG_QUALITY })
    .toBuffer();
}

/** Opens an image and confirms its real format is allowed, whatever the upload claimed. */
async function openImage(input: Buffer) {
  const image = sharp(input, { failOn: "error" });
  const { format } = await image.metadata();
  if (!getServerConfig().ALLOWED_MIME_TYPES.includes(`image/${format}`)) {
    throw new InvalidMediaError(`Unsupported image format: ${format}`);
  }
  return image.rotate();
}

/** Applies the EXIF rotation, then removes metadata such as GPS, and builds the thumbnail. */
async function processImage(input: Buffer) {
  const config = getServerConfig();
  try {
    const upright = await openImage(input);
    const stored = config.STRIP_EXIF ? upright.clone() : upright.clone().keepMetadata();
    const [full, thumb] = await Promise.all([
      stored.jpeg({ quality: config.STORE_JPEG_QUALITY }).toBuffer(),
      makeThumbnail(upright),
    ]);
    return { full, thumb };
  } catch (error) {
    if (error instanceof InvalidMediaError) throw error;
    throw new InvalidMediaError("The file is not a readable image.");
  }
}

export async function savePhoto(code: string, guestId: string, input: Buffer) {
  const { full, thumb } = await processImage(input);
  const file = `${await newFileBase(code, guestId)}.jpg`;
  // Thumbnail first: the gallery lists full/, so every listed photo has its thumbnail.
  await getStorage().put(mediaKey(code, "thumb", file), thumb);
  await getStorage().put(mediaKey(code, "full", file), full);
  return file;
}

/** Identifies a video by its leading bytes, since the declared type can't be trusted. */
function videoExtension(data: Buffer) {
  if (data.subarray(4, 8).toString("latin1") === "ftyp") return "mp4";
  if (data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "webm";
  return null;
}

export async function saveVideo(code: string, guestId: string, video: Buffer, poster: Buffer) {
  const extension = videoExtension(video);
  if (!extension || !getServerConfig().ALLOWED_VIDEO_MIME_TYPES.includes(`video/${extension}`)) {
    throw new InvalidMediaError("The file is not a supported video.");
  }
  let thumb: Buffer;
  try {
    thumb = await makeThumbnail(await openImage(poster));
  } catch (error) {
    if (error instanceof InvalidMediaError) throw error;
    throw new InvalidMediaError("The video's preview image is not readable.");
  }

  const file = `${await newFileBase(code, guestId)}.${extension}`;
  // Poster first: the gallery lists video/, so every listed video has its poster.
  await getStorage().put(mediaKey(code, "thumb", posterName(file)), thumb);
  await getStorage().put(mediaKey(code, "video", file), video);
  return file;
}

export function readMedia(code: string, size: MediaSize, file: string) {
  return getStorage().get(mediaKey(code, size, file));
}

export async function deleteMedia(code: string, file: string) {
  // The listed file first, so a failure part-way can't leave a listed item with no thumbnail.
  if (parseVideoFile(file)) {
    await getStorage().remove(mediaKey(code, "video", file));
    await getStorage().remove(mediaKey(code, "thumb", posterName(file)));
    return;
  }
  await getStorage().remove(mediaKey(code, "full", file));
  await getStorage().remove(mediaKey(code, "thumb", file));
}
