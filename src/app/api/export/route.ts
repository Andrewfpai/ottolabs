import { buildExport, EXPORT_KINDS, type ExportKind } from "@/features/settings/server/export";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Download your data: `/api/export?format=json | sessions.csv | tasks.csv`.
 *
 * A GET route rather than a Server Action because the browser has to receive
 * a file download, which an action cannot hand it.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Sign in to export your data.", { status: 401 });
  }

  const format = new URL(request.url).searchParams.get("format") ?? "json";
  if (!(EXPORT_KINDS as readonly string[]).includes(format)) {
    return new Response(`Unknown format. Use one of: ${EXPORT_KINDS.join(", ")}.`, {
      status: 400,
    });
  }

  const file = await buildExport(format as ExportKind);

  return new Response(file.body, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      // Personal data: never let a shared cache or the browser keep a copy.
      "Cache-Control": "no-store, private",
    },
  });
}
