"use client";

import { useCallback, useSyncExternalStore } from "react";

export interface StoredGuest {
  id: string;
  name: string | null;
}

const NAME_KEY = "memories:name";
const guestKey = (code: string) => `memories:guest:${code}`;

// Used when the browser blocks localStorage (some private modes), so the visit still works.
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function read(key: string) {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string | null) {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // The in-memory copy above is enough for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function parseGuest(raw: string | null | undefined): StoredGuest | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredGuest;
  } catch {
    return null;
  }
}

/** Returns { ready: false } during server render, because the guest only exists on the device. */
export function useGuest(code: string) {
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribe,
    () => read(guestKey(code)),
    () => undefined,
  );
  const save = useCallback((guest: StoredGuest | null) => {
    write(guestKey(code), guest ? JSON.stringify(guest) : null);
    if (guest?.name) write(NAME_KEY, guest.name);
  }, [code]);
  return { ready: raw !== undefined, guest: parseGuest(raw), save };
}

export function useRememberedName() {
  return useSyncExternalStore(subscribe, () => read(NAME_KEY) ?? "", () => "");
}
