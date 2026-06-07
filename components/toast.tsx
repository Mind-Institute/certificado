"use client";

import { CheckCircle2, XCircle, Info } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import clsx from "clsx";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => remove(id), 4500);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error"),
      info: (m) => show(m, "info"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({
  toast,
  onClose,
}: {
  toast: ToastItem;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const styles =
    toast.kind === "success"
      ? "bg-brand-black text-white border-brand-green-mind"
      : toast.kind === "error"
        ? "bg-red-600 text-white border-red-700"
        : "bg-white text-brand-black border-gray-200";

  const Icon =
    toast.kind === "success"
      ? CheckCircle2
      : toast.kind === "error"
        ? XCircle
        : Info;

  const iconColor =
    toast.kind === "success" ? "text-brand-green-mind" : "text-white";

  return (
    <div
      role="status"
      className={clsx(
        "flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all duration-200",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        styles,
        "min-w-[280px] max-w-[420px]",
      )}
    >
      <Icon
        size={18}
        className={clsx(
          "mt-0.5 shrink-0",
          toast.kind === "info" ? "text-brand-black" : iconColor,
        )}
      />
      <p className="flex-1 text-sm leading-snug">{toast.message}</p>
      <button
        onClick={onClose}
        className="text-xs opacity-70 hover:opacity-100"
        aria-label="Fechar"
      >
        x
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
