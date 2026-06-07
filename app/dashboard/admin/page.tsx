"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Shield,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import type { AllowedUser, AllowedUserRole } from "@/lib/types";

function formatRelative(value: string | null): string {
  if (!value) return "Nunca";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return date.toLocaleString("pt-BR");
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "agora mesmo";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min atrás`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h atrás`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} d atrás`;
  return date.toLocaleDateString("pt-BR");
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

export default function AdminPage() {
  const router = useRouter();
  const toast = useToast();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<AllowedUserRole>("user");
  const [submitting, setSubmitting] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("cert_allowed_users")
      .select("email, role, full_name, added_at, last_signed_in_at")
      .order("added_at", { ascending: false });
    if (error) {
      toast.error(`Erro ao carregar usuários: ${error.message}`);
    } else {
      setUsers((data as AllowedUser[]) ?? []);
    }
    setLoading(false);
  }, [toast]);

  // Bootstrap: check current user is admin
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email?.toLowerCase() ?? null;
      if (!email) {
        if (!cancelled) router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("cert_allowed_users")
        .select("role")
        .eq("email", email)
        .maybeSingle();
      const role = (data?.role as AllowedUserRole | undefined) ?? null;
      if (cancelled) return;
      if (role !== "admin") {
        router.replace("/dashboard/templates");
        return;
      }
      setCurrentEmail(email);
      setBootstrapping(false);
      load();
    })();
    return () => {
      cancelled = true;
    };
  }, [router, load]);

  const sortedUsers = useMemo(() => users, [users]);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    const email = formEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Email é obrigatório.");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("cert_allowed_users").insert({
      email,
      full_name: formName.trim() || null,
      role: formRole,
    });
    setSubmitting(false);
    if (error) {
      toast.error(`Falha ao adicionar: ${error.message}`);
      return;
    }
    toast.success(`${email} adicionado`);
    setFormEmail("");
    setFormName("");
    setFormRole("user");
    setShowForm(false);
    load();
  }

  async function toggleRole(user: AllowedUser) {
    if (user.email === currentEmail) {
      toast.error("Você não pode alterar seu próprio papel.");
      return;
    }
    const nextRole: AllowedUserRole =
      user.role === "admin" ? "user" : "admin";
    setBusyEmail(user.email);
    const supabase = createClient();
    const { error } = await supabase
      .from("cert_allowed_users")
      .update({ role: nextRole })
      .eq("email", user.email);
    setBusyEmail(null);
    if (error) {
      toast.error(`Falha ao alterar papel: ${error.message}`);
      return;
    }
    toast.success(`${user.email} agora é ${nextRole}`);
    load();
  }

  async function removeUser(user: AllowedUser) {
    if (user.email === currentEmail) {
      toast.error("Você não pode remover seu próprio acesso.");
      return;
    }
    if (!confirm(`Remover acesso de ${user.email}?`)) return;
    setBusyEmail(user.email);
    const supabase = createClient();
    const { error } = await supabase
      .from("cert_allowed_users")
      .delete()
      .eq("email", user.email);
    setBusyEmail(null);
    if (error) {
      toast.error(`Falha ao remover: ${error.message}`);
      return;
    }
    toast.success(`${user.email} removido`);
    load();
  }

  if (bootstrapping) {
    return (
      <div className="p-10 flex items-center gap-3 text-gray-500">
        <Loader2 size={18} className="animate-spin" />
        Verificando permissões…
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-brand-black flex items-center gap-2">
            <Shield size={22} className="text-brand-black" />
            Admin
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie quem tem acesso ao Mind Certificados.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 bg-brand-black text-white text-sm font-medium rounded-md px-4 py-2 hover:bg-black/80 transition-colors"
        >
          <Plus size={16} />
          Adicionar usuário
        </button>
      </header>

      <div className="mb-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
        <p className="font-semibold mb-2">Setup Google OAuth (uma vez):</p>
        <ol className="list-decimal list-inside space-y-1 text-xs text-gray-600 leading-relaxed">
          <li>
            Vai em{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="underline text-brand-black"
            >
              console.cloud.google.com/apis/credentials
            </a>
            , cria um OAuth 2.0 Client ID (Web Application)
            <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
              <li>
                Authorized JavaScript origins:{" "}
                <code className="bg-white px-1 rounded">
                  https://mind-certificados.vercel.app
                </code>{" "}
                +{" "}
                <code className="bg-white px-1 rounded">
                  http://localhost:3000
                </code>
              </li>
              <li>
                Authorized redirect URIs:{" "}
                <code className="bg-white px-1 rounded">
                  https://iclpvamfvffsqptbmlfv.supabase.co/auth/v1/callback
                </code>
              </li>
            </ul>
          </li>
          <li>Copia Client ID e Client Secret</li>
          <li>
            Vai em{" "}
            <a
              href="https://supabase.com/dashboard/project/iclpvamfvffsqptbmlfv/auth/providers"
              target="_blank"
              rel="noreferrer"
              className="underline text-brand-black"
            >
              Supabase &rarr; Auth &rarr; Providers
            </a>
            , habilita Google, cola Client ID e Client Secret, Save.
          </li>
          <li>Login com Google na tela de login do sistema.</li>
        </ol>
      </div>

      {showForm && (
        <form
          onSubmit={addUser}
          className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-sm font-semibold text-brand-black">
              Novo usuário autorizado
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-700"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="pessoa@joinmind.com.br"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-green-mind focus:ring-2 focus:ring-brand-green-mind/40 outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Papel
              </label>
              <select
                value={formRole}
                onChange={(e) =>
                  setFormRole(e.target.value as AllowedUserRole)
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-green-mind focus:ring-2 focus:ring-brand-green-mind/40 outline-none bg-white"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nome completo (opcional)
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Fulana da Silva"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-green-mind focus:ring-2 focus:ring-brand-green-mind/40 outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm rounded-md text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-brand-green-mind text-brand-black font-semibold hover:bg-[#54d781] transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Adicionar
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Nome</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Papel</th>
              <th className="text-left px-4 py-3 font-medium">Último login</th>
              <th className="text-left px-4 py-3 font-medium">Adicionado</th>
              <th className="text-right px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  <Loader2 size={18} className="animate-spin inline-block mr-2" />
                  Carregando…
                </td>
              </tr>
            ) : sortedUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            ) : (
              sortedUsers.map((u) => {
                const isSelf = u.email === currentEmail;
                const isBusy = busyEmail === u.email;
                return (
                  <tr
                    key={u.email}
                    className="border-t border-gray-100 hover:bg-gray-50/60"
                  >
                    <td className="px-4 py-3 text-gray-800">
                      {u.full_name ?? (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="inline-flex items-center gap-2">
                        {u.email}
                        {isSelf && (
                          <span className="text-[10px] uppercase tracking-wider text-gray-400">
                            você
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleRole(u)}
                        disabled={isSelf || isBusy}
                        title={
                          isSelf
                            ? "Não pode alterar seu próprio papel"
                            : "Clique para alternar"
                        }
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                          u.role === "admin"
                            ? "bg-brand-green-mind/20 text-emerald-700"
                            : "bg-gray-100 text-gray-700",
                          !isSelf &&
                            !isBusy &&
                            "hover:ring-2 hover:ring-brand-green-mind/40 cursor-pointer",
                          (isSelf || isBusy) && "cursor-not-allowed opacity-70",
                        )}
                      >
                        {u.role === "admin" ? (
                          <Shield size={10} />
                        ) : (
                          <UserIcon size={10} />
                        )}
                        {u.role}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatRelative(u.last_signed_in_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(u.added_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf && (
                        <button
                          onClick={() => removeUser(u)}
                          disabled={isBusy}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Remover acesso"
                          aria-label={`Remover ${u.email}`}
                        >
                          {isBusy ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
