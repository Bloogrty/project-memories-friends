"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Browsers only offer the camera API on https and localhost. */
export function cameraSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Opens the camera into a <video> preview, and always releases it when the screen closes. */
export function useCamera({ audio, maxEdgePx, aspect }: { audio: boolean; maxEdgePx: number; aspect: number }) {
  const preview = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cameraSupported()) return;
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: maxEdgePx }, height: { ideal: Math.round(maxEdgePx / aspect) } },
        audio,
      });
      if (cancelled) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      if (preview.current) {
        preview.current.srcObject = media;
        await preview.current.play();
      }
      if (!cancelled) setReady(true);
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, [audio, aspect, facing, maxEdgePx]);

  const flip = useCallback(() => {
    setReady(false);
    setFacing((current) => (current === "environment" ? "user" : "environment"));
  }, []);

  return { preview, stream, ready, failed, flip };
}
