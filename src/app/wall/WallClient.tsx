"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useClientConfig, useTexts } from "@/lib/client-config";
import type { DayInfo, GalleryResponse, Photo } from "@/lib/types";
import { WallQueue } from "@/lib/wall-queue";

const CONTROLS_HIDE_MS = 3000;
// A video that never reports "ended" (e.g. a broken file) still moves on.
const VIDEO_MAX_MS = 90_000;
// Music plays this much quieter while a video with sound is on screen.
const DUCKED_VOLUME = 0.15;

type Slide = { photo: Photo; n: number };

/** Full-screen slideshow for a projector or TV. Runs on its own once started. */
export function WallClient({ wallKey }: { wallKey: string | null }) {
  const { appTitle, wall } = useClientConfig();
  const t = useTexts();
  const hasSound = wall.musicUrls.length > 0 || wall.videoSound;

  const [queue] = useState(() => new WallQueue());
  const [day, setDay] = useState<DayInfo | null>(null);
  const [slide, setSlide] = useState<Slide | null>(null);
  // Browsers only allow sound after a click, so a wall with sound waits for one.
  const [started, setStarted] = useState(!hasSound);
  // Copies for the polling callback, which outlives any single render.
  const slideRef = useRef<Slide | null>(null);
  const startedRef = useRef(started);
  const [offline, setOffline] = useState(false);
  const [controls, setControls] = useState(true);
  const music = useRef<HTMLAudioElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const advance = useCallback(() => {
    const photo = queue.next();
    const current = slideRef.current;
    // With a single photo, keep it still instead of fading it in again. A new
    // object still restarts the timer. Videos always restart.
    const same = current?.photo.id === photo?.id && photo?.kind === "photo";
    const next = photo ? { photo, n: same && current ? current.n : (current?.n ?? 0) + 1 } : null;
    slideRef.current = next;
    setSlide(next);
    // Load the next photo early, so it appears without a gap.
    const upcoming = queue.peek();
    if (upcoming?.kind === "photo") new Image().src = upcoming.full_url;
  }, [queue]);

  // Fetch the latest list on a timer. New photos join the queue as they arrive.
  useEffect(() => {
    const url = `/api/wall${wallKey ? `?key=${encodeURIComponent(wallKey)}` : ""}`;
    let stopped = false;
    async function poll() {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as GalleryResponse;
        if (stopped) return;
        queue.update(body.day.code, body.photos);
        setDay(body.day);
        setOffline(false);
        // Start showing as soon as there is something to show.
        if (startedRef.current && !slideRef.current) advance();
      } catch {
        if (!stopped) setOffline(true);
      }
    }
    void poll();
    const timer = setInterval(poll, wall.pollMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [advance, queue, wall.pollMs, wallKey]);

  // The full-screen button fades away when the mouse is still.
  useEffect(() => {
    hideTimer.current = setTimeout(() => setControls(false), CONTROLS_HIDE_MS);
    return () => clearTimeout(hideTimer.current);
  }, []);

  // Photos stay for LIVE_WALL_INTERVAL; videos play to the end (see onEnded).
  useEffect(() => {
    if (!started || !slide) return;
    const timer = setTimeout(advance, slide.photo.kind === "video" ? VIDEO_MAX_MS : wall.intervalMs);
    return () => clearTimeout(timer);
  }, [advance, slide, started, wall.intervalMs]);

  // Quieter music while a video with sound plays.
  useEffect(() => {
    if (!music.current) return;
    const ducked = wall.videoSound && slide?.photo.kind === "video";
    music.current.volume = wall.musicVolume * (ducked ? DUCKED_VOLUME : 1);
  }, [slide, wall.musicVolume, wall.videoSound]);

  // Keep the screen awake, and stop the music when the page closes.
  useEffect(() => {
    if (!started) return;
    let lock: WakeLockSentinel | null = null;
    const request = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock?.request("screen").then((sentinel) => (lock = sentinel), () => {});
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      void lock?.release();
      music.current?.pause();
    };
  }, [started]);

  function startMusic() {
    if (wall.musicUrls.length === 0 || music.current) return;
    let track = 0;
    const audio = new Audio(wall.musicUrls[0]);
    audio.volume = wall.musicVolume;
    // Plays the list in order, then starts again. A track that fails is skipped.
    const playNext = () => {
      track = (track + 1) % wall.musicUrls.length;
      audio.src = wall.musicUrls[track];
      void audio.play().catch(() => {});
    };
    audio.addEventListener("ended", playNext);
    audio.addEventListener("error", () => {
      if (wall.musicUrls.length > 1) setTimeout(playNext, 1000);
    });
    music.current = audio;
    void audio.play().catch(() => {});
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }

  function start() {
    // Must run inside the click, which is what lets the browser play sound.
    startMusic();
    if (!document.fullscreenElement) toggleFullscreen();
    startedRef.current = true;
    setStarted(true);
    if (!slideRef.current) advance();
  }

  function showControls() {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), CONTROLS_HIDE_MS);
  }

  const photo = slide?.photo;
  const locale = t.locale;
  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale, { timeZone: day?.timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  return (
    <main
      onMouseMove={showControls}
      onDoubleClick={toggleFullscreen}
      className={`fixed inset-0 overflow-hidden bg-black text-white select-none ${controls ? "" : "cursor-none"}`}
    >
      {photo ? (
        <figure key={slide.n} className="wall-fade absolute inset-0 m-0">
          {/* The same picture, blurred, fills the bars around photos of another shape. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- already resized by our own proxy */}
          <img src={photo.thumb_url} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />
          {photo.kind === "video" ? (
            <video
              src={photo.full_url}
              poster={photo.thumb_url}
              autoPlay
              muted={!wall.videoSound}
              playsInline
              onEnded={advance}
              onError={advance}
              className="relative size-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- already resized by our own proxy
            <img src={photo.full_url} alt="" className="relative size-full object-contain" />
          )}
          <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-10 pt-24 pb-8 text-3xl [text-shadow:0_1px_8px_rgb(0_0_0/0.6)]">
            {photo.taken_by ?? t.guest}
            <span className="text-white/70"> · {time(photo.taken_at)}</span>
          </figcaption>
        </figure>
      ) : started && (
        <div className="absolute inset-0 grid place-items-center p-10 text-center">
          <div>
            <h1 className="font-display text-6xl text-balance">{appTitle}</h1>
            <p className="mt-4 text-2xl text-white/70">{t.wallEmpty}</p>
          </div>
        </div>
      )}

      {photo && (
        <p className="absolute top-8 left-10 font-display text-2xl text-white/80 [text-shadow:0_1px_8px_rgb(0_0_0/0.6)]">{appTitle}</p>
      )}

      {offline && (
        <p role="status" className="absolute top-8 right-10 rounded-full bg-black/60 px-4 py-2 text-lg">
          {t.wallReconnecting}
        </p>
      )}

      {started && controls && !offline && (
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute top-6 right-8 rounded-lg bg-black/60 px-4 py-2 text-lg font-medium hover:bg-black/80"
        >
          {t.wallFullscreen}
        </button>
      )}

      {!started && (
        <div className="absolute inset-0 grid place-items-center bg-black p-10 text-center">
          <div>
            <h1 className="font-display text-5xl text-balance">{appTitle}</h1>
            <button type="button" onClick={start} className="mt-8 rounded-2xl bg-accent px-12 py-5 text-3xl font-semibold text-on-accent hover:bg-accent-strong">
              {t.wallStart}
            </button>
            <p className="mt-4 text-xl text-white/70">{t.wallStartHint}</p>
          </div>
        </div>
      )}
    </main>
  );
}
