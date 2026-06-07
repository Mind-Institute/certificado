"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Braces,
  Code2,
  Eye,
  Loader2,
  Lock,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { renderEmailPreview } from "@/lib/email-preview";
import { EmailBodyEditor } from "@/components/email-body-editor";
import type { AccredibleGroup, CourseTemplate } from "@/lib/types";

interface TemplateFormProps {
  open: boolean;
  initial: CourseTemplate | null;
  groups: AccredibleGroup[];
  /**
   * When opening in "create" mode, optionally pre-select an Accredible group.
   * This is the `cert_accredible_groups.id` (UUID). Ignored when `initial` is
   * provided (edit mode uses the template's own group ref).
   */
  preselectGroupId?: string | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

type BodyKey = "announcement" | "post_issuance" | "reissuance";

const VARIABLE_LABELS: Record<string, string> = {
  primeiro_nome: "Primeiro nome",
  nome_certificado: "Nome no certificado",
  curso: "Nome do curso",
  claim_url: "Link de reivindicação",
  certificate_url: "Link do certificado",
  data_emissao: "Data de emissão",
};

const VARIABLES_BY_BODY: Record<BodyKey, string[]> = {
  announcement: ["primeiro_nome", "nome_certificado", "curso", "claim_url"],
  post_issuance: [
    "primeiro_nome",
    "nome_certificado",
    "curso",
    "certificate_url",
    "data_emissao",
  ],
  reissuance: [
    "primeiro_nome",
    "nome_certificado",
    "curso",
    "certificate_url",
    "data_emissao",
  ],
};

/**
 * Variables exposed in the small "insert variable" popover next to each
 * subject input. Subjects don't carry URLs so we narrow the lists here.
 */
const VARIABLES_BY_SUBJECT: Record<BodyKey, string[]> = {
  announcement: ["primeiro_nome", "nome_certificado", "curso"],
  post_issuance: ["primeiro_nome", "nome_certificado", "curso", "data_emissao"],
  reissuance: ["primeiro_nome", "nome_certificado", "curso", "data_emissao"],
};

function variableOptionsFor(key: BodyKey) {
  return VARIABLES_BY_BODY[key].map((k) => ({
    key: k,
    label: VARIABLE_LABELS[k] ?? k,
  }));
}

function subjectVariableOptionsFor(key: BodyKey) {
  return VARIABLES_BY_SUBJECT[key].map((k) => ({
    key: k,
    label: VARIABLE_LABELS[k] ?? k,
  }));
}

const DEFAULT_ANNOUNCEMENT = `Olá, {{primeiro_nome}}!

É com enorme alegria que reconhecemos sua trajetória em {{curso}}.

Clique no botão abaixo para reivindicar seu certificado digital.

Com carinho,
Equipe Mind`;

const DEFAULT_POST = `Olá, {{primeiro_nome}}!

Seu certificado de {{curso}} já está disponível.

Acesse, faça download e compartilhe com a sua rede.

Com carinho,
Equipe Mind`;

const DEFAULT_REISSUANCE = `Olá {{primeiro_nome}},

Seu certificado **{{curso}}** já tinha sido emitido em {{data_emissao}}.

Reenviando o link pra você poder acessar e salvar quando quiser.`;

const DEFAULT_LINKEDIN_BLOCK = `<h3 style="margin:0 0 8px 0; font-size:18px; color:#111111;">Adicione ao LinkedIn em 30 segundos</h3>
<p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#555555;">É uma excelente forma de mostrar, de maneira concreta, que você está buscando aprofundamento em liderança, cultura e saúde mental no trabalho, e de deixar isso visível para quem acompanha o seu trabalho.</p>`;

const DEFAULT_SUMMIT_BLOCK = `<h3 style="margin:0 0 8px 0; font-size:18px; color:#68EE95;">Continue a sua jornada de excelência</h3>
<p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#dddddd;">Se o certificado marca o quanto você já se aprofundou, o <strong>Mind Summit 2026</strong> é o próximo salto. Serão 2 dias presenciais em São Paulo, com palco, workshops e masterclasses organizados nas trilhas que concentram as dores reais de quem lidera hoje.</p>
<ul style="margin:0 0 16px 0; padding-left:20px; color:#dddddd; font-size:14px; line-height:1.6;">
<li>O Peso de Liderar</li>
<li>A Saúde Mental do Meu Time</li>
<li>Provar que Saúde e Bem-Estar no Trabalho Funcionam</li>
<li>NR-1 na Prática</li>
<li>IA sem Pânico</li>
<li>Cultura que Sustenta</li>
</ul>`;

const BLOCK_VARIABLES: { key: string; label: string }[] = [
  { key: "primeiro_nome", label: "Primeiro nome" },
  { key: "curso", label: "Nome do curso" },
];

export function TemplateForm({
  open,
  initial,
  groups,
  preselectGroupId,
  onClose,
  onSaved,
  onDeleted,
}: TemplateFormProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [courseName, setCourseName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [announcementSubject, setAnnouncementSubject] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [postSubject, setPostSubject] = useState("");
  const [postBody, setPostBody] = useState("");
  const [reissuanceSubject, setReissuanceSubject] = useState("");
  const [reissuanceBody, setReissuanceBody] = useState("");
  // Per-email box configs. Each email kind (post_issuance / reissuance) gets
  // its own LinkedIn and Mind Summit box settings. Naming pattern matches the
  // DB columns: `{email_type}_{box}_{field}`.
  const [postLinkedinEnabled, setPostLinkedinEnabled] = useState(true);
  const [postLinkedinHtml, setPostLinkedinHtml] = useState("");
  const [postLinkedinCtaUrl, setPostLinkedinCtaUrl] = useState("");
  const [postLinkedinCtaLabel, setPostLinkedinCtaLabel] = useState("");
  const [postSummitEnabled, setPostSummitEnabled] = useState(true);
  const [postSummitHtml, setPostSummitHtml] = useState("");
  const [postSummitCtaUrl, setPostSummitCtaUrl] = useState("");
  const [postSummitCtaLabel, setPostSummitCtaLabel] = useState("");

  const [reissuanceLinkedinEnabled, setReissuanceLinkedinEnabled] = useState(true);
  const [reissuanceLinkedinHtml, setReissuanceLinkedinHtml] = useState("");
  const [reissuanceLinkedinCtaUrl, setReissuanceLinkedinCtaUrl] = useState("");
  const [reissuanceLinkedinCtaLabel, setReissuanceLinkedinCtaLabel] = useState("");
  const [reissuanceSummitEnabled, setReissuanceSummitEnabled] = useState(true);
  const [reissuanceSummitHtml, setReissuanceSummitHtml] = useState("");
  const [reissuanceSummitCtaUrl, setReissuanceSummitCtaUrl] = useState("");
  const [reissuanceSummitCtaLabel, setReissuanceSummitCtaLabel] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [previewKind, setPreviewKind] = useState<BodyKey>("announcement");
  const [previewMode, setPreviewMode] = useState<"visual" | "html">("visual");

  // Refs for each subject input so the "insert variable" popover can target the
  // last-focused subject field and insert at its caret position.
  const announcementSubjectRef = useRef<HTMLInputElement>(null);
  const postSubjectRef = useRef<HTMLInputElement>(null);
  const reissuanceSubjectRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setCourseName(initial.course_name ?? "");
      const matched = groups.find(
        (g) => g.accredible_group_id === initial.accredible_group_id,
      );
      setSelectedGroupId(matched?.id ?? "");
      setAnnouncementSubject(initial.announcement_subject ?? "");
      setAnnouncementBody(initial.announcement_body_text ?? "");
      setPostSubject(initial.post_issuance_subject ?? "");
      setPostBody(initial.post_issuance_body_text ?? "");
      setReissuanceSubject(initial.reissuance_subject ?? "");
      setReissuanceBody(initial.reissuance_body_text ?? "");
      // Per-email box configs. Fall back to the legacy shared columns if the
      // per-email column is null (templates created before the migration ran).
      setPostLinkedinEnabled(
        initial.post_issuance_linkedin_enabled ??
          initial.linkedin_block_enabled ??
          true,
      );
      setPostLinkedinHtml(
        initial.post_issuance_linkedin_html ??
          initial.linkedin_block_html ??
          DEFAULT_LINKEDIN_BLOCK,
      );
      setPostLinkedinCtaUrl(
        initial.post_issuance_linkedin_cta_url ??
          initial.linkedin_block_cta_url ??
          "",
      );
      setPostLinkedinCtaLabel(
        initial.post_issuance_linkedin_cta_label ??
          initial.linkedin_block_cta_label ??
          "",
      );
      setPostSummitEnabled(
        initial.post_issuance_summit_enabled ??
          initial.summit_block_enabled ??
          true,
      );
      setPostSummitHtml(
        initial.post_issuance_summit_html ??
          initial.summit_block_html ??
          DEFAULT_SUMMIT_BLOCK,
      );
      setPostSummitCtaUrl(
        initial.post_issuance_summit_cta_url ??
          initial.summit_block_cta_url ??
          "",
      );
      setPostSummitCtaLabel(
        initial.post_issuance_summit_cta_label ??
          initial.summit_block_cta_label ??
          "",
      );

      setReissuanceLinkedinEnabled(
        initial.reissuance_linkedin_enabled ??
          initial.linkedin_block_enabled ??
          true,
      );
      setReissuanceLinkedinHtml(
        initial.reissuance_linkedin_html ??
          initial.linkedin_block_html ??
          DEFAULT_LINKEDIN_BLOCK,
      );
      setReissuanceLinkedinCtaUrl(
        initial.reissuance_linkedin_cta_url ??
          initial.linkedin_block_cta_url ??
          "",
      );
      setReissuanceLinkedinCtaLabel(
        initial.reissuance_linkedin_cta_label ??
          initial.linkedin_block_cta_label ??
          "",
      );
      setReissuanceSummitEnabled(
        initial.reissuance_summit_enabled ??
          initial.summit_block_enabled ??
          true,
      );
      setReissuanceSummitHtml(
        initial.reissuance_summit_html ??
          initial.summit_block_html ??
          DEFAULT_SUMMIT_BLOCK,
      );
      setReissuanceSummitCtaUrl(
        initial.reissuance_summit_cta_url ??
          initial.summit_block_cta_url ??
          "",
      );
      setReissuanceSummitCtaLabel(
        initial.reissuance_summit_cta_label ??
          initial.summit_block_cta_label ??
          "",
      );
      setIsActive(initial.is_active);
    } else {
      // Pre-select group when provided so the course_name input is auto-filled
      // from the chosen group right away.
      const presetGroup = preselectGroupId
        ? groups.find((g) => g.id === preselectGroupId) ?? null
        : null;
      setCourseName(presetGroup?.course_name ?? "");
      setSelectedGroupId(presetGroup?.id ?? "");
      setAnnouncementSubject("Você foi reconhecida(o) como...");
      setAnnouncementBody(DEFAULT_ANNOUNCEMENT);
      setPostSubject("Seu certificado está pronto");
      setPostBody(DEFAULT_POST);
      setReissuanceSubject("Seu certificado {{curso}} está aqui");
      setReissuanceBody(DEFAULT_REISSUANCE);
      setPostLinkedinEnabled(true);
      setPostLinkedinHtml(DEFAULT_LINKEDIN_BLOCK);
      setPostLinkedinCtaUrl("");
      setPostLinkedinCtaLabel("");
      setPostSummitEnabled(true);
      setPostSummitHtml(DEFAULT_SUMMIT_BLOCK);
      setPostSummitCtaUrl("");
      setPostSummitCtaLabel("");
      setReissuanceLinkedinEnabled(true);
      setReissuanceLinkedinHtml(DEFAULT_LINKEDIN_BLOCK);
      setReissuanceLinkedinCtaUrl("");
      setReissuanceLinkedinCtaLabel("");
      setReissuanceSummitEnabled(true);
      setReissuanceSummitHtml(DEFAULT_SUMMIT_BLOCK);
      setReissuanceSummitCtaUrl("");
      setReissuanceSummitCtaLabel("");
      setIsActive(true);
    }
    setPreviewKind("announcement");
    setPreviewMode("visual");
  }, [open, initial, groups, preselectGroupId]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  // ESC closes the modal
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const previewHtml = useMemo(() => {
    const text =
      previewKind === "announcement"
        ? announcementBody
        : previewKind === "post_issuance"
          ? postBody
          : reissuanceBody;
    // Pass all 16 per-email box fields. The renderer picks the matching pair
    // (post_issuance_* or reissuance_*) based on `previewKind`.
    return renderEmailPreview(
      previewKind,
      text,
      {
        primeiro_nome: "Ana",
        nome_certificado: "Ana Silva",
        curso: courseName || "Mind Journey 2025",
        claim_url: "https://exemplo.com/claim/xyz",
        certificate_url: "https://accredible.com/abc",
        data_emissao: "2 de junho de 2026",
      },
      {
        post_issuance_linkedin_enabled: postLinkedinEnabled,
        post_issuance_linkedin_html: postLinkedinHtml,
        post_issuance_linkedin_cta_url: postLinkedinCtaUrl.trim()
          ? postLinkedinCtaUrl.trim()
          : null,
        post_issuance_linkedin_cta_label: postLinkedinCtaLabel.trim()
          ? postLinkedinCtaLabel.trim()
          : null,
        post_issuance_summit_enabled: postSummitEnabled,
        post_issuance_summit_html: postSummitHtml,
        post_issuance_summit_cta_url: postSummitCtaUrl.trim()
          ? postSummitCtaUrl.trim()
          : null,
        post_issuance_summit_cta_label: postSummitCtaLabel.trim()
          ? postSummitCtaLabel.trim()
          : null,
        reissuance_linkedin_enabled: reissuanceLinkedinEnabled,
        reissuance_linkedin_html: reissuanceLinkedinHtml,
        reissuance_linkedin_cta_url: reissuanceLinkedinCtaUrl.trim()
          ? reissuanceLinkedinCtaUrl.trim()
          : null,
        reissuance_linkedin_cta_label: reissuanceLinkedinCtaLabel.trim()
          ? reissuanceLinkedinCtaLabel.trim()
          : null,
        reissuance_summit_enabled: reissuanceSummitEnabled,
        reissuance_summit_html: reissuanceSummitHtml,
        reissuance_summit_cta_url: reissuanceSummitCtaUrl.trim()
          ? reissuanceSummitCtaUrl.trim()
          : null,
        reissuance_summit_cta_label: reissuanceSummitCtaLabel.trim()
          ? reissuanceSummitCtaLabel.trim()
          : null,
      },
    );
  }, [
    previewKind,
    announcementBody,
    postBody,
    reissuanceBody,
    courseName,
    postLinkedinEnabled,
    postLinkedinHtml,
    postLinkedinCtaUrl,
    postLinkedinCtaLabel,
    postSummitEnabled,
    postSummitHtml,
    postSummitCtaUrl,
    postSummitCtaLabel,
    reissuanceLinkedinEnabled,
    reissuanceLinkedinHtml,
    reissuanceLinkedinCtaUrl,
    reissuanceLinkedinCtaLabel,
    reissuanceSummitEnabled,
    reissuanceSummitHtml,
    reissuanceSummitCtaUrl,
    reissuanceSummitCtaLabel,
  ]);

