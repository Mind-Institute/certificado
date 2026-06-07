// claim-certificate v3 — usa Zapier ao invés da API direta do Accredible
// GET /claim-certificate?token=<claim_token>
// v3: mensagem de sucesso acolhedora na página de espera (mantém auto-redirect)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

function htmlResp(html: string, status = 200) {
  return new Response(html, { status, headers: { ...CORS, "Content-Type": "text/html; charset=utf-8" } });
}

function errorPage(msg: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Mind</title><style>body{margin:0;background:#000;color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px;}.card{background:#fff;color:#111;padding:40px;border-radius:24px;max-width:480px;}h1{font-size:22px;margin:0 0 16px;}</style></head><body><div class="card"><h1>Não conseguimos abrir seu certificado</h1><p>${msg}</p><p>Responda o email de origem que a gente te ajuda.</p></div></body></html>`;
}

function preparingPage(token: string, appUrl: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Certificado em emissão</title><style>body{margin:0;background:#000;color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px;}.card{background:#fff;color:#111;padding:48px 40px;border-radius:24px;max-width:480px;}h1{font-size:24px;margin:0 0 16px;}p{font-size:16px;line-height:1.55;margin:0 0 12px;color:#444;}.check{width:56px;height:56px;border-radius:50%;background:#68EE95;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:30px;color:#111;font-weight:bold;line-height:1;}.muted{font-size:14px;color:#888;margin-top:20px;}.spinner{width:18px;height:18px;border:3px solid #e7e7e2;border-top-color:#68EE95;border-radius:50%;animation:spin 1s linear infinite;display:inline-block;vertical-align:middle;margin-right:8px;}@keyframes spin{to{transform:rotate(360deg);}}</style></head><body><div class="card"><div class="check">✓</div><h1>Pronto! Recebemos sua solicitação</h1><p>Seu certificado está sendo emitido e você vai recebê-lo em <strong>outro e-mail</strong>, em instantes.</p><p>Se não encontrar, confira também o spam e as promoções.</p><p class="muted"><span class="spinner"></span>Abrindo seu certificado nesta tela...</p></div><script>setTimeout(()=>location.reload(),5000);</script></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return htmlResp(errorPage("Link inválido (token ausente)."), 400);

  try {
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appUrl = Deno.env.get("APP_URL") ?? "https://mind-certificados.vercel.app";
    const zapierWebhook = Deno.env.get("ZAPIER_WEBHOOK_URL");
    const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: recipient, error: recErr } = await supabase
      .from("cert_recipients")
      .select("*, cert_course_templates(course_name, accredible_group_id, accredible_group_identifier, post_issuance_subject, post_issuance_body_text)")
      .eq("claim_token", token)
      .maybeSingle();
    if (recErr) throw recErr;
    if (!recipient) return htmlResp(errorPage("Esse link de certificado não foi encontrado."), 404);

    const tpl = (recipient as any).cert_course_templates;

    if (recipient.status === "pending" || recipient.status === "announced") {
      await supabase.from("cert_recipients").update({ status: "claimed", claimed_at: new Date().toISOString() }).eq("id", recipient.id);
    }

    // CASO 1: Já temos a URL do certificado (caminho feliz - apenas redireciona)
    if (recipient.certificate_url) {
      const redirectUrl = recipient.certificate_url + (recipient.certificate_url.includes("?") ? "&" : "?") + "utm_source=mind&utm_medium=email&utm_campaign=certificate_claim";
      return new Response(null, { status: 302, headers: { ...CORS, "Location": redirectUrl } });
    }

    // CASO 2: Ainda não tem URL - dispara Zapier (se ainda não disparou) e mostra página preparando
    if (!recipient.issuance_requested_at) {
      if (!zapierWebhook) {
        return htmlResp(errorPage("Sistema ainda não configurado (Zapier webhook). Avise a Mind."), 503);
      }
      const callbackUrl = `${supaUrl}/functions/v1/zapier-callback`;
      try {
        await fetch(zapierWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_id: recipient.id,
            callback_token: recipient.callback_token,
            callback_url: callbackUrl,
            recipient_name: recipient.certificate_name,
            recipient_email: recipient.email,
            cohort_name: tpl.accredible_group_identifier,
            group_id: tpl.accredible_group_id,
            course_name: tpl.course_name,
            issued_on: new Date().toISOString().slice(0, 10),
          }),
        });
        await supabase
          .from("cert_recipients")
          .update({ status: "pending_issuance", issuance_requested_at: new Date().toISOString() })
          .eq("id", recipient.id);
      } catch (zerr) {
        const msg = zerr instanceof Error ? zerr.message : String(zerr);
        await supabase.from("cert_recipients").update({ status: "failed", error_message: `Zapier webhook falhou: ${msg}` }).eq("id", recipient.id);
        return htmlResp(errorPage("Não conseguimos disparar a emissão agora. Tente em alguns minutos."), 502);
      }
    }

    return htmlResp(preparingPage(token, appUrl), 200);
  } catch (err) {
    return htmlResp(errorPage(err instanceof Error ? err.message : String(err)), 500);
  }
});
