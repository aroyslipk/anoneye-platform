import { apiJson } from "@/lib/api/handler";
import { configStatus } from "@/lib/env";

/** Secret-free runtime probe: only booleans and the backend name. */
export async function GET() {
  const config = configStatus();
  const degraded = config.issues.length > 0;
  return apiJson(
    {
      ok: !degraded,
      status: degraded ? "degraded" : "ok",
      app: "anoneye",
      backend: config.backend,
      integrations: {
        supabase: config.supabase === "configured",
        metaOAuth: config.metaOAuth === "configured",
        metaServerToken: config.metaServerToken === "configured",
        demoMode: config.demoMode,
      },
      issueCount: config.issues.length,
      time: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
