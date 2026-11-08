import type { Photo } from "./types";

/**
 * Decides what the Live Wall shows next. New photos jump the queue, oldest of
 * them first; otherwise the wall cycles through the latest items, newest first.
 * No browser or React code, so it can be tested on its own.
 */
export class WallQueue {
  private code: string | null = null;
  private seen = new Set<string>();
  private fresh: string[] = [];
  private items = new Map<string, Photo>();
  private order: string[] = [];
  // The rotation's place is kept by id, so new photos at the top don't shift it.
  private lastRotated: string | null = null;
  private lastRotatedIndex = -1;
  private lastShown: string | null = null;
  private started = false;

  /** Takes the latest list from the server, newest first. */
  update(code: string, photos: Photo[]) {
    // A new album (the next day, in daily mode) starts over.
    if (code !== this.code) {
      this.code = code;
      this.seen.clear();
      this.fresh = [];
      this.lastRotated = null;
      this.lastRotatedIndex = -1;
      this.lastShown = null;
      this.started = false;
    }
    if (this.started) {
      const arrived = photos.filter((photo) => !this.seen.has(photo.id)).reverse();
      this.fresh.push(...arrived.map((photo) => photo.id));
    }
    photos.forEach((photo) => this.seen.add(photo.id));
    this.items = new Map(photos.map((photo) => [photo.id, photo]));
    this.order = photos.map((photo) => photo.id);
    // The first list is shown in rotation; only later arrivals count as new.
    this.started = true;
  }

  get size() {
    return this.order.length;
  }

  /** The item to show now. Items deleted since they were queued are skipped. */
  next(): Photo | null {
    while (this.fresh.length > 0) {
      const photo = this.items.get(this.fresh.shift()!);
      if (photo) return this.show(photo);
    }
    const index = this.rotationIndex();
    if (index === null) return null;
    this.lastRotated = this.order[index];
    this.lastRotatedIndex = index;
    return this.show(this.items.get(this.order[index])!);
  }

  /** What next() would return, without moving on. Used to preload it. */
  peek(): Photo | null {
    const freshId = this.fresh.find((id) => this.items.has(id));
    if (freshId) return this.items.get(freshId)!;
    const index = this.rotationIndex();
    return index === null ? null : this.items.get(this.order[index])!;
  }

  private show(photo: Photo) {
    this.lastShown = photo.id;
    return photo;
  }

  /** The rotation's next position: after the last item it showed, wrapping round. */
  private rotationIndex(): number | null {
    const length = this.order.length;
    if (length === 0) return null;
    let after = -1; // nothing shown yet: start at the newest
    if (this.lastRotated !== null) {
      const found = this.order.indexOf(this.lastRotated);
      // If that item was deleted, carry on from roughly the same place.
      after = found !== -1 ? found : Math.min(this.lastRotatedIndex, length) - 1;
    }
    let index = (after + 1 + length) % length;
    // Don't show the same item twice in a row, e.g. a new photo that was just shown.
    if (length > 1 && this.order[index] === this.lastShown) index = (index + 1) % length;
    return index;
  }
}
