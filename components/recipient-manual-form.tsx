"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";

interface RecipientManualFormProps {
  courseTemplateId: string;
  onAdded: () => void;
}

export function RecipientManualForm({
  courseTemplateId,
  onAdded,
}: RecipientManualFormProps) {
  const toast = useToast();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [certificateName, setCertificateName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !email.trim() || !certificateName.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Email inválido");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("cert_recipients").insert({
        course_template_id: courseTemplateId,
        first_name: firstName.trim(),
        email: email.trim().toLowerCase(),
        certificate_name: certificateName.trim(),
        status: "pending",
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Destinatário adicionado");
        setFirstName("");
        setEmail("");
        setCertificateName("");
        onAdded();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1.5fr_auto] gap-2 items-end"
    >
      <Field label="Primeiro nome">
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="input"
          placeholder="Ana"
        />
      </Field>
      <Field label="Email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="ana@empresa.com"
        />
      </Field>
      <Field label="Nome no certificado">
        <input
          type="text"
          value={certificateName}
          onChange={(e) => setCertificateName(e.target.value)}
          className="input"
          placeholder="Ana Silva Pereira"
        />
      </Field>
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-brand-green-mind text-brand-black hover:bg-[#54d781] disabled:opacity-60 h-[38px]"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        Adicionar
      </button>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid #d1d5db;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          background: #fff;
        }
        .input:focus {
          border-color: #68ee95;
          box-shadow: 0 0 0 3px rgba(104, 238, 149, 0.3);
          outline: none;
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
