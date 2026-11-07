"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { publicConfig } from "@/config";
import { useGuest, useRememberedName } from "@/lib/guest-store";
import type { DayInfo, GalleryResponse, Photo, Quota } from "@/lib/types";
import { UploadQueue, type QueuedUpload } from "@/lib/upload-queue";
import { cameraSupported } from "@/lib/use-camera";
import { PhotoCamera } from "./PhotoCamera";
import { VideoRecorder } from "./VideoRecorder";

function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function formatDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

async function errorMessage(response: Response) {
  const body = await response.json().catch(() => null);
  return (body?.error as string | undefined) ?? "Something went wrong. Please try again.";
}

function countLabel(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

async function fetchQuota(code: string, guestId: string): Promise<Quota | "unknown_guest" | "offline" | null> {
  try {
    const response = await fetch(`/api/days/${code}/guests/${guestId}/quota`, { cache: "no-store" });
    if (response.status === 404) return "unknown_guest";
    return response.ok ? ((await response.json()) as Quota) : null;
  } catch {
    return "offline";
  }
}

function galleryCount(items: Photo[]) {
  const videos = items.filter((item) => item.kind === "video").length;
  const photos = items.length - videos;
  return [photos && countLabel(photos, "photo"), videos && countLabel(videos, "video")].filter(Boolean).join(", ");
}

export function DayClient({ code }: { code: string }) {
  const { ready, guest, save } = useGuest(code);
  const [gallery, setGallery] = useState<GalleryResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [recording, setRecording] = useState(false);
  const [shooting, setShooting] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);

  const [queue] = useState(() => new UploadQueue(code));
  const uploads = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getServerSnapshot);

  const refreshGallery = useCallback(async () => {
    try {
      const response = await fetch(`/api/days/${code}/photos`, { cache: "no-store" });
      if (response.status === 404) {
        setMissing(true);
        return;
      }
      if (!response.ok) throw new Error(await errorMessage(response));
      const next = (await response.json()) as GalleryResponse;
      setGallery(next);
      setOffline(false);
      const shown = new Set(next.photos.map((photo) => photo.id));
      queue.removeUploaded((id) => !next.day.gallery_visible || shown.has(id));
    } catch {
      setOffline(true);
    }
  }, [code, queue]);

  // Poll only while the page is on screen, to avoid needless load on the NAS.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function tick() {
      clearTimeout(timer);
      if (document.visibilityState === "visible") await refreshGallery();
      if (!stopped) timer = setTimeout(tick, publicConfig.galleryPollMs);
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") void tick();
    }

    void tick();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshGallery]);

  const guestId = guest?.id;
  const applyQuota = useCallback(
    (result: Awaited<ReturnType<typeof fetchQuota>>) => {
      if (result === "unknown_guest") save(null);
      else if (result === "offline") setOffline(true);
      else if (result) setQuota(result);
    },
    [save],
  );
  const loadQuota = useCallback(async () => {
    if (guestId) applyQuota(await fetchQuota(code, guestId));
  }, [applyQuota, code, guestId]);

  useEffect(() => {
    if (!guestId) return;
    let cancelled = false;
    void fetchQuota(code, guestId).then((result) => {
      if (!cancelled) applyQuota(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyQuota, code, guestId]);

  useEffect(() => {
    queue.setHandlers({
      onUploaded: (kind) =>
        setQuota((current) =>
          current && (kind === "video" ? { ...current, video_used: current.video_used + 1 } : { ...current, used: current.used + 1 }),
        ),
      onRejected: (_kind, text, body) => {
        setMessage(text);
        if (body?.code === "unknown_guest") save(null);
        if (body?.code === "quota_reached" || body?.code === "video_quota_reached") void loadQuota();
        if (body?.code === "day_not_open") void refreshGallery();
      },
      // Parallel uploads each see an older count, so re-read the server's numbers at the end.
      onDrained: () => {
        void loadQuota();
        void refreshGallery();
      },
    });
  }, [queue, save, loadQuota, refreshGallery]);

  const waitingPhotos = uploads.filter((item) => item.kind === "photo" && item.status !== "done").length;
  const waitingVideos = uploads.filter((item) => item.kind === "video" && item.status !== "done").length;
  const failedCount = uploads.filter((item) => item.status === "failed").length;
  const sendingCount = uploads.filter((item) => item.status === "waiting" || item.status === "uploading").length;

  // Queued files live in memory, so closing the page now would lose them.
  const hasUnsent = sendingCount + failedCount > 0;
  useEffect(() => {
    if (!hasUnsent) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsent]);

  function addPhoto(source: { file?: File; blob?: Blob }) {
    if (!guestId) return;
    setMessage(null);
    queue.add("photo", guestId, source);
  }

  function takePhoto() {
    // The in-app camera needs https. Everywhere else, the phone's own camera still works.
    if (publicConfig.inAppPhotoCamera && !publicConfig.allowGalleryUpload && cameraSupported()) setShooting(true);
    else cameraInput.current?.click();
  }

  if (missing) {
    return (
      <Centered title="This link isn't valid">
        Check that you have the whole link, or ask the person who sent it.
      </Centered>
    );
  }
  if (!gallery) {
    return <Centered title={offline ? "Can't reach the album" : "Opening the album…"}>{offline ? "We'll keep trying." : null}</Centered>;
  }

  const { day, photos } = gallery;
  const shownPhotos = quota ? quota.used + waitingPhotos : 0;
  const shownVideos = quota ? quota.video_used + waitingVideos : 0;
  const atLimit = quota !== null && shownPhotos >= quota.limit;
  const atVideoLimit = quota !== null && shownVideos >= quota.video_limit;
  const videoEnabled = quota !== null && quota.video_limit > 0;
  const hasFooter = day.status === "open" && ready;
  const photoCounter = quota ? `${shownPhotos} / ${quota.limit} photos` : "";

  return (
    <main className={`mx-auto flex w-full max-w-3xl flex-1 flex-col ${hasFooter ? "pb-44" : "pb-8"}`}>
      <header className="px-4 pt-6 pb-4">
        <p className="text-sm text-muted">{publicConfig.appName}</p>
        <h1 className="mt-1 font-display text-3xl leading-tight text-balance">{formatDate(day.opens_at, day.timezone)}</h1>
        <p className="mt-1 text-sm text-muted">
          <DayStatusLine day={day} />
          {photos.length > 0 && ` · ${galleryCount(photos)}`}
        </p>
        {offline && (
          <p role="status" className="mt-2 text-sm text-danger">
            Connection lost. New photos will appear once it&apos;s back.
          </p>
        )}
      </header>

      {!day.gallery_visible ? (
        <EmptyState
          title={day.status === "closed" ? "This album has closed" : "This album hasn't opened yet"}
          body={
            day.status === "closed"
              ? "The photos have been kept safe, but they're no longer on view."
              : `Come back at ${formatTime(day.opens_at, day.timezone)} to start taking photos.`
          }
        />
      ) : photos.length === 0 && uploads.length === 0 ? (
        <EmptyState
          title="No photos yet"
          body={day.status === "open" ? "Be the first. Everyone with this link will see what you take." : "Nobody took a photo on this day."}
        />
      ) : (
        <ul className="grid grid-cols-3 gap-0.5 sm:grid-cols-4">
          {uploads.map((item) => (
            <UploadTile key={item.key} item={item} />
          ))}
          {photos.map((photo) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setViewing(photo)}
                aria-label={`View ${photo.kind}${photo.taken_by ? ` by ${photo.taken_by}` : ""}`}
                className="relative block aspect-square w-full overflow-hidden bg-surface"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- images are already resized by our own proxy */}
                <img src={photo.thumb_url} alt="" loading="lazy" className="size-full object-cover" />
                {photo.taken_by && (
                  <span className={`absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/70 to-transparent pt-4 pb-1 pl-1.5 text-left text-xs text-white ${photo.kind === "video" ? "pr-9" : "pr-1.5"}`}>
                    {photo.taken_by}
                  </span>
                )}
                {photo.kind === "video" && (
                  <span aria-hidden className="absolute right-1.5 bottom-1.5 grid size-7 place-items-center rounded-full bg-black/70 pl-0.5 text-xs text-white">
                    ▶
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasFooter && (
        <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-background/95 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {guest ? (
              <>
                <input
                  ref={cameraInput}
                  type="file"
                  accept="image/*"
                  capture={publicConfig.allowGalleryUpload ? undefined : "environment"}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) addPhoto({ file });
                    // Lets the same file be chosen again.
                    event.target.value = "";
                  }}
                />
                <div aria-live="polite" className="mb-2 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-muted">{sendingCount > 0 ? `Uploading ${sendingCount}…` : (guest.name ?? "Guest")}</span>
                  <span className="shrink-0 tabular-nums">
                    {quota ? `${photoCounter}${videoEnabled ? ` · ${shownVideos} / ${quota.video_limit} videos` : ""} today` : " "}
                  </span>
                </div>
                {failedCount > 0 && (
                  <div role="alert" className="mb-2 flex items-center justify-between gap-3 text-sm text-danger">
                    <span>{failedCount} didn&apos;t upload. Check your connection.</span>
                    <button type="button" onClick={() => queue.retryFailed()} className="h-9 shrink-0 rounded-lg border border-danger px-3 font-medium">
                      Retry
                    </button>
                  </div>
                )}
                {message && (
                  <p role="alert" className="mb-2 text-sm text-danger">
                    {message}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={atLimit || !quota}
                    onClick={takePhoto}
                    className="h-14 min-w-0 flex-2 rounded-xl bg-accent text-lg font-semibold text-on-accent transition-colors active:bg-accent-strong disabled:bg-surface disabled:text-muted"
                  >
                    {atLimit ? "No photos left" : publicConfig.allowGalleryUpload ? "Add photo" : "Take photo"}
                  </button>
                  {videoEnabled && (
                    <button
                      type="button"
                      disabled={atVideoLimit}
                      onClick={() => setRecording(true)}
                      className="h-14 min-w-0 flex-1 rounded-xl border border-accent text-lg font-semibold text-accent transition-colors active:bg-surface disabled:border-line disabled:text-muted"
                    >
                      {atVideoLimit ? "No videos" : "Video"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <JoinForm code={code} onJoined={save} />
            )}
          </div>
        </footer>
      )}

      {viewing && <Lightbox photo={viewing} timeZone={day.timezone} onClose={() => setViewing(null)} />}
      {shooting && (
        <PhotoCamera
          counter={photoCounter}
          uploading={sendingCount}
          canShoot={!atLimit}
          onCapture={(blob) => addPhoto({ blob })}
          onClose={() => setShooting(false)}
          onUsePhoneCamera={() => {
            setShooting(false);
            cameraInput.current?.click();
          }}
        />
      )}
      {recording && (
        <VideoRecorder
          onCancel={() => setRecording(false)}
          onRecorded={(video, poster) => {
            setRecording(false);
            if (!guestId) return;
            setMessage(null);
            queue.add("video", guestId, { blob: video, poster });
          }}
        />
      )}
    </main>
  );
}

function UploadTile({ item }: { item: QueuedUpload }) {
  const label = item.status === "failed" ? "Failed" : item.status === "done" ? null : "Uploading";
  return (
    <li className="relative aspect-square overflow-hidden bg-surface">
      {item.previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview of a file on this device
        <img src={item.previewUrl} alt="" className={`size-full object-cover ${label ? "opacity-60" : ""}`} />
      )}
      {label && (
        <span className={`absolute inset-x-1.5 bottom-1.5 truncate rounded-md px-1.5 py-0.5 text-center text-xs text-white ${item.status === "failed" ? "bg-red-700" : "bg-black/70"}`}>
          {label}
        </span>
      )}
    </li>
  );
}

function DayStatusLine({ day }: { day: DayInfo }) {
  if (day.status === "open") return <>Open until {formatTime(day.closes_at, day.timezone)}</>;
  if (day.status === "upcoming") return <>Opens at {formatTime(day.opens_at, day.timezone)}</>;
  return <>Closed</>;
}

function JoinForm({ code, onJoined }: { code: string; onJoined: (guest: { id: string; name: string | null }) => void }) {
  const remembered = useRememberedName();
  const [edited, setEdited] = useState<string | null>(null);
  // Someone who gave a name before joins by themselves, so they go straight to the camera.
  const [submitting, setSubmitting] = useState(Boolean(remembered));
  const [error, setError] = useState<string | null>(null);
  const name = edited ?? remembered;
  const autoJoined = useRef(false);

  const join = useCallback(
    async (guestName: string) => {
      try {
        const response = await fetch(`/api/days/${code}/guests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: guestName }),
        });
        if (!response.ok) {
          setError(await errorMessage(response));
          return;
        }
        onJoined((await response.json()) as { id: string; name: string | null });
      } catch {
        setError("Couldn't connect. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [code, onJoined],
  );

  useEffect(() => {
    if (!remembered || autoJoined.current) return;
    autoJoined.current = true;
    void join(remembered);
  }, [remembered, join]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    void join(name);
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="guest-name" className="mb-1.5 block text-sm font-medium">
        Your name <span className="font-normal text-muted">(optional)</span>
      </label>
      <div className="flex gap-2">
        <input
          id="guest-name"
          value={name}
          onChange={(event) => setEdited(event.target.value)}
          autoComplete="name"
          enterKeyHint="go"
          className="h-14 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-base"
        />
        <button
          type="submit"
          disabled={submitting}
          className="h-14 shrink-0 rounded-xl bg-accent px-6 text-lg font-semibold text-on-accent active:bg-accent-strong disabled:bg-surface disabled:text-muted"
        >
          {submitting ? "Joining…" : "Join"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

function Lightbox({ photo, timeZone, onClose }: { photo: Photo; timeZone: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  // showModal() gives focus trapping and Esc-to-close without extra code.
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      className="m-0 size-full max-h-none max-w-none bg-black text-white backdrop:bg-black"
    >
      <div className="flex size-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <p className="min-w-0 truncate text-sm">
            {photo.taken_by ?? "Guest"} · {formatTime(photo.taken_at, timeZone)}
          </p>
          <button type="button" onClick={onClose} className="h-11 shrink-0 rounded-lg px-3 font-medium active:bg-white/20">
            Close
          </button>
        </div>
        {photo.kind === "video" ? (
          <video
            src={photo.full_url}
            poster={photo.thumb_url}
            controls
            playsInline
            aria-label={`Video by ${photo.taken_by ?? "a guest"}`}
            className="min-h-0 flex-1 object-contain pb-[env(safe-area-inset-bottom)]"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- images are already resized by our own proxy
          <img
            src={photo.full_url}
            alt={`Photo by ${photo.taken_by ?? "a guest"}`}
            className="min-h-0 flex-1 object-contain pb-[env(safe-area-inset-bottom)]"
          />
        )}
      </div>
    </dialog>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="mx-4 rounded-xl bg-surface px-5 py-10 text-center">
      <h2 className="font-display text-xl text-balance">{title}</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm text-pretty text-muted">{body}</p>
    </section>
  );
}

function Centered({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-display text-2xl text-balance">{title}</h1>
      {children && <p className="mt-2 max-w-xs text-sm text-pretty text-muted">{children}</p>}
    </main>
  );
}
