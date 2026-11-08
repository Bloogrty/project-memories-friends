import type { ClientConfig } from "@/config";

type ImageOptions = ClientConfig["image"];

// Quality steps used only when a photo is still over the target size.
const QUALITY_STEP = 0.1;
const MIN_QUALITY = 0.4;

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Older Safari: fall back to an <img>, which also applies the EXIF rotation.
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the photo."))),
      "image/jpeg",
      quality,
    );
  });
}

/** Shrinks a camera photo to fit under Vercel's upload limit. */
export async function compressImage(file: File, options: ImageOptions): Promise<Blob> {
  const image = await decode(file);
  const scale = Math.min(1, options.maxEdgePx / Math.max(image.width, image.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the photo.");
  context.fillStyle = "#fff"; // JPEG has no transparency.
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  if ("close" in image) image.close();
  return canvasToJpeg(canvas, options);
}

/** Saves one frame of a live camera preview, at the same size limits as any other photo. */
export function captureFrame(video: HTMLVideoElement, options: ImageOptions): Promise<Blob> {
  const scale = Math.min(1, options.maxEdgePx / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("Could not prepare the photo."));
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvasToJpeg(canvas, options);
}

async function canvasToJpeg(canvas: HTMLCanvasElement, options: ImageOptions) {
  let quality = options.jpegQuality;
  let blob = await toJpeg(canvas, quality);
  while (blob.size > options.targetBytes && quality - QUALITY_STEP >= MIN_QUALITY) {
    quality -= QUALITY_STEP;
    blob = await toJpeg(canvas, quality);
  }

  // Phones free canvas memory sooner when it is shrunk explicitly.
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}
