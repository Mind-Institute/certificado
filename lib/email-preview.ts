import type { EmailPreviewVars } from "./types";

const LOGO_URL = "https://mind-institute.github.io/certificado/logo.png";
const BRAND_GREEN = "#68EE95";
const BRAND_BLACK = "#000000";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function substitute(text: string, vars: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), value ?? "");
  }
  return out;
}

function looksLikeHtml(text: string): boolean {
  return /<\w+[\s>]/.test(text);
}

function legacyTextToHtml(text: string): string {
  // Legacy markdown-ish path: paragraphs separated by blank lines, **bold**.
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const parts = paragraph.split(/(\*\*[^*]+\*\*)/g);
      const inner = parts
        .map((part) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`;
          }
          return escapeHtml(part).replace(/\n/g, "<br/>");
        })
        .join("");
      return `<p style="margin:0 0 16px 0; font-size:16px; line-height:1.6; color:#111111;">${inner}</p>`;
    })
    .join("");
}

function textToHtml(text: string): string {
  if (!text) return "";
  // HTML mode: inject as-is — the editor already produced clean HTML.
  if (looksLikeHtml(text)) {
    return text;
  }
  // Legacy markdown-style fallback.
  return legacyTextToHtml(text);
}

function wrap(innerHtml: string, ctaHtml: string = "", footerHtml: string = "") {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mind</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f4; font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background-color:#ffffff; border-radius:12px; overflow:hidden;">
            <tr>
              <td style="background-color:${BRAND_BLACK}; padding:32px; text-align:center;">
                <img src="${LOGO_URL}" alt="Mind" width="120" style="max-width:120px; height:auto; display:inline-block;" />
              </td>
            </tr>
            <tr>
              <td style="padding:40px 32px 24px 32px;">
                ${innerHtml}
                ${ctaHtml}
              </td>
            </tr>
            ${footerHtml}
            <tr>
              <td style="background-color:#fafafa; padding:24px 32px; text-align:center; font-size:12px; color:#666666; border-top:1px solid #eeeeee;">
                Mind Institute &middot; Este email foi enviado automaticamente.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td align="center" style="background-color:${BRAND_GREEN}; border-radius:8px;">
          <a href="${url}" style="display:inline-block; padding:14px 28px; font-size:16px; font-weight:600; color:${BRAND_BLACK}; text-decoration:none;">${label}</a>
        </td>
      </tr>
    </table>`;
}

const DEFAULT_LINKEDIN_INNER = `<h3 style="margin:0 0 8px 0; font-size:18px; color:#111111;">Compartilhe no LinkedIn</h3>
<p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#555555;">Adicione esse reconhecimento ao seu perfil profissional em poucos cliques.</p>`;

const DEFAULT_SUMMIT_INNER = `<h3 style="margin:0 0 8px 0; font-size:18px; color:${BRAND_GREEN};">Mind Summit</h3>
<p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#dddddd;">Continue sua jornada com a gente. O Mind Summit reúne quem está construindo o futuro.</p>`;

function isMeaningfulHtml(text: string | null | undefined): boolean {
  if (!text) return false;
  const stripped = text.replace(/<[^>]*>/g, "").trim();
  // TipTap empty doc is "<p></p>" → stripped is "".
  return stripped.length > 0;
}

function linkedInBlock(
  certificateUrl: string,
  customInner?: string | null,
  ctaUrl?: string | null,
  ctaLabel?: string | null,
): string {
  const safeUrl = encodeURIComponent(certificateUrl);
  const autoLinkedInUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=Mind&organizationName=Mind&certUrl=${safeUrl}`;
  const effectiveUrl = ctaUrl && ctaUrl.trim().length > 0 ? ctaUrl : autoLinkedInUrl;
  const effectiveLabel =
    ctaLabel && ctaLabel.trim().length > 0 ? ctaLabel : "Adicionar ao LinkedIn";
  const inner = isMeaningfulHtml(customInner) ? customInner! : DEFAULT_LINKEDIN_INNER;
  return `
    <tr>
      <td style="padding:0 32px 32px 32px;">
        <div style="background-color:#f9f9f9; border:1px solid #eeeeee; border-radius:8px; padding:24px;">
          ${inner}
          <a href="${effectiveUrl}" style="display:inline-block; padding:10px 20px; background-color:#0a66c2; color:#ffffff; text-decoration:none; border-radius:6px; font-size:14px; font-weight:600;">${effectiveLabel}</a>
        </div>
      </td>
    </tr>`;
}

function summitBlock(
  customInner?: string | null,
  ctaUrl?: string | null,
  ctaLabel?: string | null,
): string {
  const effectiveUrl =
    ctaUrl && ctaUrl.trim().length > 0 ? ctaUrl : "https://lp.mindsummit.com.br";
  const effectiveLabel =
    ctaLabel && ctaLabel.trim().length > 0
      ? ctaLabel
      : "Garantir meu lugar no Mind Summit 2026";
  const inner = isMeaningfulHtml(customInner) ? customInner! : DEFAULT_SUMMIT_INNER;
  return `
    <tr>
      <td style="padding:0 32px 32px 32px;">
        <div style="background-color:${BRAND_BLACK}; color:#ffffff; border-radius:8px; padding:24px;">
          ${inner}
          <a href="${effectiveUrl}" style="display:inline-block; padding:10px 20px; background-color:${BRAND_GREEN}; color:${BRAND_BLACK}; text-decoration:none; border-radius:6px; font-size:14px; font-weight:600;">${effectiveLabel}</a>
        </div>
      </td>
    </tr>`;
}

/**
 * Per-email-kind block config. The form passes all 16 fields (8 for
 * post_issuance + 8 for reissuance) and the renderer picks the matching pair
 * based on `kind`.
 */
export interface RenderEmailPreviewBlocks {
  post_issuance_linkedin_enabled?: boolean;
  post_issuance_linkedin_html?: string | null;
  post_issuance_linkedin_cta_url?: string | null;
  post_issuance_linkedin_cta_label?: string | null;
  post_issuance_summit_enabled?: boolean;
  post_issuance_summit_html?: string | null;
  post_issuance_summit_cta_url?: string | null;
  post_issuance_summit_cta_label?: string | null;
  reissuance_linkedin_enabled?: boolean;
  reissuance_linkedin_html?: string | null;
  reissuance_linkedin_cta_url?: string | null;
  reissuance_linkedin_cta_label?: string | null;
  reissuance_summit_enabled?: boolean;
  reissuance_summit_html?: string | null;
  reissuance_summit_cta_url?: string | null;
  reissuance_summit_cta_label?: string | null;
}

interface ResolvedBoxes {
  linkedinEnabled: boolean;
  linkedinHtml: string | null | undefined;
  linkedinCtaUrl: string | null | undefined;
  linkedinCtaLabel: string | null | undefined;
  summitEnabled: boolean;
  summitHtml: string | null | undefined;
  summitCtaUrl: string | null | undefined;
  summitCtaLabel: string | null | undefined;
}

function pickBoxes(
  kind: "post_issuance" | "reissuance",
  blocks: RenderEmailPreviewBlocks | undefined,
): ResolvedBoxes {
  if (kind === "post_issuance") {
    return {
      linkedinEnabled: blocks?.post_issuance_linkedin_enabled !== false,
      linkedinHtml: blocks?.post_issuance_linkedin_html,
      linkedinCtaUrl: blocks?.post_issuance_linkedin_cta_url,
      linkedinCtaLabel: blocks?.post_issuance_linkedin_cta_label,
      summitEnabled: blocks?.post_issuance_summit_enabled !== false,
      summitHtml: blocks?.post_issuance_summit_html,
      summitCtaUrl: blocks?.post_issuance_summit_cta_url,
      summitCtaLabel: blocks?.post_issuance_summit_cta_label,
    };
  }
  return {
    linkedinEnabled: blocks?.reissuance_linkedin_enabled !== false,
    linkedinHtml: blocks?.reissuance_linkedin_html,
    linkedinCtaUrl: blocks?.reissuance_linkedin_cta_url,
    linkedinCtaLabel: blocks?.reissuance_linkedin_cta_label,
    summitEnabled: blocks?.reissuance_summit_enabled !== false,
    summitHtml: blocks?.reissuance_summit_html,
    summitCtaUrl: blocks?.reissuance_summit_cta_url,
    summitCtaLabel: blocks?.reissuance_summit_cta_label,
  };
}

export function renderEmailPreview(
  kind: "announcement" | "post_issuance" | "reissuance",
  bodyText: string,
  vars: EmailPreviewVars,
  blocks?: RenderEmailPreviewBlocks,
): string {
  const substitutionVars: Record<string, string> = {
    primeiro_nome: vars.primeiro_nome,
    nome_certificado: vars.nome_certificado,
    curso: vars.curso,
    claim_url: vars.claim_url ?? "",
    certificate_url: vars.certificate_url ?? "",
    data_emissao: vars.data_emissao ?? "",
  };

  const substituted = substitute(bodyText, substitutionVars);
  const innerHtml = textToHtml(substituted);

  if (kind === "announcement") {
    const cta = vars.claim_url ? ctaButton("Reivindicar certificado", vars.claim_url) : "";
    return wrap(innerHtml, cta);
  }

  const boxes = pickBoxes(kind, blocks);

  // Apply variable substitution to the custom block HTML too, so {{curso}} /
  // {{primeiro_nome}} placeholders in the editable boxes get filled in preview.
  const linkedInInner = boxes.linkedinHtml
    ? substitute(boxes.linkedinHtml, substitutionVars)
    : null;
  const summitInner = boxes.summitHtml
    ? substitute(boxes.summitHtml, substitutionVars)
    : null;

  if (kind === "reissuance") {
    const cta = vars.certificate_url
      ? ctaButton("Acessar certificado", vars.certificate_url)
      : "";
    const linkedIn =
      boxes.linkedinEnabled && vars.certificate_url
        ? linkedInBlock(
            vars.certificate_url,
            linkedInInner,
            boxes.linkedinCtaUrl,
            boxes.linkedinCtaLabel,
          )
        : "";
    const summit = boxes.summitEnabled
      ? summitBlock(summitInner, boxes.summitCtaUrl, boxes.summitCtaLabel)
      : "";
    const footerExtras = `${linkedIn}${summit}`;
    return wrap(innerHtml, cta, footerExtras);
  }

  // post_issuance
  const cta = vars.certificate_url
    ? ctaButton("Ver certificado", vars.certificate_url)
    : "";
  const linkedIn =
    boxes.linkedinEnabled && vars.certificate_url
      ? linkedInBlock(
          vars.certificate_url,
          linkedInInner,
          boxes.linkedinCtaUrl,
          boxes.linkedinCtaLabel,
        )
      : "";
  const summit = boxes.summitEnabled
    ? summitBlock(summitInner, boxes.summitCtaUrl, boxes.summitCtaLabel)
    : "";
  const footerExtras = `${linkedIn}${summit}`;
  return wrap(innerHtml, cta, footerExtras);
}
