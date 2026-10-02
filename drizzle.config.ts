import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so it does not pick up .env.local on its own.
config({ path: ".env.local" });

// db:push changes whatever DATABASE_URL points at. Say which, so pushing to
// production is always a deliberate act rather than a surprise.
{
  const host = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname.split(".")[0] : "(unset)";
  const production = process.env.PRODUCTION_DATABASE_ENDPOINT?.trim();
  const isProduction = Boolean(production && host.replace(/-pooler$/, "") === production.replace(/-pooler$/, ""));
  console.log(`
Database: ${host}${isProduction ? "  <-- PRODUCTION" : ""}
`);
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
