"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { FileText, Send, Activity, LogOut, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ResendQuotaWidget } from "@/components/resend-quota-widget";
import type { AllowedUserRole } from "@/lib/types";

interface SidebarProps {
  userEmail: string | null;
}

const NAV = [
  { href: "/dashboard/templates", label: "Templates", icon: FileText },
  { href: "/dashboard/emitir", label: "Emitir", icon: Send },
  { href: "/dashboard/historico", label: "Histórico", icon: Activity },
];

const ADMIN_NAV = {
  href: "/dashboard/admin",
  label: "Admin",
  icon: Shield,
};

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<AllowedUserRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userEmail) {
      setRole(null);
      return;
    }
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("cert_allowed_users")
        .select("role")
        .eq("email", userEmail.toLowerCase())
        .maybeSingle();
      if (!cancelled) {
        setRole((data?.role as AllowedUserRole | undefined) ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isAdmin = role === "admin";
  const navItems = isAdmin ? [...NAV, ADMIN_NAV] : NAV;

  return (
    <aside className="w-64 shrink-0 bg-brand-black text-white flex flex-col min-h-screen">
      <div className="p-6 border-b border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://mind-institute.github.io/certificado/logo.png"
          alt="Mind"
          className="h-7 w-auto"
        />
        <p className="mt-3 text-xs uppercase tracking-wider text-brand-green-mind font-semibold">
          Certificados
        </p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                active
                  ? "bg-brand-green-mind text-brand-black font-semibold"
                  : "text-white/80 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <ResendQuotaWidget />

      <div className="p-3 border-t border-white/10">
        {userEmail && (
          <div
            className="px-3 py-2 flex items-center gap-2"
            title={userEmail}
          >
            <p className="text-xs text-white/50 truncate flex-1 min-w-0">
              {userEmail}
            </p>
            {isAdmin && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand-green-mind/20 text-brand-green-mind text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5">
                <Shield size={10} />
                Admin
              </span>
            )}
          </div>
        )}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </aside>
  );
}
