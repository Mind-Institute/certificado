"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Send, Trash2, Upload, UserPlus } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { RecipientUpload } from "@/components/recipient-upload";
import { RecipientManualForm } from "@/components/recipient-manual-form";
import type { CourseTemplate, Recipient } from "@/lib/types";

type AddMode = "upload" | "manual";

export default function EmitirPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<CourseTemplate[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [mode, setMode] = useState<AddMode>("upload");
  const [pending, setPending] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadingList, setReloadingList] = useState(false);
  const [sending, setSending] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("cert_course_templates")
      .select("*")
      .eq("is_active", true)
      .order("course_name", { ascending: true });
    setTemplates((data as CourseTemplate[]) ?? []);
    setLoading(false);
  }, []);

  const loadPending = useCallback(async (courseId: string) => {
    if (!courseId) {
      setPending([]);
      return;
    }
    setReloadingList(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("cert_recipients")
      .select("*")
      .eq("course_template_id", courseId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPending((data as Recipient[]) ?? []);
    setReloadingList(false);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    loadPending(selectedCourseId);
  }, [selectedCourseId, loadPending]);

  const selectedCourse = useMemo(
    () => templates.find((t) => t.id === selectedCourseId) ?? null,
    [templates, selectedCourseId],
  );

  async function removeRecipient(id: string) {
    if (!confirm("Remover este destinatário?")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("cert_recipients")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Destinatário removido");
      await loadPending(selectedCourseId);
    }
  }

  async function processRecipients() {
    if (!selectedCourseId) return;
    if (pending.length === 0) {
      toast.error("Nenhum destinatário pendente");
      return;
    }
    if (
      !confirm(
        `Vou verificar ${pending.length} destinatários no Accredible e enviar o email correto pra cada um (anúncio se não tiver certificado, reenvio se já tiver). Confirmar?`,
      )
    ) {
      return;
    }
    setSending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.functions.invoke(
        "check-existing-credential",
        {
          body: { course_template_id: selectedCourseId },
        },
      );
      if (error) {
        toast.error(`Falha no envio: ${error.message}`);
      } else {
        toast.success(
          "Verificação disparada via Zapier. Os emails vão sair em 10-30s.",
        );
        await loadPending(selectedCourseId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Emitir certificados</h1>
        <p className="text-sm text-gray-500 mt-1">
          Adicione destinatários e processe — vamos verificar no Accredible e
          enviar o email correto pra cada um.
        </p>
      </header>

      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <label className="block text-sm font-semibold mb-2">
          Para qual curso?
        </label>
        {loading ? (
          <Loader2 className="animate-spin text-gray-400" size={18} />
        ) : (
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full md:w-1/2 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-green-mind focus:ring-2 focus:ring-brand-green-mind/40 outline-none"
          >
            <option value="">Selecione um curso ativo...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.course_name}
              </option>
            ))}
          </select>
        )}
        {!loading && templates.length === 0 && (
          <p className="text-xs text-amber-600 mt-2">
            Nenhum template ativo. Crie um na aba &quot;Templates&quot;.
          </p>
        )}
      </section>

      {selectedCourseId && (
        <>
          <section className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setMode("upload")}
                className={clsx(
                  "inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors",
                  mode === "upload"
                    ? "bg-brand-black text-white border-brand-black"
                    : "bg-white border-gray-300 hover:bg-gray-50",
                )}
              >
                <Upload size={14} />
                Subir planilha
              </button>
              <button
                onClick={() => setMode("manual")}
                className={clsx(
                  "inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors",
                  mode === "manual"
                    ? "bg-brand-black text-white border-brand-black"
                    : "bg-white border-gray-300 hover:bg-gray-50",
                )}
              >
                <UserPlus size={14} />
                Adicionar manualmente
              </button>
            </div>

            {mode === "upload" ? (
              <RecipientUpload
                courseTemplateId={selectedCourseId}
                onUploaded={() => loadPending(selectedCourseId)}
              />
            ) : (
              <RecipientManualForm
                courseTemplateId={selectedCourseId}
                onAdded={() => loadPending(selectedCourseId)}
              />
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm">
                  Destinatários pendentes ({pending.length})
                </h2>
                <p className="text-xs text-gray-500">
                  Estes ainda não receberam o email de parabéns.
                </p>
              </div>
              {reloadingList && (
                <Loader2 size={14} className="animate-spin text-gray-400" />
              )}
            </div>

            {pending.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-gray-400">
                Nenhum destinatário pendente.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="text-left px-5 py-2.5 font-semibold">Nome</th>
                      <th className="text-left px-5 py-2.5 font-semibold">Email</th>
                      <th className="text-left px-5 py-2.5 font-semibold">
                        Nome no certificado
                      </th>
                      <th className="text-right px-5 py-2.5 font-semibold">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((r) => (
                      <tr key={r.id} className="border-t hover:bg-gray-50">
                        <td className="px-5 py-2.5">{r.first_name}</td>
                        <td className="px-5 py-2.5 text-gray-600">{r.email}</td>
                        <td className="px-5 py-2.5">{r.certificate_name}</td>
                        <td className="px-5 py-2.5 text-right">
                          <button
                            onClick={() => removeRecipient(r.id)}
                            className="inline-flex items-center justify-center p-1.5 rounded hover:bg-red-50 text-red-600"
                            aria-label="Remover"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-5 py-4 border-t bg-white flex items-center justify-between gap-4">
              <p className="text-xs text-gray-500">
                Verifica se cada pessoa já tem certificado e envia o email correto
              </p>
              <button
                onClick={processRecipients}
                disabled={sending || pending.length === 0}
                title="Verifica se cada pessoa já tem certificado e envia o email correto"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-md bg-brand-green-mind text-brand-black hover:bg-[#54d781] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Processar destinatários
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
