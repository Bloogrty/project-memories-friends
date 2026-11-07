import { randomBytes, randomInt } from "node:crypto";
import { readJson, writeJson } from "./storage";

interface GuestFile {
  display_name: string | null;
  created_at: string;
}

const NAME_COLORS = ["Amber", "Blue", "Coral", "Golden", "Green", "Indigo", "Jade", "Lime", "Maroon", "Olive", "Orange", "Pink", "Purple", "Red", "Silver", "Teal"];
const NAME_ANIMALS = ["Bear", "Cat", "Deer", "Dolphin", "Eagle", "Fox", "Gecko", "Heron", "Koala", "Lion", "Otter", "Owl", "Panda", "Rabbit", "Tiger", "Turtle"];

/** For guests who skip the name: random, but still easy to recognize in the album. */
export function randomGuestName() {
  return `${NAME_COLORS[randomInt(NAME_COLORS.length)]} ${NAME_ANIMALS[randomInt(NAME_ANIMALS.length)]}`;
}

function guestKey(code: string, guestId: string) {
  return `${code}/guests/${guestId}.json`;
}

// Guest files never change, so names can be remembered instead of re-read from
// the NAS on every gallery poll.
const nameCache = new Map<string, string | null>();

export async function createGuest(code: string, displayName: string) {
  // Short because it's part of every filename. Unique enough within one Day.
  const id = randomBytes(4).toString("hex");
  const file: GuestFile = { display_name: displayName, created_at: new Date().toISOString() };
  await writeJson(guestKey(code, id), file);
  nameCache.set(guestKey(code, id), displayName);
  return id;
}

export async function guestExists(code: string, guestId: string) {
  if (nameCache.has(guestKey(code, guestId))) return true;
  return (await readJson<GuestFile>(guestKey(code, guestId))) !== null;
}

export async function getGuestNames(code: string, guestIds: Iterable<string>) {
  const unique = [...new Set(guestIds)];
  await Promise.all(
    unique
      .filter((id) => !nameCache.has(guestKey(code, id)))
      .map(async (id) => {
        const file = await readJson<GuestFile>(guestKey(code, id));
        if (file) nameCache.set(guestKey(code, id), file.display_name);
      }),
  );
  return new Map(unique.map((id) => [id, nameCache.get(guestKey(code, id)) ?? null]));
}
