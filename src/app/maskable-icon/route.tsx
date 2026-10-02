import { ImageResponse } from "next/og";

import { BrandMark } from "@/lib/brand-icon";

/**
 * Android's maskable icon: full-bleed, because the launcher cuts its own shape
 * (circle, squircle, teardrop) out of it. A plain route rather than another
 * `icon` id so it is not also advertised as a browser favicon.
 */
export function GET() {
  return new ImageResponse(<BrandMark size={512} variant="bleed" />, {
    width: 512,
    height: 512,
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
