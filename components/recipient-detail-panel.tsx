"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { StatusBadge } from "@/components/status-badge";
import type { CourseTemplate, EmailLog, Recipient } from "@/lib/types";

interface Props {
  recipient: Recipient;
  course: CourseTemplate | undefined;
  onClose: () => void;
  onChanged: () => void;
}

export function RecipientDetailPanel({
  recipient,
  course,
  onClose,
  onChanged,
}: Props) {
  const toast = useToast();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingLogs(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("cert_email_log")
        .select("*")
        .eq("recipient_id", recipient.id)
        .order("sent_at", { ascending: false });
      if (active) {
        setLogs((data as EmailLog[]) ?? []);
        setLoadingLogs(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [recipient.id]);

  async function reprocessRecipient() {
    if (
      !confirm(
        `Reprocessar ${recipient.email}? Vou verificar no Accredible e enviar o email correto (anúncio ou reenvio).`,
      )
    )
      return;
    setResending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.functions.invoke(
        "check-existing-credential",
        {
          body: { recipient_ids: [recipient.id] },
        },
      );
      if (error) {
        toast.error(`Falha: ${error.message}`);
      } else {
        toast.success(
          "Verificação disparada via Zapier. Os emails vão sair em 10-30s.",
        );
        onChanged();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative ml-auto h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
        <header className="flex items-start justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">{recipient.certificate_name}</h2>
            <p className="text-xs text-gray-500">{recipient.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Status">
              <StatusBadge status={recipient.status} />
            </Info>
            <Info label="Curso">{course?.course_name ?? "—"}</Info>
            <Info label="Primeiro nome">{recipient.first_name}</Info>
            <Info label="Tentativas">{recipient.retry_count}</Info>
            <Info label="Anunciado em">
              {recipient.announcement_sent_at
                ? new Date(recipient.announcement_sent_at).toLocaleString("pt-BR")
                : "—"}
            </Info>
            <Info label="Reivindicado em">
              {recipient.claimed_at
                ? new Date(recipient.claimed_at).toLocaleString("pt-BR")
                : "—"}
            </Info>
            <Info label="Emitido em">
              {recipient.certificate_issued_at
                ? new Date(recipient.certificate_issued_at).toLocaleString("pt-BR")
                : "—"}
            </Info>
            <Info label="Pós-emissão em">
              {recipient.post_issuance_sent_at
                ? new Date(recipient.post_issuance_sent_at).toLocaleString("pt-BR")
                : "—"}
            </Info>
          </section>

          {recipient.error_message && (
            <section className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <p className="font-semibold mb-1">Último erro</p>
              <p className="whitespace-pre-wrap break-words">
                {recipient.error_message}
              </p>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold mb-2">Log de emails</h3>
            {loadingLogs ? (
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                Carregando...
              </p>
            ) : logs.length === 0 ? (
              <p className="text-xs text-gray-400">Nenhum email registrado.</p>
            ) : (
              <ul className="space-y-2">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="border rounded-md p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {log.email_type === "announcement"
                          ? "Parabéns"
                          : log.email_type === "reissuance"
                            ? "Reenvio"
                            : "Pós-emissão"}
                      </span>
                      <span className="flex items-center gap-1 text-[11px]">
                        {log.status === "sent" ? (
                          <CheckCircle2
                            size={12}
                            className="text-emerald-600"
                          />
                        ) : (
                          <XCircle size={12} className="text-red-600" />
                        )}
                        {log.status === "sent" ? "Enviado" : "Falhou"}
                      </span>
                    </div>
                    <p className="text-gray-700">{log.subject}</p>
                    <p className="text-gray-400">
                      {new Date(log.sent_at).toLocaleString("pt-BR")}
                    </p>
                    {log.error_message && (
                      <p className="text-red-600">{log.error_message}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="px-6 py-4 border-t bg-white flex items-center justify-between gap-2">
          <button
            onClick={reprocessRecipient}
            disabled={resending}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
          >
            {resending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Reprocessar
          </button>
          {recipient.certificate_url ? (
            <a
              href={recipient.certificate_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-brand-green-mind text-brand-black hover:bg-[#54d781]"
            >
              <ExternalLink size={14} />
              Ver certificado
            </a>
          ) : (
            <span className="text-xs text-gray-400">
              Certificado ainda não emitido
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-0.5">
        {label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  );
}
