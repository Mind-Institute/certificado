import { NextResponse } from "next/server";

// Proxy da edge function claim-certificate.
// O Supabase reescreve respostas HTML de *.supabase.co para text/plain
// (proteção anti-phishing): o navegador mostrava o código-fonte da página
// "Preparando seu certificado", com acentos quebrados e sem o auto-reload.
// Aqui buscamos a resposta no servidor e devolvemos o HTML pelo domínio da Vercel.

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "https://iclpvamfvffsqptbmlfv.supabase.co";
  const target = `${supabaseUrl}/functions/v1/claim-certificate?token=${encodeURIComponent(params.token)}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, { redirect: "manual", cache: "no-store" });
  } catch {
    return htmlResponse(
      fallbackPage(
        "Não conseguimos abrir seu certificado agora. Tente novamente em alguns minutos.",
      ),
      502,
    );
  }

  // Certificado já emitido: a edge function responde 302 pro Accredible.
  const location = upstream.headers.get("location");
  if (upstream.status >= 300 && upstream.status < 400 && location) {
    return NextResponse.redirect(location, 302);
  }

  // Página de espera / erro: repassa o HTML com o Content-Type correto.
  const html = await upstream.text();
  return htmlResponse(html, upstream.status);
}

function htmlResponse(html: string, status: number) {
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function fallbackPage(msg: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Mind</title><style>body{margin:0;background:#000;color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px;}.card{background:#fff;color:#111;padding:40px;border-radius:24px;max-width:480px;}h1{font-size:22px;margin:0 0 16px;}</style></head><body><div class="card"><h1>Não conseguimos abrir seu certificado</h1><p>${msg}</p><p>Responda o email de origem que a gente te ajuda.</p></div></body></html>`;
}
