"use client";

import { useEffect, useRef, useState } from "react";
import { useClientConfig } from "@/lib/client-config";
import { captureFrame } from "@/lib/compress";
import { useCamera } from "@/lib/use-camera";

const PHOTO_ASPECT = 4 / 3;
const SHUTTER_VIBRATE_MS = 10;

/** Stays open after every shot, with no confirmation, so guests can keep shooting. */
export function PhotoCamera({
  counter,
  uploading,
  canShoot,
  onCapture,
  onClose,
  onUsePhoneCamera,
}: {
  counter: string;
  uploading: number;
  canShoot: boolean;
  onCapture: (photo: Blob) => void;
  onClose: () => void;
  onUsePhoneCamera: () => void;
}) {
  const config = useClientConfig();
  const { preview, ready, failed, flip } = useCamera({
    audio: false,
    maxEdgePx: config.image.maxEdgePx,
    aspect: PHOTO_ASPECT,
  });
  const dialog = useRef<HTMLDialogElement>(null);
  const [flash, setFlash] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function shoot() {
    if (!preview.current) return;
    setFlash((count) => count + 1);
    navigator.vibrate?.(SHUTTER_VIBRATE_MS);
    setError(null);
    captureFrame(preview.current, config.image).then(onCapture, () => setError("That photo didn't work. Please try again."));
  }

  return (
    <dialog ref={dialog} onClose={onClose} className="m-0 size-full max-h-none max-w-none bg-black text-white backdrop:bg-black">
      <div className="flex size-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <p aria-live="polite" className="min-w-0 truncate text-sm tabular-nums">
            {counter}
            {uploading > 0 && ` · ${uploading} uploading`}
          </p>
          <button type="button" onClick={onClose} className="h-11 shrink-0 rounded-lg px-3 font-medium active:bg-white/20">
            Done
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <video ref={preview} muted playsInline className="size-full object-contain" />
          {flash > 0 && <div key={flash} aria-hidden className="shutter-flash absolute inset-0 bg-white" />}
          {failed && (
            <div className="absolute inset-x-4 top-4 rounded-lg bg-black/80 p-4 text-center">
              <p role="alert" className="text-sm text-pretty">
                The camera didn&apos;t open. You can allow it in your browser settings, or use your phone&apos;s camera instead.
              </p>
              <button type="button" onClick={onUsePhoneCamera} className="mt-3 h-11 rounded-lg bg-white px-4 font-semibold text-black">
                Use phone camera
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="absolute inset-x-4 top-4 rounded-lg bg-black/80 p-3 text-center text-sm">
              {error}
            </p>
          )}
        </div>

        <div className="grid min-h-28 grid-cols-3 items-center px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={flip} disabled={!ready} className="h-11 justify-self-start rounded-lg px-3 font-medium active:bg-white/20 disabled:opacity-40">
            Flip
          </button>
          <button
            type="button"
            onClick={shoot}
            disabled={!ready || !canShoot}
            aria-label="Take photo"
            className="grid size-20 place-items-center justify-self-center rounded-full border-4 border-white disabled:opacity-40"
          >
            <span className="block size-16 rounded-full bg-white transition-transform active:scale-90" />
          </button>
          {!canShoot && <p className="text-right text-sm">No photos left</p>}
        </div>
      </div>
    </dialog>
  );
}