  async function save() {
    if (!selectedGroup) {
      toast.error("Selecione um grupo do Accredible");
      return;
    }
    const effectiveName = selectedGroup.course_name?.trim() || courseName.trim();
    if (!effectiveName) {
      toast.error("O grupo do Accredible não tem nome — não dá pra salvar");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      // course_name is now locked to the selected Accredible group's name. Fall
      // back to the existing course_name only if the group has none.
      const effectiveCourseName =
        selectedGroup.course_name?.trim() || courseName.trim();
      const payload = {
        course_name: effectiveCourseName,
        accredible_group_id: selectedGroup.accredible_group_id,
        accredible_group_identifier: selectedGroup.accredible_group_identifier,
        announcement_subject: announcementSubject,
        announcement_body_text: announcementBody,
        post_issuance_subject: postSubject,
        post_issuance_body_text: postBody,
        reissuance_subject: reissuanceSubject,
        reissuance_body_text: reissuanceBody,
        // Per-email box configs.
        post_issuance_linkedin_enabled: postLinkedinEnabled,
        post_issuance_linkedin_html: postLinkedinHtml,
        post_issuance_linkedin_cta_url: postLinkedinCtaUrl.trim()
          ? postLinkedinCtaUrl.trim()
          : null,
        post_issuance_linkedin_cta_label: postLinkedinCtaLabel.trim()
          ? postLinkedinCtaLabel.trim()
          : null,
        post_issuance_summit_enabled: postSummitEnabled,
        post_issuance_summit_html: postSummitHtml,
        post_issuance_summit_cta_url: postSummitCtaUrl.trim()
          ? postSummitCtaUrl.trim()
          : null,
        post_issuance_summit_cta_label: postSummitCtaLabel.trim()
          ? postSummitCtaLabel.trim()
          : null,
        reissuance_linkedin_enabled: reissuanceLinkedinEnabled,
        reissuance_linkedin_html: reissuanceLinkedinHtml,
        reissuance_linkedin_cta_url: reissuanceLinkedinCtaUrl.trim()
          ? reissuanceLinkedinCtaUrl.trim()
          : null,
        reissuance_linkedin_cta_label: reissuanceLinkedinCtaLabel.trim()
          ? reissuanceLinkedinCtaLabel.trim()
          : null,
        reissuance_summit_enabled: reissuanceSummitEnabled,
        reissuance_summit_html: reissuanceSummitHtml,
        reissuance_summit_cta_url: reissuanceSummitCtaUrl.trim()
          ? reissuanceSummitCtaUrl.trim()
          : null,
        reissuance_summit_cta_label: reissuanceSummitCtaLabel.trim()
          ? reissuanceSummitCtaLabel.trim()
          : null,
        is_active: isActive,
      };

      let error;
      if (initial) {
        ({ error } = await supabase
          .from("cert_course_templates")
          .update(payload)
          .eq("id", initial.id));
      } else {
        ({ error } = await supabase
          .from("cert_course_templates")
          .insert(payload));
      }

      if (error) {
        toast.error(`Erro ao salvar: ${error.message}`);
      } else {
        toast.success(initial ? "Template atualizado" : "Template criado");
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate() {
    if (!initial) return;
    if (!confirm(`Excluir o template "${initial.course_name}"?`)) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("cert_course_templates")
        .delete()
        .eq("id", initial.id);
      if (error) {
        toast.error(`Erro ao excluir: ${error.message}`);
      } else {
        toast.success("Template excluído");
        if (onDeleted) {
          onDeleted();
        } else {
          onSaved();
        }
      }
    } finally {
      setDeleting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-white overflow-hidden flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      <header className="flex items-center justify-between px-8 py-6 border-b bg-white">
        <div>
          <h2 className="text-lg font-semibold">
            {initial ? "Editar template" : "Novo curso"}
          </h2>
          <p className="text-xs text-gray-500">
            Configure o curso e os emails que serão enviados.
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-md hover:bg-gray-100"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-8 px-8 py-6 overflow-hidden">
        {/* Form */}
        <div className="overflow-y-auto pr-2 space-y-10">
            <Section title="Curso">
              <Field label="Nome do curso (do Accredible)">
                <LockedDisplay
                  primary={
                    selectedGroup?.course_name?.trim() ||
                    courseName ||
                    "(selecione um grupo do Accredible primeiro)"
                  }
                />
              </Field>

              <Field label="Grupo do Accredible (vinculado a este template)">
                {selectedGroup ? (
                  <LockedDisplay
                    primary={`${selectedGroup.name} (${selectedGroup.accredible_group_identifier})`}
                    secondary={`group_id: ${selectedGroup.accredible_group_id} · identifier: ${selectedGroup.accredible_group_identifier}`}
                  />
                ) : (
                  <LockedDisplay primary="(nenhum grupo vinculado)" />
                )}
                {groups.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Nenhum grupo encontrado. Use o botão &quot;Sincronizar
                    grupos&quot; na tela anterior.
                  </p>
                )}
              </Field>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-green-mind focus:ring-brand-green-mind"
                />
                Template ativo
              </label>
            </Section>

            <EmailSection
              title="Email de parabéns (announcement)"
              bodyKey="announcement"
              subjectValue={announcementSubject}
              onSubjectChange={setAnnouncementSubject}
              subjectInputRef={announcementSubjectRef}
              subjectPlaceholder="Você foi reconhecida(o) como..."
              bodyValue={announcementBody}
              onBodyChange={setAnnouncementBody}
              bodyPlaceholder="Escreva o corpo do email de parabéns..."
            />

            <EmailSection
              title="Email pós-emissão (post_issuance)"
              bodyKey="post_issuance"
              subjectValue={postSubject}
              onSubjectChange={setPostSubject}
              subjectInputRef={postSubjectRef}
              subjectPlaceholder="Seu certificado está pronto"
              bodyValue={postBody}
              onBodyChange={setPostBody}
              bodyPlaceholder="Escreva o corpo do email pós-emissão..."
            >
              <BlockSection
                title="Caixa LinkedIn neste email"
                value={postLinkedinHtml}
                onChange={setPostLinkedinHtml}
                placeholder="Título + texto de incentivo do bloco LinkedIn..."
                note="O botão 'Adicionar ao LinkedIn' é gerado automaticamente — você escreve o título e o texto de incentivo aqui."
                enabled={postLinkedinEnabled}
                onEnabledChange={setPostLinkedinEnabled}
                ctaLabel={postLinkedinCtaLabel}
                onCtaLabelChange={setPostLinkedinCtaLabel}
                ctaLabelPlaceholder="Adicionar ao LinkedIn"
                ctaUrl={postLinkedinCtaUrl}
                onCtaUrlChange={setPostLinkedinCtaUrl}
                ctaUrlPlaceholder="https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=...&certUrl=..."
                ctaUrlHint="Se deixar vazio, o sistema gera automaticamente o link de share do LinkedIn com os dados do certificado. Cliques no botão são rastreados (HubSpot)."
              />
              <BlockSection
                title="Caixa Mind Summit neste email"
                value={postSummitHtml}
                onChange={setPostSummitHtml}
                placeholder="Título + texto + lista de trilhas do bloco Mind Summit..."
                note="O botão 'Garantir meu lugar no Mind Summit' é gerado automaticamente."
                enabled={postSummitEnabled}
                onEnabledChange={setPostSummitEnabled}
                ctaLabel={postSummitCtaLabel}
                onCtaLabelChange={setPostSummitCtaLabel}
                ctaLabelPlaceholder="Garantir meu lugar no Mind Summit 2026"
                ctaUrl={postSummitCtaUrl}
                onCtaUrlChange={setPostSummitCtaUrl}
                ctaUrlPlaceholder="https://lp.mindsummit.com.br"
                ctaUrlHint="Cliques no botão são rastreados (HubSpot)."
              />
            </EmailSection>

            <EmailSection
              title="Email 3 — Reenvio (quando a pessoa já tinha certificado)"
              bodyKey="reissuance"
              subjectValue={reissuanceSubject}
              onSubjectChange={setReissuanceSubject}
              subjectInputRef={reissuanceSubjectRef}
              subjectPlaceholder="Seu certificado {{curso}} está aqui"
              bodyValue={reissuanceBody}
              onBodyChange={setReissuanceBody}
              bodyPlaceholder="Escreva o corpo do email de reenvio..."
            >
              <BlockSection
                title="Caixa LinkedIn neste email"
                value={reissuanceLinkedinHtml}
                onChange={setReissuanceLinkedinHtml}
                placeholder="Título + texto de incentivo do bloco LinkedIn..."
                note="O botão 'Adicionar ao LinkedIn' é gerado automaticamente — você escreve o título e o texto de incentivo aqui."
                enabled={reissuanceLinkedinEnabled}
                onEnabledChange={setReissuanceLinkedinEnabled}
                ctaLabel={reissuanceLinkedinCtaLabel}
                onCtaLabelChange={setReissuanceLinkedinCtaLabel}
                ctaLabelPlaceholder="Adicionar ao LinkedIn"
                ctaUrl={reissuanceLinkedinCtaUrl}
                onCtaUrlChange={setReissuanceLinkedinCtaUrl}
                ctaUrlPlaceholder="https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=...&certUrl=..."
                ctaUrlHint="Se deixar vazio, o sistema gera automaticamente o link de share do LinkedIn com os dados do certificado. Cliques no botão são rastreados (HubSpot)."
              />
              <BlockSection
                title="Caixa Mind Summit neste email"
                value={reissuanceSummitHtml}
                onChange={setReissuanceSummitHtml}
                placeholder="Título + texto + lista de trilhas do bloco Mind Summit..."
                note="O botão 'Garantir meu lugar no Mind Summit' é gerado automaticamente."
                enabled={reissuanceSummitEnabled}
                onEnabledChange={setReissuanceSummitEnabled}
                ctaLabel={reissuanceSummitCtaLabel}
                onCtaLabelChange={setReissuanceSummitCtaLabel}
                ctaLabelPlaceholder="Garantir meu lugar no Mind Summit 2026"
                ctaUrl={reissuanceSummitCtaUrl}
                onCtaUrlChange={setReissuanceSummitCtaUrl}
                ctaUrlPlaceholder="https://lp.mindsummit.com.br"
                ctaUrlHint="Cliques no botão são rastreados (HubSpot)."
              />
            </EmailSection>
          </div>

        {/* Preview (sticky) */}
        <div className="bg-gray-50 rounded-lg overflow-hidden flex flex-col min-h-0">
          <div className="sticky top-0 p-6 flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setPreviewKind("announcement")}
                  className={clsx(
                    "px-3 py-1.5 text-xs font-medium rounded-md border",
                    previewKind === "announcement"
                      ? "bg-brand-black text-white border-brand-black"
                      : "bg-white text-brand-black border-gray-200 hover:border-gray-400",
                  )}
                >
                  Parabéns
                </button>
                <button
                  onClick={() => setPreviewKind("post_issuance")}
                  className={clsx(
                    "px-3 py-1.5 text-xs font-medium rounded-md border",
                    previewKind === "post_issuance"
                      ? "bg-brand-black text-white border-brand-black"
                      : "bg-white text-brand-black border-gray-200 hover:border-gray-400",
                  )}
                >
                  Pós-emissão
                </button>
                <button
                  onClick={() => setPreviewKind("reissuance")}
                  className={clsx(
                    "px-3 py-1.5 text-xs font-medium rounded-md border",
                    previewKind === "reissuance"
                      ? "bg-brand-black text-white border-brand-black"
                      : "bg-white text-brand-black border-gray-200 hover:border-gray-400",
                  )}
                >
                  Reenvio
                </button>
                <button
                  onClick={() =>
                    setPreviewMode((m) => (m === "visual" ? "html" : "visual"))
                  }
                  className={clsx(
                    "ml-auto px-3 py-1.5 text-xs font-medium rounded-md border inline-flex items-center gap-1.5",
                    previewMode === "html"
                      ? "bg-brand-black text-white border-brand-black"
                      : "bg-white text-brand-black border-gray-200 hover:border-gray-400",
                  )}
                  title={
                    previewMode === "visual"
                      ? "Ver código HTML"
                      : "Voltar para visual"
                  }
                >
                  {previewMode === "visual" ? (
                    <>
                      <Code2 size={12} />
                      HTML
                    </>
                  ) : (
                    <>
                      <Eye size={12} />
                      Visual
                    </>
                  )}
                </button>
              </div>
              <div className="flex-1 border rounded-lg overflow-hidden bg-white min-h-[500px] flex flex-col">
                {previewMode === "visual" ? (
                  <iframe
                    title="Email preview"
                    srcDoc={previewHtml}
                    className="w-full flex-1 min-h-[500px]"
                    sandbox=""
                  />
                ) : (
                  <pre className="flex-1 overflow-auto p-4 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-all bg-gray-900 text-gray-100">
                    {previewHtml}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>

      <footer className="flex items-center justify-between gap-2 px-8 py-4 border-t bg-white">
        <div>
          {initial && (
            <button
              onClick={deleteTemplate}
              disabled={deleting || saving}
              className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md disabled:opacity-60"
            >
              {deleting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Trash2 size={12} />
              )}
              Excluir template
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || deleting}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-brand-green-mind text-brand-black hover:bg-[#54d781] disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Salvar
          </button>
        </div>
      </footer>

      <style jsx global>{`
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
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {children}
    </section>
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

function LockedDisplay({
  primary,
  secondary,
}: {
  primary: string;
  secondary?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-100 px-3 py-2.5">
      <Lock size={14} className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800 break-words">{primary}</p>
        {secondary && (
          <p className="mt-0.5 text-xs text-gray-500 break-words font-mono">
            {secondary}
          </p>
        )}
      </div>
    </div>
  );
}

interface SubjectVariablePickerProps {
  bodyKey: BodyKey;
  inputRef: React.RefObject<HTMLInputElement>;
  value: string;
  onChange: (v: string) => void;
}

/**
 * Small popover button shown next to a subject <input>. Clicking a variable
 * inserts `{{key}}` at the input's current caret position (or appends if the
 * input has never been focused).
 */
function SubjectVariablePicker({
  bodyKey,
  inputRef,
  value,
  onChange,
}: SubjectVariablePickerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.("[data-subject-variable-root]")) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const insert = (key: string) => {
    const token = `{{${key}}}`;
    const el = inputRef.current;
    if (el) {
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + token + value.slice(end);
      onChange(next);
      // After React applies the new value, restore the caret position right
      // after the inserted token.
      requestAnimationFrame(() => {
        if (inputRef.current) {
          const caret = start + token.length;
          inputRef.current.focus();
          inputRef.current.setSelectionRange(caret, caret);
        }
      });
    } else {
      onChange(value + token);
    }
    setOpen(false);
  };

  const options = subjectVariableOptionsFor(bodyKey);

  return (
    <div className="relative" data-subject-variable-root>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Inserir variável no assunto"
        className={clsx(
          "inline-flex items-center justify-center h-9 w-9 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-600",
          open && "bg-gray-100",
        )}
      >
        <Braces size={14} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-2 flex flex-col gap-1 min-w-[240px]">
          {options.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insert(v.key)}
              className="text-left text-xs font-mono px-2 py-1 rounded hover:bg-brand-green-mind/10"
            >
              {`{{${v.key}}}`}
              <span className="ml-2 font-sans text-gray-500">{v.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface EmailSectionProps {
  title: string;
  bodyKey: BodyKey;
  subjectValue: string;
  onSubjectChange: (v: string) => void;
  subjectInputRef: React.RefObject<HTMLInputElement>;
  subjectPlaceholder?: string;
  bodyValue: string;
  onBodyChange: (v: string) => void;
  bodyPlaceholder?: string;
  /**
   * Optional nested content shown indented under this email section — used for
   * the per-email LinkedIn and Mind Summit box configs.
   */
  children?: React.ReactNode;
}

function EmailSection({
  title,
  bodyKey,
  subjectValue,
  onSubjectChange,
  subjectInputRef,
  subjectPlaceholder,
  bodyValue,
  onBodyChange,
  bodyPlaceholder,
  children,
}: EmailSectionProps) {
  const variableOptions = variableOptionsFor(bodyKey);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-1 h-5 rounded-full bg-brand-green-mind"
          aria-hidden="true"
        />
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>

      <Field label="Assunto">
        <div className="flex items-center gap-2">
          <input
            ref={subjectInputRef}
            type="text"
            value={subjectValue}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="input"
            placeholder={subjectPlaceholder}
          />
          <SubjectVariablePicker
            bodyKey={bodyKey}
            inputRef={subjectInputRef}
            value={subjectValue}
            onChange={onSubjectChange}
          />
        </div>
      </Field>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Corpo
        </label>
        <EmailBodyEditor
          value={bodyValue}
          onChange={onBodyChange}
          relevantVariables={variableOptions}
          placeholder={bodyPlaceholder}
        />
      </div>

      {children && (
        <div className="mt-4 ml-3 pl-4 border-l-2 border-gray-200 space-y-6">
          {children}
        </div>
      )}
    </section>
  );
}

interface BlockSectionProps {
  title: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  note: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  ctaLabel: string;
  onCtaLabelChange: (v: string) => void;
  ctaLabelPlaceholder?: string;
  ctaUrl: string;
  onCtaUrlChange: (v: string) => void;
  ctaUrlPlaceholder?: string;
  ctaUrlHint: string;
}

function BlockSection({
  title,
  value,
  onChange,
  placeholder,
  note,
  enabled,
  onEnabledChange,
  ctaLabel,
  onCtaLabelChange,
  ctaLabelPlaceholder,
  ctaUrl,
  onCtaUrlChange,
  ctaUrlPlaceholder,
  ctaUrlHint,
}: BlockSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-1 h-5 rounded-full bg-brand-green-mind"
          aria-hidden="true"
        />
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>

      <ToggleSwitch
        label="Aparecer no email"
        checked={enabled}
        onChange={onEnabledChange}
      />

      <div
        className={clsx(
          "space-y-3 transition-opacity",
          !enabled && "opacity-50 pointer-events-none",
        )}
        aria-disabled={!enabled}
      >
        <EmailBodyEditor
          value={value}
          onChange={onChange}
          relevantVariables={BLOCK_VARIABLES}
          placeholder={placeholder}
        />
        <p className="text-xs text-gray-500">{note}</p>

        <Field label="Label do botão CTA">
          <input
            type="text"
            value={ctaLabel}
            onChange={(e) => onCtaLabelChange(e.target.value)}
            className="input"
            placeholder={ctaLabelPlaceholder}
            disabled={!enabled}
          />
        </Field>

        <Field label="URL do botão CTA">
          <input
            type="text"
            value={ctaUrl}
            onChange={(e) => onCtaUrlChange(e.target.value)}
            className="input"
            placeholder={ctaUrlPlaceholder}
            disabled={!enabled}
          />
          <p className="text-xs text-gray-500 mt-1">{ctaUrlHint}</p>
        </Field>
      </div>
    </section>
  );
}

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <span className="relative inline-block">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <span
          className={clsx(
            "block w-9 h-5 rounded-full transition-colors",
            checked ? "bg-brand-green-mind" : "bg-gray-300",
          )}
        />
        <span
          className={clsx(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
