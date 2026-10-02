/**
 * Built-in animal avatars, drawn as SVG in `components/animal-avatar.tsx`.
 *
 * `users.avatar` stores one of these ids, or null for "use my Google photo".
 * The list lives here, apart from the drawings, so server actions can
 * validate an id without importing any UI.
 */
export const ANIMAL_AVATARS = [
  { id: "cat", label: "Cat" },
  { id: "panda", label: "Panda" },
  { id: "bunny", label: "Bunny" },
  { id: "bear", label: "Bear" },
  { id: "frog", label: "Frog" },
  { id: "fox", label: "Fox" },
  { id: "chick", label: "Chick" },
  { id: "penguin", label: "Penguin" },
  { id: "golden", label: "Golden retriever" },
  { id: "husky", label: "Husky" },
  { id: "corgi", label: "Corgi" },
  { id: "koala", label: "Koala" },
  { id: "seal", label: "Seal pup" },
  { id: "redpanda", label: "Red panda" },
  // The pink set.
  { id: "axolotl", label: "Axolotl" },
  { id: "pinkpup", label: "Pink pup" },
  { id: "hamster", label: "Hamster" },
] as const;

export type AnimalAvatarId = (typeof ANIMAL_AVATARS)[number]["id"];

export const ANIMAL_AVATAR_IDS = ANIMAL_AVATARS.map((a) => a.id) as [AnimalAvatarId, ...AnimalAvatarId[]];

export function isAnimalAvatar(value: string | null | undefined): value is AnimalAvatarId {
  return ANIMAL_AVATARS.some((a) => a.id === value);
}

/**
 * Avatars that were retired, and what someone who picked one now sees.
 * Stored ids are never rewritten, so a retired id must map somewhere or the
 * person silently loses their choice.
 */
const RETIRED: Record<string, AnimalAvatarId> = {
  puppy: "golden",
  piglet: "pinkpup",
};

/** A stored avatar id as a current one, following retirements; null if unknown. */
export function currentAnimal(value: string | null | undefined): AnimalAvatarId | null {
  if (!value) return null;
  if (isAnimalAvatar(value)) return value;
  return RETIRED[value] ?? null;
}

// ── Accessories, earned through milestones ─────────────────────────────────

export const ACCESSORY_SLOTS = ["neck", "face", "head", "extra"] as const;
export type AccessorySlot = (typeof ACCESSORY_SLOTS)[number];

/** Drawn in slot order (neck under face under head), one per slot. */
export const ACCESSORIES = [
  { id: "headphones", label: "Headphones", slot: "head" },
  { id: "gradcap", label: "Graduation cap", slot: "head" },
  { id: "crown", label: "Crown", slot: "head" },
  { id: "halo", label: "Halo", slot: "head" },
  { id: "beanie", label: "Tomato beanie", slot: "head" },
  { id: "flowers", label: "Flower crown", slot: "head" },
  { id: "nightcap", label: "Nightcap", slot: "head" },
  { id: "glasses", label: "Round glasses", slot: "face" },
  { id: "sunglasses", label: "Sunglasses", slot: "face" },
  { id: "scarf", label: "Scarf", slot: "neck" },
  { id: "medal", label: "Medal", slot: "neck" },
  { id: "bowtie", label: "Bow tie", slot: "neck" },
  { id: "mug", label: "Coffee mug", slot: "extra" },
  { id: "sparkles", label: "Sparkles", slot: "extra" },
  { id: "bird", label: "Bird friend", slot: "extra" },
] as const;

export type AccessoryId = (typeof ACCESSORIES)[number]["id"];

export function isAccessory(value: string): value is AccessoryId {
  return ACCESSORIES.some((a) => a.id === value);
}

export function accessorySlot(id: AccessoryId): AccessorySlot {
  return ACCESSORIES.find((a) => a.id === id)!.slot;
}

/**
 * Known accessories only, at most one per slot (the later one wins), in
 * drawing order. Anything stored or sent is passed through this.
 */
export function normalizeAccessories(list: readonly string[]): AccessoryId[] {
  const bySlot = new Map<AccessorySlot, AccessoryId>();
  for (const id of list) if (isAccessory(id)) bySlot.set(accessorySlot(id), id);
  return ACCESSORY_SLOTS.flatMap((slot) => (bySlot.has(slot) ? [bySlot.get(slot)!] : []));
}

/** Put one on, replacing whatever was in its slot. */
export function wear(current: readonly string[], id: AccessoryId): AccessoryId[] {
  return normalizeAccessories([...current, id]);
}

/** Take one off. */
export function takeOff(current: readonly string[], id: AccessoryId): AccessoryId[] {
  return normalizeAccessories(current.filter((a) => a !== id));
}

/**
 * The one "picture" string every avatar is drawn from: `animal:<id>` when
 * someone picked an animal, with `~acc,acc` for what it wears; otherwise
 * their photo URL. Folding it all into the existing `image` field means every
 * place that already shows a photo shows the animal, accessories and all,
 * with no second field to thread through.
 */
const ANIMAL_PREFIX = "animal:";

export function pictureFor(
  avatar: string | null | undefined,
  image: string | null | undefined,
  accessories: readonly string[] = [],
): string | null {
  const animal = currentAnimal(avatar);
  if (!animal) return image ?? null;
  const worn = normalizeAccessories(accessories);
  return `${ANIMAL_PREFIX}${animal}${worn.length > 0 ? `~${worn.join(",")}` : ""}`;
}

export type AnimalPicture = { animal: AnimalAvatarId; accessories: AccessoryId[] };

/** The animal and what it wears, or null when the picture is a photo (or nothing). */
export function parsePicture(picture: string | null | undefined): AnimalPicture | null {
  if (!picture?.startsWith(ANIMAL_PREFIX)) return null;
  const [id, worn = ""] = picture.slice(ANIMAL_PREFIX.length).split("~");
  const animal = currentAnimal(id);
  if (!animal) return null;
  return { animal, accessories: normalizeAccessories(worn ? worn.split(",") : []) };
}

/** The animal in a picture string, or null when it is a photo (or nothing). */
export function animalFromPicture(picture: string | null | undefined): AnimalAvatarId | null {
  return parsePicture(picture)?.animal ?? null;
}
