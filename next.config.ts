import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep pages you visited in the last 30 seconds in the browser, so going
    // back and forth between them is instant. Saving anything (a task, a
    // session, a setting) calls revalidatePath, which clears that page from
    // this memory, so your own changes always show. Changes made on another
    // device can take up to 30 seconds to appear here.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
