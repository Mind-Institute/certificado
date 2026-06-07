"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/status-badge";
import { RecipientDetailPanel } from "@/components/recipient-detail-panel";
import {
  RECIPIENT_STATUS_LABELS,
  type CourseTemplate,
  type Recipient,
  type RecipientStatus,
} from "@/lib/types";

const STATUSES: RecipientStatus[] = [
  "pending",
  "announced",
  "claimed",
  "issued",
  "sent",
  "failed",
];

export default function HistoricoPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [templates, setTemplates] = useState<CourseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: rcps }, { data: tpls }] = await Promise.all([
      supabase
        .from("cert_recipients")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1000),
      supabase
        .from("cert_course_templates")
        .select("*")
        .order("course_name", { ascending: true }),
    ]);
    setRecipients((rcps as Recipient[]) ?? []);
    setTemplates((tpls as CourseTemplate[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("cert_recipients_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cert_recipients" },
        (payload) => {
          setRecipients((prev) => {
            if (payload.eventType === "INSERT") {
              return [payload.new as Recipient, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((r) =>
                r.id === (payload.new as Recipient).id
                  ? (payload.new as Recipient)
                  : r,
              );
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((r) => r.id !== (payload.old as Recipient).id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const courseMap = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipients.filter((r) => {
      if (courseFilter && r.course_template_id !== courseFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (q) {
        const hay = `${r.first_name} ${r.certificate_name} ${r.email}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [recipients, courseFilter, statusFilter, search]);

  const selected = selectedId
    ? recipients.find((r) => r.id === selectedId) ?? null
    : null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Histórico</h1>
        <p className="text-sm text-gray-500 mt-1">
          Acompanhe todos os destinatários e o status de cada certificado.
        </p>
      </header>

      <section className="bg-white rounded-xl border border-gray-200 mb-5 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Buscar
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome ou email"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-gray-300 focus:border-brand-green-mind focus:ring-2 focus:ring-brand-green-mind/40 outline-none"
            />
          </div>
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Curso
          </label>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-green-mind focus:ring-2 focus:ring-brand-green-mind/40 outline-none"
          >
            <option value="">Todos</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.course_name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-green-mind focus:ring-2 focus:ring-brand-green-mind/40 outline-none"
          >
            <option value="">Todos</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {RECIPIENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-gray-500 ml-auto py-2">
          {filtered.length} de {recipients.length}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-20">
            Nenhum destinatário encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 sticky top-0">
                <tr>
                  <th className="text-left px-5 py-2.5 font-semibold">Nome</th>
                  <th className="text-left px-5 py-2.5 font-semibold">Email</th>
                  <th className="text-left px-5 py-2.5 font-semibold">Curso</th>
                  <th className="text-left px-5 py-2.5 font-semibold">Status</th>
                  <th className="text-left px-5 py-2.5 font-semibold">
                    Atualizado
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-5 py-2.5 font-medium">
                      {r.certificate_name}
                    </td>
                    <td className="px-5 py-2.5 text-gray-600">{r.email}</td>
                    <td className="px-5 py-2.5 text-gray-600">
                      {courseMap.get(r.course_template_id)?.course_name ?? "—"}
                    </td>
                    <td className="px-5 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-2.5 text-gray-500 text-xs">
                      {new Date(r.updated_at).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <RecipientDetailPanel
          recipient={selected}
          course={courseMap.get(selected.course_template_id)}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
