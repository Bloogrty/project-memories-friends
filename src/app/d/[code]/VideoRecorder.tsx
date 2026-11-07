"use client";

import { useEffect, useRef, useState } from "react";
import { publicConfig } from "@/config";
import { cameraSupported, useCamera } from "@/lib/use-camera";

type Stage = "idle" | "recording" | "review";

// MP4 first: it plays on every phone, while recorded WebM doesn't on older iPhones.
const RECORDING_TYPES = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
const VIDEO_ASPECT = 16 / 9;
const AUDIO_BITS_PER_SECOND = 96_000;
const POSTER_MAX_EDGE_PX = 640;
const DATA_INTERVAL_MS = 500;
const TIMER_INTERVAL_MS = 200;

function unsupportedMessage() {
  if (!cameraSupported() || typeof MediaRecorder === "undefined") {
    return "Video recording needs the secure (https) link and an up-to-date browser.";
  }
  return null;
}

function capturePoster(video: HTMLVideoElement) {
  const scale = Math.min(1, POSTER_MAX_EDGE_PX / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not capture a preview."))),
      "image/jpeg",
      publicConfig.clientJpegQuality,
    );
  });
}

function formatSeconds(seconds: number) {
  return `0:${String(Math.floor(seconds)).padStart(2, "0")}`;
}

export function VideoRecorder({
  onCancel,
  onRecorded,
}: {
  onCancel: () => void;
  onRecorded: (video: Blob, poster: Blob) => void;
}) {
  const { preview, stream, ready, failed, flip } = useCamera({
    audio: true,
    maxEdgePx: publicConfig.videoMaxEdgePx,
    aspect: VIDEO_ASPECT,
  });
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(unsupportedMessage);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null);

  const dialog = useRef<HTMLDialogElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const poster = useRef<Blob | null>(null);
  // Set when this screen closes, so a clip stopped by Cancel is never uploaded.
  const discarded = useRef(false);

  useEffect(() => {
    discarded.current = false;
    dialog.current?.showModal();
    return () => {
      discarded.current = true;
      clearInterval(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
    };
  }, []);

  useEffect(() => {
    if (!clip) return;
    return () => URL.revokeObjectURL(clip.url);
  }, [clip]);

  function stopRecording() {
    clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function startRecording() {
    if (!stream.current || !preview.current) return;
    const mimeType = RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      setError("This browser can't record video.");
      return;
    }
    try {
      poster.current = await capturePoster(preview.current);
      const chunks: Blob[] = [];
      let size = 0;
      const next = new MediaRecorder(stream.current, {
        mimeType,
        videoBitsPerSecond: publicConfig.videoBitsPerSecond,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });
      next.ondataavailable = (event) => {
        chunks.push(event.data);
        size += event.data.size;
        // Bitrates are only approximate, so also stop before the file outgrows the upload limit.
        if (size >= publicConfig.videoTargetBytes) stopRecording();
      };
      next.onstop = () => {
        if (discarded.current) return;
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size === 0 || !poster.current) {
          setStage("idle");
          setError("Nothing was recorded. Please try again.");
          return;
        }
        if (!publicConfig.reviewVideoBeforeUpload) {
          onRecorded(blob, poster.current);
          return;
        }
        setClip({ blob, url: URL.createObjectURL(blob) });
        setStage("review");
      };
      recorder.current = next;
      next.start(DATA_INTERVAL_MS);

      const startedAt = Date.now();
      setElapsed(0);
      setError(null);
      setStage("recording");
      timer.current = setInterval(() => {
        const seconds = (Date.now() - startedAt) / 1000;
        setElapsed(Math.min(seconds, publicConfig.videoMaxSeconds));
        if (seconds >= publicConfig.videoMaxSeconds) stopRecording();
      }, TIMER_INTERVAL_MS);
    } catch {
      setError("Recording couldn't start. Please try again.");
    }
  }

  function retake() {
    setClip(null);
    setElapsed(0);
    setStage("idle");
  }

  const message = error ?? (failed ? "Please allow the camera and microphone in your browser settings, then try again." : null);

  return (
    <dialog ref={dialog} onClose={onCancel} className="m-0 size-full max-h-none max-w-none bg-black text-white backdrop:bg-black">
      <div className="flex size-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <p className="text-sm tabular-nums">
            {stage === "recording" && <span aria-hidden className="mr-2 inline-block size-2.5 rounded-full bg-red-500" />}
            {formatSeconds(elapsed)} / {formatSeconds(publicConfig.videoMaxSeconds)}
          </p>
          <button type="button" onClick={onCancel} className="h-11 shrink-0 rounded-lg px-3 font-medium active:bg-white/20">
            Cancel
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <video ref={preview} muted playsInline className={`size-full object-contain ${clip ? "hidden" : ""}`} />
          {clip && <video src={clip.url} controls playsInline aria-label="Your recording" className="size-full object-contain" />}
          {message && (
            <p role="alert" className="absolute inset-x-4 top-4 rounded-lg bg-black/80 p-3 text-center text-sm text-pretty">
              {message}
            </p>
          )}
        </div>

        {stage === "review" && clip ? (
          <div className="flex min-h-28 items-center justify-center gap-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={retake} className="h-14 flex-1 rounded-xl border border-white/50 font-semibold active:bg-white/20">
              Retake
            </button>
            <button
              type="button"
              onClick={() => poster.current && onRecorded(clip.blob, poster.current)}
              className="h-14 flex-1 rounded-xl bg-accent font-semibold text-on-accent active:bg-accent-strong"
            >
              Use video
            </button>
          </div>
        ) : (
          <div className="grid min-h-28 grid-cols-3 items-center px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {stage === "idle" ? (
              <button type="button" onClick={flip} disabled={!ready} className="h-11 justify-self-start rounded-lg px-3 font-medium active:bg-white/20 disabled:opacity-40">
                Flip
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              disabled={!ready}
              onClick={() => (stage === "recording" ? stopRecording() : void startRecording())}
              aria-label={stage === "recording" ? "Stop recording" : "Start recording"}
              className="grid size-20 place-items-center justify-self-center rounded-full border-4 border-white disabled:opacity-40"
            >
              <span className={`block bg-red-500 transition-all ${stage === "recording" ? "size-7 rounded-md" : "size-16 rounded-full"}`} />
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
