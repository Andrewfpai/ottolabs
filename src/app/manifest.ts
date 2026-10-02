import type { MetadataRoute } from "next";

import { BRAND_BACKGROUND } from "@/lib/brand-icon";

/**
 * What makes the app installable: "Add to Home Screen" on a phone, "Install"
 * in a desktop browser. It opens on the dashboard in its own window, without
 * browser chrome.
 *
 * There is deliberately no service worker. Browsers no longer require one to
 * install, and an offline cache here would mostly serve stale timers and a
 * signed-out shell — this app is only useful with the server's clock and data.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OttoLabs",
    short_name: "OttoLabs",
    description: "Track what you are learning, and find out when you actually focus.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: BRAND_BACKGROUND,
    theme_color: BRAND_BACKGROUND,
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/maskable-icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Tasks", url: "/tasks" },
      { name: "Analytics", url: "/analytics" },
    ],
  };
}
