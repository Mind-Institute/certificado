// Edge function: sync-accredible-groups
// Sincroniza grupos do Accredible pra cert_accredible_groups (popula dropdown).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const ACCREDIBLE_BASE = "https://api.accredible.com/v1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function accredibleGet(path: string, query: Record<string, string>) {
  const key = Deno.env.get("ACCREDIBLE_API_KEY");
  if (!key) throw new Error("ACCREDIBLE_API_KEY não configurada nos Secrets do Supabase");
  const url = `${ACCREDIBLE_BASE}${path}?${new URLSearchParams(query).toString()}`;
  const res = await fetch(url, {
    headers: { "Authorization": `Token token="${key}"` },
  });
  if (!res.ok) throw new Error(`Accredible ${res.status}: ${await res.text()}`);
  return await res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const allGroups: any[] = [];
    let page = 1;
    while (page < 20) {
      const res = await accredibleGet("/issuer/groups", {
        page: String(page),
        page_size: "50",
      });
      const groups = res.groups ?? [];
      allGroups.push(...groups);
      if (groups.length < 50) break;
      page++;
    }

    if (allGroups.length === 0) {
      return json({ synced: 0, message: "Nenhum grupo encontrado no Accredible." });
    }

    const rows = allGroups.map((g: any) => ({
      accredible_group_id: String(g.id),
      accredible_group_identifier: g.identifier,
      name: g.name,
      course_name: g.course_name ?? null,
      description: g.course_description ?? null,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("cert_accredible_groups")
      .upsert(rows, { onConflict: "accredible_group_id" });
    if (error) throw error;

    return json({ synced: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
