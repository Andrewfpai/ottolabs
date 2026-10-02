/**
 * Keeps the destructive scripts (seed, clear, verify:timer) off the production
 * database.
 *
 * Name production's Neon endpoint once in `.env.local`:
 *
 *   PRODUCTION_DATABASE_ENDPOINT="ep-plain-frost-azr6kunz"
 *
 * and any of those scripts aimed at it stops before touching anything, unless
 * run with `--production` on purpose. "Which branch am I connected to" is the
 * thing most likely to go wrong, and a seed into production writes ninety days
 * of fake sessions into real people's accounts.
 */

/** "ep-plain-frost-azr6kunz", whether the URL uses the pooled host or not. */
export function endpointOf(databaseUrl: string | undefined): string | null {
  if (!databaseUrl) return null;
  try {
    return new URL(databaseUrl).hostname.split(".")[0].replace(/-pooler$/, "");
  } catch {
    return null;
  }
}

export function isProductionDatabase(
  databaseUrl: string | undefined,
  productionEndpoint: string | undefined,
): boolean {
  const target = endpointOf(databaseUrl);
  const production = productionEndpoint?.trim().replace(/-pooler$/, "");
  return Boolean(target && production && target === production);
}

/** Call first thing in a script that writes or deletes data. Exits on refusal. */
export function refuseProductionUnlessForced(script: string): void {
  const target = endpointOf(process.env.DATABASE_URL);
  const production = process.env.PRODUCTION_DATABASE_ENDPOINT;
  console.log(`\nDatabase: ${target ?? "(DATABASE_URL not set)"}`);

  if (!production?.trim()) {
    console.warn(
      "PRODUCTION_DATABASE_ENDPOINT is not set, so this script cannot tell whether that is\n" +
        "production. Add it to .env.local (see .env.example) to be protected.\n",
    );
    return;
  }

  if (isProductionDatabase(process.env.DATABASE_URL, production) && !process.argv.includes("--production")) {
    console.error(
      `\nRefusing to run ${script} against PRODUCTION (${target}).\n` +
        "Point DATABASE_URL in .env.local at your dev branch instead. If you really mean\n" +
        `production, run it again with --production:  npm run ${script} -- --production\n`,
    );
    process.exit(1);
  }
}
