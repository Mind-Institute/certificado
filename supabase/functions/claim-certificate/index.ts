// Edge function: claim-certificate
// GET /claim-certificate?token=<uuid>  — público (verify_jwt=false)
// Lógica idempotente: cria credencial Accredible se não houver, envia email pós-emissão na 1ª vez, redireciona.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const LOGO_URL = "https://mind-institute.github.io/certificado/logo.png";
const SUMMIT_URL = "https://lp.mindsummit.com.br";
const ACCREDIBLE_BASE = "https://api.accredible.com/v1";

function htmlResp(html: string, status = 200) {
  return new Response(html, { status, headers: { ...CORS, "Content-Type": "text/html; charset=utf-8" } });
}

function errorPage(msg: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Mind</title>
  <style>body{margin:0;background:#000;color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px;}
  .card{background:#fff;color:#111;padding:40px;border-radius:24px;max-width:480px;}
  h1{font-size:22px;margin:0 0 16px;}</style></head>
  <body><div class="card"><h1>Não conseguimos abrir seu certificado</h1>
  <p>${msg}</p><p>Responda o email de origem que a gente te ajuda.</p></div></body></html>`;
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
<body style="margin:0;padding:0;background-color:#000000;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;"><tr><td align="center" style="padding:40px 24px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:24px;overflow:hidden;"><tr><td style="padding:40px 32px;font-family:Arial,Helvetica,sans-serif;color:#111111;">
<p style="margin:0 0 32px 0;"><img src="${LOGO_URL}" alt="Mind" style="height:56px;width:auto;display:block;border:0;" /></p>
${inner}
</td></tr></table></td></tr></table></body></html>`;
}

function primaryBtn(label: string, href: string): string {
  return `<p style="margin:24px 0 0 0;"><a href="${href}" style="background-color:#68EE95;color:#111111;padding:14px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;font-size:16px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</a></p>`;
}

function darkBtn(label: string, href: string): string {
  return `<p style="margin:0;"><a href="${href}" style="background-color:#111111;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;font-size:16px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</a></p>`;
}

const DEFAULT_LINKEDIN_INNER = `<p style="font-size:22px;line-height:1.4;font-weight:bold;margin:0 0 16px 0;color:#111111;">Adicione ao LinkedIn em 30 segundos</p>
<p style="font-size:18px;line-height:1.6;margin:0 0 24px 0;color:#111111;">É uma excelente forma de mostrar, de maneira concreta, que você está buscando aprofundamento em liderança, cultura e saúde mental no trabalho, e de deixar isso visível para quem acompanha o seu trabalho.</p>`;

const DEFAULT_SUMMIT_INNER = `<p style="font-size:22px;line-height:1.4;font-weight:bold;margin:0 0 16px 0;color:#111111;">Continue a sua jornada de excelência</p>
<p style="font-size:18px;line-height:1.6;margin:0 0 16px 0;color:#111111;">Se o certificado marca o quanto você já se aprofundou, o <strong>Mind Summit 2026</strong> é o próximo salto. Serão 2 dias presenciais em São Paulo, com palco, workshops e masterclasses organizados nas trilhas que concentram as dores reais de quem lidera hoje.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
<tr><td style="padding:2px 0;font-size:18px;line-height:1.6;color:#111111;font-family:Arial,Helvetica,sans-serif;">• O Peso de Liderar</td></tr>
<tr><td style="padding:2px 0;font-size:18px;line-height:1.6;color:#111111;font-family:Arial,Helvetica,sans-serif;">• A Saúde Mental do Meu Time</td></tr>
<tr><td style="padding:2px 0;font-size:18px;line-height:1.6;color:#111111;font-family:Arial,Helvetica,sans-serif;">• Provar que Saúde e Bem-Estar no Trabalho Funcionam</td></tr>
<tr><td style="padding:2px 0;font-size:18px;line-height:1.6;color:#111111;font-family:Arial,Helvetica,sans-serif;">• NR-1 na Prática</td></tr>
<tr><td style="padding:2px 0;font-size:18px;line-height:1.6;color:#111111;font-family:Arial,Helvetica,sans-serif;">• IA sem Pânico</td></tr>
<tr><td style="padding:2px 0;font-size:18px;line-height:1.6;color:#111111;font-family:Arial,Helvetica,sans-serif;">• Cultura que Sustenta</td></tr>
</table>
<p style="font-size:18px;line-height:1.6;margin:0 0 16px 0;color:#111111;">Nos workshops e nas masterclasses, você aprofunda os temas que escolher com aplicação prática e aprende com quem ajudou a construir os campos que orientam essa agenda, como Christina Maslach, Amy Edmondson e Jan-Emmanuel De Neve.</p>
<p style="font-size:18px;line-height:1.6;margin:0 0 24px 0;color:#111111;">As experiências imersivas têm vagas limitadas e a ordem de escolha acompanha a ordem dos lotes. Quem chega primeiro escolhe primeiro as suas experiências de aprendizagem.</p>`;

function isMeaningfulHtml(text: string | null | undefined): boolean {
  if (!text) return false;
  const stripped = text.replace(/<[^>]*>/g, "").trim();
  return stripped.length > 0;
}

function linkedInBlock(
  curso: string,
  certUrl: string,
  customInner?: string | null,
  ctaUrl?: string | null,
  ctaLabel?: string | null,
): string {
  const autoUrl = "https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME" +
    `&name=${encodeURIComponent(curso)}` +
    `&organizationName=${encodeURIComponent("Mind Institute")}` +
    `&certUrl=${encodeURIComponent(certUrl)}` +
    "&utm_source=mind&utm_medium=email&utm_campaign=certificate_linkedin";
  const liUrl = ctaUrl && ctaUrl.trim().length > 0 ? ctaUrl : autoUrl;
  const label = ctaLabel && ctaLabel.trim().length > 0 ? ctaLabel : "Adicionar ao LinkedIn";
  const inner = isMeaningfulHtml(customInner) ? customInner! : DEFAULT_LINKEDIN_INNER;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e7e7e2;margin:40px 0 0 0;"><tr><td style="padding:32px 0 0 0;font-family:Arial,Helvetica,sans-serif;">
${inner}
${darkBtn(label, liUrl)}
</td></tr></table>`;
}

function summitBlock(
  customInner?: string | null,
  ctaUrl?: string | null,
  ctaLabel?: string | null,
): string {
  const url = ctaUrl && ctaUrl.trim().length > 0 ? ctaUrl : SUMMIT_URL;
  const label =
    ctaLabel && ctaLabel.trim().length > 0
      ? ctaLabel
      : "Garantir meu lugar no Mind Summit 2026";
  const inner = isMeaningfulHtml(customInner) ? customInner! : DEFAULT_SUMMIT_INNER;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e7e7e2;margin:40px 0 0 0;"><tr><td style="padding:32px 0 0 0;font-family:Arial,Helvetica,sans-serif;">
${inner}
${primaryBtn(label, url)}
</td></tr></table>`;
}

function signoff(): string {
  return `<p style="font-size:18px;line-height:1.6;margin:40px 0 8px 0;color:#111111;">Qualquer coisa, é só responder este email.</p><p style="font-size:18px;line-height:1.6;margin:0;color:#111111;">Time Mind</p>`;
}

interface BlockConfig {
  linkedinBlockHtml?: string | null;
  summitBlockHtml?: string | null;
  linkedinEnabled?: boolean;
  linkedinCtaUrl?: string | null;
  linkedinCtaLabel?: string | null;
  summitEnabled?: boolean;
  summitCtaUrl?: string | null;
  summitCtaLabel?: string | null;
}

/**
 * Picks the box config matching the email kind from the full template record
 * (which carries both post_issuance_* and reissuance_* fields). Falls back to
 * legacy shared columns if the per-email column is null so old templates keep
 * working.
 */
function pickBlockConfig(
  kind: "post_issuance" | "reissuance",
  tpl: Record<string, unknown>,
): BlockConfig {
  const get = (k: string) => tpl[k] as string | boolean | null | undefined;
  if (kind === "post_issuance") {
    return {
      linkedinBlockHtml:
        (get("post_issuance_linkedin_html") as string | null) ??
        (get("linkedin_block_html") as string | null) ??
        null,
      summitBlockHtml:
        (get("post_issuance_summit_html") as string | null) ??
        (get("summit_block_html") as string | null) ??
        null,
      linkedinEnabled:
        (get("post_issuance_linkedin_enabled") as boolean | null) ??
        (get("linkedin_block_enabled") as boolean | null) ??
        true,
      linkedinCtaUrl:
        (get("post_issuance_linkedin_cta_url") as string | null) ??
        (get("linkedin_block_cta_url") as string | null) ??
        null,
      linkedinCtaLabel:
        (get("post_issuance_linkedin_cta_label") as string | null) ??
        (get("linkedin_block_cta_label") as string | null) ??
        null,
      summitEnabled:
        (get("post_issuance_summit_enabled") as boolean | null) ??
        (get("summit_block_enabled") as boolean | null) ??
        true,
      summitCtaUrl:
        (get("post_issuance_summit_cta_url") as string | null) ??
        (get("summit_block_cta_url") as string | null) ??
        null,
      summitCtaLabel:
        (get("post_issuance_summit_cta_label") as string | null) ??
        (get("summit_block_cta_label") as string | null) ??
        null,
    };
  }
  return {
    linkedinBlockHtml:
      (get("reissuance_linkedin_html") as string | null) ??
      (get("linkedin_block_html") as string | null) ??
      null,
    summitBlockHtml:
      (get("reissuance_summit_html") as string | null) ??
      (get("summit_block_html") as string | null) ??
      null,
    linkedinEnabled:
      (get("reissuance_linkedin_enabled") as boolean | null) ??
      (get("linkedin_block_enabled") as boolean | null) ??
      true,
    linkedinCtaUrl:
      (get("reissuance_linkedin_cta_url") as string | null) ??
      (get("linkedin_block_cta_url") as string | null) ??
      null,
    linkedinCtaLabel:
      (get("reissuance_linkedin_cta_label") as string | null) ??
      (get("linkedin_block_cta_label") as string | null) ??
      null,
    summitEnabled:
      (get("reissuance_summit_enabled") as boolean | null) ??
      (get("summit_block_enabled") as boolean | null) ??
      true,
    summitCtaUrl:
      (get("reissuance_summit_cta_url") as string | null) ??
      (get("summit_block_cta_url") as string | null) ??
      null,
    summitCtaLabel:
      (get("reissuance_summit_cta_label") as string | null) ??
      (get("summit_block_cta_label") as string | null) ??
      null,
  };
}

function renderWithBoxes(
  bodyText: string,
  vars: Record<string, string>,
  cfg: BlockConfig = {},
): string {
  const withVars = sub(bodyText, vars);
  let inner = paragraphs(withVars);
  const linkedInInner = cfg.linkedinBlockHtml ? sub(cfg.linkedinBlockHtml, vars) : null;
  const summitInner = cfg.summitBlockHtml ? sub(cfg.summitBlockHtml, vars) : null;
  const linkedinEnabled = cfg.linkedinEnabled !== false;
  const summitEnabled = cfg.summitEnabled !== false;
  if (vars.certificate_url) {
    const utmUrl = vars.certificate_url + (vars.certificate_url.includes("?") ? "&" : "?") + "utm_source=mind&utm_medium=email&utm_campaign=certificate_access";
    inner += "\n" + primaryBtn("Acessar certificado", utmUrl);
    if (linkedinEnabled) {
      inner +=
        "\n" +
        linkedInBlock(
          vars.curso,
          vars.certificate_url,
          linkedInInner,
          cfg.linkedinCtaUrl,
          cfg.linkedinCtaLabel,
        );
    }
  }
  if (summitEnabled) {
    inner += "\n" + summitBlock(summitInner, cfg.summitCtaUrl, cfg.summitCtaLabel);
  }
  inner += "\n" + signoff();
  return shell(inner);
}

async function accredibleApi(path: string, init: RequestInit & { query?: Record<string, string> } = {}) {
  const key = Deno.env.get("ACCREDIBLE_API_KEY");
  if (!key) throw new Error("ACCREDIBLE_API_KEY não configurada");
  const qs = init.query ? "?" + new URLSearchParams(init.query).toString() : "";
  const res = await fetch(`${ACCREDIBLE_BASE}${path}${qs}`, {
    ...init,
    headers: { "Authorization": `Token token="${key}"`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Accredible ${res.status} ${path}: ${await res.text()}`);
  return await res.json();
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
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return htmlResp(errorPage("Link inválido."), 400);

  try {
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: recipient, error: recErr } = await supabase
      .from("cert_recipients")
      .select("*, cert_course_templates(course_name, accredible_group_id, post_issuance_subject, post_issuance_body_text, reissuance_subject, reissuance_body_text, linkedin_block_html, summit_block_html, linkedin_block_enabled, linkedin_block_cta_url, linkedin_block_cta_label, summit_block_enabled, summit_block_cta_url, summit_block_cta_label, post_issuance_linkedin_enabled, post_issuance_linkedin_html, post_issuance_linkedin_cta_url, post_issuance_linkedin_cta_label, post_issuance_summit_enabled, post_issuance_summit_html, post_issuance_summit_cta_url, post_issuance_summit_cta_label, reissuance_linkedin_enabled, reissuance_linkedin_html, reissuance_linkedin_cta_url, reissuance_linkedin_cta_label, reissuance_summit_enabled, reissuance_summit_html, reissuance_summit_cta_url, reissuance_summit_cta_label)")
      .eq("claim_token", token)
      .maybeSingle();
    if (recErr) throw recErr;
    if (!recipient) return htmlResp(errorPage("Esse link de certificado não foi encontrado."), 404);

    const tpl = (recipient as any).cert_course_templates;
    const groupId = Number(tpl.accredible_group_id);

    if (recipient.status === "pending" || recipient.status === "announced") {
      await supabase.from("cert_recipients").update({ status: "claimed", claimed_at: new Date().toISOString() }).eq("id", recipient.id);
    }

    let credentialUrl = recipient.certificate_url;
    let credentialId = recipient.accredible_credential_id;

    if (!credentialUrl) {
      // Verifica se já existe
      const found = await accredibleApi("/all_credentials", { query: { email: recipient.email, group_id: String(groupId), full_view: "true" } });
      const existing = found.credentials?.[0];
      if (existing) {
        credentialUrl = existing.url;
        credentialId = String(existing.id);
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const created = await accredibleApi("/credentials", {
          method: "POST",
          body: JSON.stringify({
            credential: {
              group_id: groupId,
              recipient: { name: recipient.certificate_name, email: recipient.email },
              issued_on: today,
              complete: true,
            },
          }),
        });
        credentialUrl = created.credential.url;
        credentialId = String(created.credential.id);
      }
      await supabase.from("cert_recipients").update({
        accredible_credential_id: credentialId,
        certificate_url: credentialUrl,
        certificate_issued_at: new Date().toISOString(),
        status: "issued",
      }).eq("id", recipient.id);
    }

    if (!recipient.post_issuance_sent_at) {
      try {
        const data = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
        const vars = {
          primeiro_nome: recipient.first_name,
          nome_certificado: recipient.certificate_name,
          curso: tpl.course_name,
          certificate_url: credentialUrl!,
          data_emissao: data,
        };
        const subject = sub(tpl.post_issuance_subject, vars);
        const html = renderWithBoxes(
          tpl.post_issuance_body_text,
          vars,
          pickBlockConfig("post_issuance", tpl),
        );
        const send = await sendResend(recipient.email, subject, html);
        await supabase.from("cert_email_log").insert({ recipient_id: recipient.id, email_type: "post_issuance", to_email: recipient.email, subject, status: "sent", provider_id: send.id });
        await supabase.from("cert_recipients").update({ post_issuance_sent_at: new Date().toISOString(), status: "sent" }).eq("id", recipient.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await supabase.from("cert_email_log").insert({ recipient_id: recipient.id, email_type: "post_issuance", to_email: recipient.email, subject: "(falha pós-emissão)", status: "failed", error_message: msg });
      }
    }

    const redirectUrl = credentialUrl! + (credentialUrl!.includes("?") ? "&" : "?") + "utm_source=mind&utm_medium=email&utm_campaign=certificate_claim";
    return new Response(null, { status: 302, headers: { ...CORS, "Location": redirectUrl } });
  } catch (err) {
    return htmlResp(errorPage(err instanceof Error ? err.message : String(err)), 500);
  }
});
