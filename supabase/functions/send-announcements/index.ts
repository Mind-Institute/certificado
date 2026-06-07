// Edge function: send-announcements
// Recebe { recipient_ids: [] } ou { course_template_id } e envia o email parabéns.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const LOGO_URL = "https://mind-institute.github.io/certificado/logo.png";

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function sub(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

function looksLikeHtml(text: string): boolean {
  const t = text.trim();
  return t.startsWith("<") || /<\w+[\s>]/.test(t);
}

function paragraphs(text: string): string {
  // If the body is already HTML (produced by the WYSIWYG editor), inject it
  // directly into the email shell — no markdown conversion needed.
  if (looksLikeHtml(text)) {
    return text;
  }
  // Legacy plain-text-with-**bold** fallback.
  return text.trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => {
    const parts = p.split(/(\*\*[^*]+\*\*)/g);
    const inner = parts.map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`;
      return escapeHtml(part).replace(/\n/g, "<br>");
    }).join("");
    return `<p style="font-size:18px;line-height:1.6;margin:0 0 16px 0;color:#111111;">${inner}</p>`;
  }).join("\n");
}

function shell(inner: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#000000;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;"><tr><td align="center" style="padding:40px 24px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:24px;overflow:hidden;"><tr><td style="padding:40px 32px;font-family:Arial,Helvetica,sans-serif;color:#111111;">
<p style="margin:0 0 32px 0;"><img src="${LOGO_URL}" alt="Mind" style="height:56px;width:auto;display:block;border:0;" /></p>
${inner}
</td></tr></table></td></tr></table></body></html>`;
}

function primaryBtn(label: string, href: string): string {
  return `<p style="margin:24px 0 0 0;"><a href="${href}" style="background-color:#68EE95;color:#111111;padding:14px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;font-size:16px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</a></p>`;
}

function signoff(): string {
  return `<p style="font-size:18px;line-height:1.6;margin:40px 0 8px 0;color:#111111;">Qualquer coisa, é só responder este email.</p><p style="font-size:18px;line-height:1.6;margin:0;color:#111111;">Time Mind</p>`;
}

function renderAnnouncement(bodyText: string, vars: Record<string, string>): string {
  const withVars = sub(bodyText, vars);
  let inner = paragraphs(withVars);
  if (vars.claim_url) inner += "\n" + primaryBtn("Acessar certificado", vars.claim_url);
  inner += "\n" + signoff();
  return shell(inner);
}

async function sendResend(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY não configurada");
  const from = Deno.env.get("FROM_EMAIL") ?? "Mind Institute <no-reply@joinmind.com.br>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, reply_to: "adriana@joinmind.com.br" }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return await res.json() as { id: string };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appUrl = Deno.env.get("APP_URL") ?? "https://mind-certificados.vercel.app";
    const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const body = await req.json() as { recipient_ids?: string[]; course_template_id?: string };
    let q = supabase.from("cert_recipients").select("id, first_name, email, certificate_name, claim_token, status, retry_count, course_template_id, cert_course_templates(course_name, announcement_subject, announcement_body_text)");
    if (body.recipient_ids?.length) q = q.in("id", body.recipient_ids);
    else if (body.course_template_id) q = q.eq("course_template_id", body.course_template_id).eq("status", "pending");
    else return json({ error: "Forneça recipient_ids ou course_template_id" }, 400);

    const { data: recipients, error } = await q;
    if (error) throw error;
    if (!recipients?.length) return json({ sent: 0, message: "Nenhum recipient encontrado." });

    const results: any[] = [];
    for (const r of recipients as any[]) {
      const tpl = r.cert_course_templates;
      if (!tpl) { results.push({ id: r.id, ok: false, error: "Template ausente" }); continue; }
      try {
        const claimUrl = `${appUrl}/claim/${r.claim_token}`;
        const vars = { primeiro_nome: r.first_name, nome_certificado: r.certificate_name, curso: tpl.course_name, claim_url: claimUrl };
        const subject = sub(tpl.announcement_subject, vars);
        const html = renderAnnouncement(tpl.announcement_body_text, vars);
        const send = await sendResend(r.email, subject, html);
        await supabase.from("cert_email_log").insert({ recipient_id: r.id, email_type: "announcement", to_email: r.email, subject, status: "sent", provider_id: send.id });
        await supabase.from("cert_recipients").update({ status: "announced", announcement_sent_at: new Date().toISOString(), error_message: null }).eq("id", r.id);
        results.push({ id: r.id, ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabase.from("cert_email_log").insert({ recipient_id: r.id, email_type: "announcement", to_email: r.email, subject: "(falha)", status: "failed", error_message: msg });
        await supabase.from("cert_recipients").update({ status: "failed", error_message: msg, retry_count: (r.retry_count ?? 0) + 1 }).eq("id", r.id);
        results.push({ id: r.id, ok: false, error: msg });
      }
    }
    const sent = results.filter((x) => x.ok).length;
    return json({ sent, total: results.length, results });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
