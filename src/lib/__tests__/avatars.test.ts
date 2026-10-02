import { describe, expect, it } from "vitest";

import { ANIMAL_AVATARS, animalFromPicture, pictureFor } from "../avatars";

describe("avatar pictures", () => {
  it("prefers the chosen animal over the photo", () => {
    expect(pictureFor("fox", "https://photo")).toBe("animal:fox");
    expect(animalFromPicture(pictureFor("fox", "https://photo"))).toBe("fox");
  });

  it("falls back to the photo, and to nothing", () => {
    expect(pictureFor(null, "https://photo")).toBe("https://photo");
    expect(pictureFor("dragon", "https://photo")).toBe("https://photo");
    expect(pictureFor(null, null)).toBeNull();
  });

  it("reads a photo URL or an unknown animal as no animal", () => {
    expect(animalFromPicture("https://lh3.googleusercontent.com/a/x")).toBeNull();
    expect(animalFromPicture("animal:dragon")).toBeNull();
    expect(animalFromPicture(null)).toBeNull();
  });

  it("has unique ids, three of them in the pink set", () => {
    const ids = ANIMAL_AVATARS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["axolotl", "piglet", "hamster"]));
  });
});
