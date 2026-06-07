// Cliente de envio de email via Resend.
// Docs: https://resend.com/docs/api-reference/emails/send-email

const RESEND_API_URL = "https://api.resend.com/emails";

function getResendKey(): string {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    throw new Error(
      "RESEND_API_KEY não configurada. Cole no Supabase Secrets antes de enviar emails.",
    );
  }
  return key;
}

function getFromEmail(): string {
  return Deno.env.get("FROM_EMAIL") ?? "Mind Institute <no-reply@joinmind.com.br>";
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

export type SendEmailResult = {
  id: string;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getResendKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getFromEmail(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      reply_to: input.replyTo ?? "adriana@joinmind.com.br",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text}`);
  }
  const data = await res.json() as { id: string };
  return { id: data.id };
}
