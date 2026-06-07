// Mind HTML email template renderer.
// Recebe texto puro com placeholders {{variavel}}, devolve HTML padronizado Mind.

export type EmailVars = {
  primeiro_nome: string;
  nome_certificado: string;
  curso: string;
  certificate_url?: string;
  claim_url?: string;
  data_emissao?: string;
};

export type EmailKind = "announcement" | "post_issuance" | "reissuance";

const LOGO_URL = "https://mind-institute.github.io/certificado/logo.png";
const SUMMIT_URL = "https://lp.mindsummit.com.br";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function substituteVars(text: string, vars: EmailVars): string {
  const map: Record<string, string> = {
    primeiro_nome: vars.primeiro_nome,
    nome_certificado: vars.nome_certificado,
    curso: vars.curso,
    certificate_url: vars.certificate_url ?? "",
    claim_url: vars.claim_url ?? "",
    data_emissao: vars.data_emissao ?? "",
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => map[key] ?? "");
}

function looksLikeHtml(text: string): boolean {
  const t = text.trim();
  return t.startsWith("<") || /<\w+[\s>]/.test(t);
}

function textToParagraphs(text: string): string {
  // If the body is already HTML (produced by the WYSIWYG editor), inject it
  // directly into the email shell — no markdown conversion needed.
  if (looksLikeHtml(text)) {
    return text;
  }
  // Legacy: quebra em parágrafos por linhas em branco, suporta **negrito**.
  const paragraphs = text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs
    .map((p) => {
      // Substitui **x** por <strong>x</strong> antes de escapar
      const parts = p.split(/(\*\*[^*]+\*\*)/g);
      const inner = parts
        .map((part) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return `<strong>${escapeHtml(part.slice(2, -2))}</strong>`;
          }
          // Quebras de linha simples dentro do parágrafo viram <br>
          return escapeHtml(part).replace(/\n/g, "<br>");
        })
        .join("");
      return `<p style="font-size: 18px; line-height: 1.6; margin: 0 0 16px 0; color: #111111;">${inner}</p>`;
    })
    .join("\n");
}

function shell(innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#000000;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
  <tr>
    <td align="center" style="padding:40px 24px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:24px;overflow:hidden;">
        <tr>
          <td style="padding:40px 32px;font-family:Arial,Helvetica,sans-serif;color:#111111;">
            <p style="margin:0 0 32px 0;">
              <img src="${LOGO_URL}" alt="Mind" style="height:56px;width:auto;display:block;border:0;" />
            </p>
${innerHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function primaryButton(label: string, href: string): string {
  return `<p style="margin:24px 0 0 0;">
  <a href="${href}" style="background-color:#68EE95;color:#111111;padding:14px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;font-size:16px;font-family:Arial,Helvetica,sans-serif;">
    ${escapeHtml(label)}
  </a>
</p>`;
}

function darkButton(label: string, href: string): string {
  return `<p style="margin:0;">
  <a href="${href}" style="background-color:#111111;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;font-size:16px;font-family:Arial,Helvetica,sans-serif;">
    ${escapeHtml(label)}
  </a>
</p>`;
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
  courseName: string,
  certUrl: string,
  customInner?: string | null,
  ctaUrl?: string | null,
  ctaLabel?: string | null,
): string {
  const autoUrl =
    "https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME" +
    `&name=${encodeURIComponent(courseName)}` +
    `&organizationName=${encodeURIComponent("Mind Institute")}` +
    `&certUrl=${encodeURIComponent(certUrl)}` +
    "&utm_source=mind&utm_medium=email&utm_campaign=certificate_linkedin";
  const liUrl = ctaUrl && ctaUrl.trim().length > 0 ? ctaUrl : autoUrl;
  const label =
    ctaLabel && ctaLabel.trim().length > 0 ? ctaLabel : "Adicionar ao LinkedIn";
  const inner = isMeaningfulHtml(customInner) ? customInner! : DEFAULT_LINKEDIN_INNER;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e7e7e2;margin:40px 0 0 0;">
  <tr>
    <td style="padding:32px 0 0 0;font-family:Arial,Helvetica,sans-serif;">
      ${inner}
      ${darkButton(label, liUrl)}
    </td>
  </tr>
</table>`;
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
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e7e7e2;margin:40px 0 0 0;">
  <tr>
    <td style="padding:32px 0 0 0;font-family:Arial,Helvetica,sans-serif;">
      ${inner}
      ${primaryButton(label, url)}
    </td>
  </tr>
</table>`;
}

function signoff(): string {
  return `<p style="font-size:18px;line-height:1.6;margin:40px 0 8px 0;color:#111111;">Qualquer coisa, é só responder este email.</p>
<p style="font-size:18px;line-height:1.6;margin:0;color:#111111;">Time Mind</p>`;
}

/**
 * Renderiza um email completo no padrão Mind.
 *
 * @param kind "announcement" → mostra botão "Acessar certificado" apontando pra claim_url.
 *             "post_issuance" → mostra botão "Acessar certificado" apontando pra certificate_url +
 *             blocos LinkedIn e Mind Summit.
 * @param bodyText Texto puro escrito pela Adriana. Pode conter {{variaveis}}.
 * @param vars Valores das variáveis.
 */
/**
 * Per-email-kind block config. The full template record carries all 16 fields
 * (8 per email kind) and `renderEmail` picks the matching pair based on `kind`.
 */
export interface TemplateBlocks {
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
  blocks: TemplateBlocks | undefined,
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

export function renderEmail(
  kind: EmailKind,
  bodyText: string,
  vars: EmailVars,
  blocks?: TemplateBlocks,
): { subject: string; html: string } {
  const bodyWithVars = substituteVars(bodyText, vars);
  const paragraphs = textToParagraphs(bodyWithVars);

  let inner = paragraphs;

  if (kind === "announcement") {
    if (vars.claim_url) {
      inner += "\n" + primaryButton("Acessar certificado", vars.claim_url);
    }
    inner += "\n" + signoff();
    return {
      subject: "",
      html: shell(inner),
    };
  }

  // post_issuance or reissuance — both render the boxes, picked per-kind.
  const boxes = pickBoxes(kind, blocks);
  const linkedInInner = boxes.linkedinHtml
    ? substituteVars(boxes.linkedinHtml, vars)
    : null;
  const summitInner = boxes.summitHtml
    ? substituteVars(boxes.summitHtml, vars)
    : null;

  if (vars.certificate_url) {
    const utmUrl =
      vars.certificate_url +
      (vars.certificate_url.includes("?") ? "&" : "?") +
      "utm_source=mind&utm_medium=email&utm_campaign=certificate_access";
    inner += "\n" + primaryButton("Acessar certificado", utmUrl);
    if (boxes.linkedinEnabled) {
      inner +=
        "\n" +
        linkedInBlock(
          vars.curso,
          vars.certificate_url,
          linkedInInner,
          boxes.linkedinCtaUrl,
          boxes.linkedinCtaLabel,
        );
    }
  }
  if (boxes.summitEnabled) {
    inner +=
      "\n" +
      summitBlock(summitInner, boxes.summitCtaUrl, boxes.summitCtaLabel);
  }
  inner += "\n" + signoff();

  return {
    subject: "", // assunto vem do template do Supabase, renderizado separadamente
    html: shell(inner),
  };
}

/** Renderiza apenas o assunto (substitui variáveis). */
export function renderSubject(subjectText: string, vars: EmailVars): string {
  return substituteVars(subjectText, vars);
}
