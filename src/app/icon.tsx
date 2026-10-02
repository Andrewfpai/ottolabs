import { ImageResponse } from "next/og";

import { BrandMark } from "@/lib/brand-icon";

const SIZES = [32, 192, 512] as const;

/**
 * Served at /icon/32, /icon/192 and /icon/512. The 32px one is the browser-tab
 * favicon; the larger two are what the web app manifest lists for installing.
 */
export function generateImageMetadata() {
  return SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = Number(await id);
  return new ImageResponse(<BrandMark size={size} variant="tile" />, {
    width: size,
    height: size,
  });
}
