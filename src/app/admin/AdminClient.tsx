"use client";

import { useState, type FormEvent } from "react";
import type { GalleryResponse, Photo } from "@/lib/types";

const inputClass = "h-12 w-full rounded-xl border border-line bg-surface px-4 text-base";

/** The secret stays in memory only, so reloading the page signs you out. */
export function AdminClient() {
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [data, setData] = useState<GalleryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(path: string, method = "GET") {
    const response = await fetch(`/api/admin/days/${encodeURIComponent(code.trim())}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error ?? "The request failed.");
    return body;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }

  const load = () => run(async () => setData((await call("/photos")) as GalleryResponse));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  function closeDay() {
    if (!window.confirm(`Close ${code.trim()} now? Guests can't upload after this, and it can't be undone here.`)) return;
    void run(async () => {
      await call("/close", "POST");
      setData((await call("/photos")) as GalleryResponse);
    });
  }

  function deletePhoto(photo: Photo) {
    if (!window.confirm(`Delete this ${photo.kind} from the NAS for good?`)) return;
    void run(async () => {
      await call(`/photos/${encodeURIComponent(photo.id)}`, "DELETE");
      setData((await call("/photos")) as GalleryResponse);
    });
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <h1 className="font-display text-3xl">Admin</h1>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="secret" className="mb-1.5 block text-sm font-medium">Admin secret</label>
          <input id="secret" type="password" required autoComplete="current-password" value={secret} onChange={(event) => setSecret(event.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="code" className="mb-1.5 block text-sm font-medium">Day code</label>
          <input id="code" required placeholder="2026-11-07" autoCapitalize="none" value={code} onChange={(event) => setCode(event.target.value)} className={inputClass} />
        </div>
        <button type="submit" disabled={busy} className="h-12 w-full rounded-xl bg-accent font-semibold text-on-accent disabled:bg-surface disabled:text-muted">
          {busy ? "Working…" : "Load Day"}
        </button>
      </form>

      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

      {data && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-medium">{data.day.status}</span>
              <span className="text-muted"> · {data.photos.length} items</span>
            </p>
            {data.day.status !== "closed" && (
              <button type="button" disabled={busy} onClick={closeDay} className="h-11 rounded-lg border border-danger px-4 text-sm font-medium text-danger disabled:opacity-50">
                Close this Day
              </button>
            )}
          </div>
          {data.photos.length > 0 && !data.day.gallery_visible && (
            <p className="mt-2 text-sm text-muted">The gallery is hidden, so previews won&apos;t load. Deleting still works.</p>
          )}
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.photos.map((photo) => (
              <li key={photo.id} className="overflow-hidden rounded-lg bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element -- images are already resized by our own proxy */}
                <img src={photo.thumb_url} alt={`Photo by ${photo.taken_by ?? "a guest"}`} loading="lazy" className="aspect-square w-full object-cover text-xs" />
                <div className="flex items-center justify-between gap-2 p-2">
                  <span className="min-w-0 truncate text-sm">
                    {photo.taken_by ?? "Guest"}
                    {photo.kind === "video" && " · video"}
                  </span>
                  <button type="button" disabled={busy} onClick={() => deletePhoto(photo)} className="h-11 shrink-0 px-2 text-sm font-medium text-danger disabled:opacity-50">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
