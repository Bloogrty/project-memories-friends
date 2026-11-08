import type { ClientConfig } from "@/config";
import { compressImage } from "./compress";
import type { Texts } from "./texts";

type QueueOptions = Pick<ClientConfig, "image" | "uploadConcurrency" | "uploadRetries"> & {
  texts: Pick<Texts, "photoUnreadable" | "uploadRefused">;
};

/**
 * Uploads run here in the background, so guests can keep shooting however slow
 * the connection or NAS is. Holds files in memory only: closing the page loses
 * anything still queued, which is why the page warns before closing.
 */

const RETRY_DELAY_MS = 2000;

export type UploadKind = "photo" | "video";

export interface QueuedUpload {
  key: number;
  kind: UploadKind;
  status: "waiting" | "uploading" | "failed" | "done";
  previewUrl: string | null;
  uploadedId: string | null;
}

export interface UploadHandlers {
  onUploaded: (kind: UploadKind) => void;
  /** The server said no, or the file can't be read, so retrying won't help. */
  onRejected: (kind: UploadKind, message: string, body: Record<string, unknown> | null) => void;
  /** Nothing left to send. */
  onDrained: () => void;
}

type Source = { file?: File; blob?: Blob; poster?: Blob };
type Entry = QueuedUpload & Source & { guestId: string; attempts: number };

const EMPTY: QueuedUpload[] = [];

export class UploadQueue {
  private handlers: UploadHandlers | null = null;
  private entries: Entry[] = [];
  private snapshot = EMPTY;
  private active = 0;
  private nextKey = 1;
  private listeners = new Set<() => void>();

  constructor(
    private readonly code: string,
    private readonly options: QueueOptions,
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => EMPTY;

  setHandlers(handlers: UploadHandlers) {
    this.handlers = handlers;
  }

  add(kind: UploadKind, guestId: string, source: Source) {
    const previewSource = kind === "video" ? source.poster : source.blob;
    this.entries.unshift({
      ...source,
      key: this.nextKey++,
      kind,
      guestId,
      status: "waiting",
      previewUrl: previewSource ? URL.createObjectURL(previewSource) : null,
      uploadedId: null,
      attempts: 0,
    });
    this.publish();
    this.pump();
  }

  retryFailed() {
    for (const entry of this.entries) {
      if (entry.status === "failed") {
        entry.status = "waiting";
        entry.attempts = 0;
      }
    }
    this.publish();
    this.pump();
  }

  /** Removes finished previews once the real gallery can show them instead. */
  removeUploaded(isShown: (id: string) => boolean) {
    const shown = this.entries.filter((entry) => entry.status === "done" && isShown(entry.uploadedId ?? ""));
    if (shown.length === 0) return;
    shown.forEach((entry) => this.remove(entry));
    this.publish();
  }

  private remove(entry: Entry) {
    if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    this.entries = this.entries.filter((other) => other !== entry);
  }

  private publish() {
    this.snapshot = this.entries.map(({ key, kind, status, previewUrl, uploadedId }) => ({
      key,
      kind,
      status,
      previewUrl,
      uploadedId,
    }));
    this.listeners.forEach((listener) => listener());
  }

  private pump() {
    while (this.active < this.options.uploadConcurrency) {
      // Oldest first, so photos arrive in the order they were taken.
      const next = this.entries.findLast((entry) => entry.status === "waiting");
      if (!next) break;
      next.status = "uploading";
      this.active++;
      void this.send(next).finally(() => {
        this.active--;
        this.pump();
        const busy = this.entries.some((entry) => entry.status === "waiting" || entry.status === "uploading");
        if (!busy) this.handlers?.onDrained();
      });
    }
    this.publish();
  }

  private async send(entry: Entry) {
    if (!entry.blob && entry.file) {
      try {
        entry.blob = await compressImage(entry.file, this.options.image);
        entry.file = undefined;
        entry.previewUrl = URL.createObjectURL(entry.blob);
        this.publish();
      } catch {
        this.reject(entry, this.options.texts.photoUnreadable, null);
        return;
      }
    }

    const form = new FormData();
    form.append("guestId", entry.guestId);
    if (entry.kind === "video") {
      form.append("video", entry.blob!, "video");
      form.append("poster", entry.poster!, "poster.jpg");
    } else {
      form.append("photo", entry.blob!, "photo.jpg");
    }

    let response: Response;
    try {
      response = await fetch(`/api/days/${this.code}/${entry.kind}s`, { method: "POST", body: form });
    } catch {
      this.retryLater(entry);
      return;
    }
    if (response.status >= 500) {
      this.retryLater(entry);
      return;
    }

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      this.reject(entry, (body?.error as string) ?? this.options.texts.uploadRefused, body);
      return;
    }
    // Keep the local preview until the gallery shows the real file, to avoid a flicker.
    entry.status = "done";
    entry.uploadedId = body?.id as string;
    entry.file = entry.blob = entry.poster = undefined;
    this.publish();
    this.handlers?.onUploaded(entry.kind);
  }

  private reject(entry: Entry, message: string, body: Record<string, unknown> | null) {
    this.remove(entry);
    this.publish();
    this.handlers?.onRejected(entry.kind, message, body);
  }

  /** Connection problems and server errors are usually temporary. */
  private retryLater(entry: Entry) {
    entry.attempts++;
    if (entry.attempts > this.options.uploadRetries) {
      entry.status = "failed";
      this.publish();
      return;
    }
    setTimeout(() => {
      entry.status = "waiting";
      this.pump();
    }, RETRY_DELAY_MS * entry.attempts);
  }
}
