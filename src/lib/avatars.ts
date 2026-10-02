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

/**
 * The one "picture" string every avatar is drawn from: an `animal:<id>` when
 * someone picked an animal, otherwise their photo URL. Folding both into the
 * existing `image` field means every place that already shows a photo shows
 * the animal too, with no second field to thread through.
 */
const ANIMAL_PREFIX = "animal:";

export function pictureFor(avatar: string | null | undefined, image: string | null | undefined): string | null {
  const animal = currentAnimal(avatar);
  return animal ? `${ANIMAL_PREFIX}${animal}` : (image ?? null);
}

/** The animal in a picture string, or null when it is a photo (or nothing). */
export function animalFromPicture(picture: string | null | undefined): AnimalAvatarId | null {
  if (!picture?.startsWith(ANIMAL_PREFIX)) return null;
  const id = picture.slice(ANIMAL_PREFIX.length);
  return currentAnimal(id);
}
