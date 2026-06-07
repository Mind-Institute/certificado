"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { TemplateForm } from "@/components/template-form";
import type { AccredibleGroup, CourseTemplate } from "@/lib/types";

type CardStatus = "configured" | "incomplete" | "missing";

interface GroupCardData {
  group: AccredibleGroup;
  template: CourseTemplate | null;
  status: CardStatus;
}

function statusFor(template: CourseTemplate | null): CardStatus {
  if (!template) return "missing";
  const hasAnnouncementSubject = (template.announcement_subject ?? "").trim().length > 0;
  const hasAnnouncementBody = (template.announcement_body_text ?? "").trim().length > 0;
  if (template.is_active && hasAnnouncementSubject && hasAnnouncementBody) {
    return "configured";
  }
  return "incomplete";
}

export default function TemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<CourseTemplate[]>([]);
  const [groups, setGroups] = useState<AccredibleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CourseTemplate | null>(null);
  const [preselectGroupId, setPreselectGroupId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: tpls }, { data: grps }] = await Promise.all([
      supabase
        .from("cert_course_templates")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("cert_accredible_groups")
        .select("*")
        .order("name", { ascending: true }),
    ]);
    setTemplates((tpls as CourseTemplate[]) ?? []);
    setGroups((grps as AccredibleGroup[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function syncGroups() {
    setSyncing(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke(
        "sync-accredible-groups",
        { body: {} },
      );
      if (error) {
        toast.error(`Falha ao iniciar sincronização: ${error.message}`);
      } else if ((data as any)?.error) {
        toast.error((data as any).error);
      } else {
        toast.success(
          "Sincronização disparada via Zapier. Recarregando em 5s…",
        );
        setTimeout(async () => {
          await load();
          toast.success("Grupos atualizados");
        }, 5000);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSyncing(false);
    }
  }

  /** Build one card per synced Accredible group, matched with its template (if any). */
  const cards = useMemo<GroupCardData[]>(() => {
    const byGroupId = new Map<string, CourseTemplate>();
    for (const t of templates) {
      if (t.accredible_group_id) {
        byGroupId.set(t.accredible_group_id, t);
      }
    }
    return groups.map((g) => {
      const template = byGroupId.get(g.accredible_group_id) ?? null;
      return { group: g, template, status: statusFor(template) };
    });
  }, [groups, templates]);

  function openCard(card: GroupCardData) {
    if (card.template) {
      setEditing(card.template);
      setPreselectGroupId(null);
    } else {
      setEditing(null);
      setPreselectGroupId(card.group.id);
    }
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setPreselectGroupId(null);
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Templates de curso</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure os emails de cada grupo do Accredible. Cards verdes já
            estão prontos pra emitir, cards cinza precisam dos textos dos emails.
          </p>
        </div>
        <button
          onClick={syncGroups}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          Sincronizar grupos do Accredible
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <h3 className="text-base font-semibold mb-1">Nenhum grupo sincronizado</h3>
          <p className="text-sm text-gray-500 mb-4">
            Clique em &quot;Sincronizar grupos do Accredible&quot; para puxar os
            grupos disponíveis.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <GroupCard key={c.group.id} card={c} onOpen={() => openCard(c)} />
          ))}
        </div>
      )}

      <TemplateForm
        open={formOpen}
        initial={editing}
        groups={groups}
        preselectGroupId={preselectGroupId}
        onClose={closeForm}
        onSaved={async () => {
          closeForm();
          await load();
        }}
        onDeleted={async () => {
          closeForm();
          await load();
        }}
      />
    </div>
  );
}

function GroupCard({
  card,
  onOpen,
}: {
  card: GroupCardData;
  onOpen: () => void;
}) {
  const { group, status } = card;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-2 hover:border-gray-400 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-green-mind"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-base text-brand-black line-clamp-2">
            {group.course_name || group.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {group.accredible_group_identifier}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>
      {group.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mt-1">
          {group.description}
        </p>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: CardStatus }) {
  if (status === "configured") {
    return (
      <span
        className={clsx(
          "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0",
          "bg-brand-green-mind text-brand-black",
        )}
      >
        <Check size={12} />
        Configurado
      </span>
    );
  }
  if (status === "incomplete") {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-800">
        Incompleto
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 bg-gray-200 text-gray-600">
      Configurar emails
    </span>
  );
}
