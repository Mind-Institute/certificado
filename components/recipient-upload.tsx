"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { FileUp, Loader2, X, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";

interface ParsedRow {
  first_name: string;
  email: string;
  certificate_name: string;
}

interface RecipientUploadProps {
  courseTemplateId: string;
  onUploaded: () => void;
}

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") {
      return String(row[k]).trim();
    }
  }
  return "";
}

export function RecipientUpload({
  courseTemplateId,
  onUploaded,
}: RecipientUploadProps) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  function reset() {
    setRows([]);
    setErrors([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function downloadTemplate() {
    const content =
      "primeiro_nome,email,nome_certificado\n" +
      "Maria,maria@empresa.com,Maria Silva Santos\n" +
      "João,joao@empresa.com,João Pereira de Souza\n" +
      "Ana,ana@empresa.com,Ana Carolina Ribeiro\n";
    // BOM (﻿) garante que acentos apareçam certos ao abrir no Excel
    const blob = new Blob(["﻿" + content], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_certificados.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setRows([]);
    setErrors([]);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (result) => {
        const parsedRows: ParsedRow[] = [];
        const localErrors: string[] = [];
        result.data.forEach((raw, i) => {
          const first_name = pick(raw, "primeiro_nome", "first_name", "nome");
          const email = pick(raw, "email", "e-mail");
          const certificate_name = pick(
            raw,
            "nome_certificado",
            "certificate_name",
            "nome_completo",
          );
          if (!first_name || !email || !certificate_name) {
            localErrors.push(
              `Linha ${i + 2}: faltando campo obrigatório (primeiro_nome / email / nome_certificado).`,
            );
            return;
          }
          if (!/^\S+@\S+\.\S+$/.test(email)) {
            localErrors.push(`Linha ${i + 2}: email inválido (${email}).`);
            return;
          }
          parsedRows.push({ first_name, email: email.toLowerCase(), certificate_name });
        });
        setRows(parsedRows);
        setErrors(localErrors);
        setParsing(false);
      },
      error: (err) => {
        toast.error(`Erro ao ler CSV: ${err.message}`);
        setParsing(false);
      },
    });
  }

  async function confirmInsert() {
    if (rows.length === 0) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const payload = rows.map((r) => ({
        course_template_id: courseTemplateId,
        first_name: r.first_name,
        email: r.email,
        certificate_name: r.certificate_name,
        status: "pending" as const,
      }));
      const { error } = await supabase.from("cert_recipients").insert(payload);
      if (error) {
        toast.error(`Erro ao inserir: ${error.message}`);
      } else {
        toast.success(`${rows.length} destinatário(s) adicionado(s)`);
        reset();
        onUploaded();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          <p className="mb-1.5 font-medium text-brand-black">
            A planilha precisa ter exatamente estas 3 colunas:
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs">
            <li>
              <code className="rounded border bg-white px-1.5 py-0.5">primeiro_nome</code>{" "}
              — primeiro nome (usado na saudação do e-mail)
            </li>
            <li>
              <code className="rounded border bg-white px-1.5 py-0.5">email</code>{" "}
              — e-mail de quem recebe o certificado
            </li>
            <li>
              <code className="rounded border bg-white px-1.5 py-0.5">nome_certificado</code>{" "}
              — nome completo que aparece no certificado
            </li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            Não sabe montar? Baixe o modelo, troque os exemplos pelos dados
            reais e salve.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
          >
            <Download size={14} />
            Baixar modelo de planilha
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50">
            <FileUp size={14} />
            Selecionar arquivo
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {parsing && (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Processando...
        </p>
      )}

      {errors.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 max-h-40 overflow-y-auto">
          <p className="font-semibold mb-1">{errors.length} aviso(s):</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {errors.slice(0, 20).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b flex items-center justify-between">
            <p className="text-xs font-semibold">
              {rows.length} linha(s) válida(s)
            </p>
            <button
              onClick={reset}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-brand-black"
            >
              <X size={12} />
              Limpar
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Nome</th>
                  <th className="text-left px-3 py-2 font-semibold">Email</th>
                  <th className="text-left px-3 py-2 font-semibold">
                    Nome no certificado
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-1.5">{r.first_name}</td>
                    <td className="px-3 py-1.5">{r.email}</td>
                    <td className="px-3 py-1.5">{r.certificate_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <p className="px-3 py-2 text-xs text-gray-500 border-t bg-gray-50">
                ...e mais {rows.length - 50} linha(s)
              </p>
            )}
          </div>
          <div className="px-3 py-2 border-t bg-white flex justify-end">
            <button
              onClick={confirmInsert}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-brand-green-mind text-brand-black hover:bg-[#54d781] disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Confirmar e adicionar {rows.length}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
