import { describe, expect, it } from "vitest";

import { ANIMAL_AVATARS, animalFromPicture, normalizeAccessories, parsePicture, pictureFor, takeOff, wear } from "../avatars";

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
    expect(ids).toEqual(expect.arrayContaining(["axolotl", "pinkpup", "hamster"]));
    expect(ids).toEqual(expect.arrayContaining(["golden", "husky", "corgi", "koala", "seal", "redpanda"]));
    expect(ids).not.toContain("puppy");
    expect(ids).not.toContain("piglet");
  });

  it("keeps people who picked a retired avatar on its replacement", () => {
    expect(pictureFor("puppy", "https://photo")).toBe("animal:golden");
    expect(animalFromPicture("animal:piglet")).toBe("pinkpup");
  });
});

describe("accessories", () => {
  it("keeps one per slot, the later winning, in drawing order", () => {
    expect(normalizeAccessories(["crown", "glasses", "halo", "nonsense", "scarf"])).toEqual(["scarf", "glasses", "halo"]);
    expect(wear(["crown", "glasses"], "gradcap")).toEqual(["glasses", "gradcap"]);
    expect(takeOff(["crown", "glasses"], "crown")).toEqual(["glasses"]);
  });

  it("travel inside the picture string and back", () => {
    const picture = pictureFor("fox", "https://photo", ["crown", "scarf"]);
    expect(picture).toBe("animal:fox~scarf,crown");
    expect(parsePicture(picture)).toEqual({ animal: "fox", accessories: ["scarf", "crown"] });
    expect(parsePicture("animal:fox")).toEqual({ animal: "fox", accessories: [] });
  });

  it("are not drawn on a photo", () => {
    expect(pictureFor(null, "https://photo", ["crown"])).toBe("https://photo");
    expect(parsePicture("https://photo")).toBeNull();
  });
});
