import { ImageResponse } from "next/og";

import { BrandMark } from "@/lib/brand-icon";

/** iOS home-screen icon. iOS rounds the corners itself, so the tile fills the square. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrandMark size={180} variant="bleed" />, size);
}
