"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
      />
      <path
        fill="#FF3D00"
        d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
      />
      <path
        fill="#1976D2"
        d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
      />
    </svg>
  );
}

function LoginInner() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notAuthorized = errorParam === "not_authorized";

  async function signInWithGoogle() {
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });
      if (signInError) {
        setError(signInError.message);
        setSubmitting(false);
      }
      // On success, the browser is redirected to Google — no need to clear loader.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-brand-black p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://mind-institute.github.io/certificado/logo.png"
            alt="Mind"
            className="h-12 w-auto"
          />
        </div>

        <div className="bg-white rounded-xl p-8 shadow-2xl">
          <h1 className="text-2xl font-semibold text-brand-black mb-1">
            Mind Certificados
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Acesso restrito. Sua conta precisa estar na lista de usuários
            autorizados pelo admin.
          </p>

          {notAuthorized && (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              Sua conta não está autorizada. Peça pra Adriana adicionar seu
              email.
            </div>
          )}

          {error && !notAuthorized && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            onClick={signInWithGoogle}
            disabled={submitting}
            className="w-full bg-white border border-gray-300 text-brand-black font-semibold rounded-md py-2.5 text-sm hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Redirecionando…
              </>
            ) : (
              <>
                <GoogleIcon size={18} />
                Entrar com Google
              </>
            )}
          </button>

          <p className="mt-6 text-xs text-gray-400 text-center">
            Uso interno Mind. Emails @joinmind.com.br precisam ser
            pré-autorizados.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
