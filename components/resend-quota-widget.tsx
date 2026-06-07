"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";

const DAILY_LIMIT = 100;
const MONTHLY_LIMIT = 3000;

type Counts = { today: number | null; month: number | null };

function colorFor(count: number | null, limit: number) {
  if (count === null) return "bg-white/30";
  const pct = count / limit;
  if (pct >= 0.8) return "bg-red-500";
  if (pct >= 0.5) return "bg-amber-400";
  return "bg-brand-green-mind";
}

function pct(count: number | null, limit: number) {
  if (count === null) return 0;
  return Math.min(100, Math.round((count / limit) * 100));
}

function fmt(n: number | null) {
  return n === null ? "—" : n.toLocaleString("pt-BR");
}

export function ResendQuotaWidget() {
  const [counts, setCounts] = useState<Counts>({ today: null, month: null });
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function refresh() {
      const now = new Date();
      const todayIso = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).toISOString();
      const monthIso = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();

      try {
        const [todayRes, monthRes] = await Promise.all([
          supabase
            .from("cert_email_log")
            .select("*", { count: "exact", head: true })
            .eq("status", "sent")
            .gte("sent_at", todayIso),
          supabase
            .from("cert_email_log")
            .select("*", { count: "exact", head: true })
            .eq("status", "sent")
            .gte("sent_at", monthIso),
        ]);
        if (!active) return;
        setCounts({
          today: todayRes.error ? null : (todayRes.count ?? 0),
          month: monthRes.error ? null : (monthRes.count ?? 0),
        });
      } catch {
        if (active) setCounts({ today: null, month: null });
      }
    }

    refresh();

    // Re-busca da DB a cada 60s — garante que ao cruzar meia-noite ou virada
    // de mês os contadores se reiniciam automaticamente sem precisar reload.
    const refreshInterval = setInterval(() => {
      refresh();
    }, 60_000);

    const channel = supabase
      .channel("resend-quota-widget")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cert_email_log" },
        (payload) => {
          const row = payload.new as { status?: string; sent_at?: string };
          if (row?.status !== "sent") return;
          const now = new Date();
          const startOfDay = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          ).getTime();
          const startOfMonth = new Date(
            now.getFullYear(),
            now.getMonth(),
            1,
          ).getTime();
          const sentMs = row.sent_at ? new Date(row.sent_at).getTime() : Date.now();
          setCounts((prev) => ({
            today:
              prev.today === null
                ? prev.today
                : sentMs >= startOfDay
                  ? prev.today + 1
                  : prev.today,
            month:
              prev.month === null
                ? prev.month
                : sentMs >= startOfMonth
                  ? prev.month + 1
                  : prev.month,
          }));
        },
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div
      className="relative mx-3 mb-2 rounded-md border border-white/10 bg-white/5 p-3"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/50 font-semibold mb-2">
        <Mail size={11} />
        Resend
      </div>

      <div className="space-y-2">
        <Row
          label="Hoje"
          count={counts.today}
          limit={DAILY_LIMIT}
        />
        <Row
          label="Mês"
          count={counts.month}
          limit={MONTHLY_LIMIT}
        />
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-0 right-0 mb-2 mx-3 z-50 rounded-md bg-white text-brand-black text-[11px] leading-snug p-2 shadow-lg">
          Limites do plano Free do Resend (100/dia, 3.000/mês). Conta só emails de certificado enviados pelo sistema. Magic links e outros emails via Supabase Auth contam separado no Resend.
          <br /><br />
          Reinicia automaticamente toda meia-noite (dia) e dia 1º (mês).
          {" "}
          <a
            href="https://resend.com/emails"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-600"
          >
            Ver total no Resend
          </a>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  count,
  limit,
}: {
  label: string;
  count: number | null;
  limit: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="text-white/70">{label}</span>
        <span className="font-semibold text-white tabular-nums">
          {fmt(count)}
          <span className="text-white/40 font-normal">
            {" / "}
            {limit.toLocaleString("pt-BR")}
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className={clsx(
            "h-full rounded-full transition-all",
            colorFor(count, limit),
          )}
          style={{ width: `${pct(count, limit)}%` }}
        />
      </div>
    </div>
  );
}
