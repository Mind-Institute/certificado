export type RecipientStatus =
  | "pending"
  | "checking_accredible"
  | "pre_existing"
  | "announced"
  | "claimed"
  | "pending_issuance"
  | "issued"
  | "sent"
  | "failed";

export type EmailType = "announcement" | "post_issuance" | "reissuance";

export type EmailLogStatus = "sent" | "failed";

export interface CourseTemplate {
  id: string;
  course_name: string;
  accredible_group_id: string | null;
  accredible_group_identifier: string | null;
  announcement_subject: string | null;
  announcement_body_text: string | null;
  post_issuance_subject: string | null;
  post_issuance_body_text: string | null;
  reissuance_subject: string | null;
  reissuance_body_text: string | null;
  // Legacy shared block fields. Still present in the DB for backwards compat
  // with templates created before the per-email split; new code paths ignore
  // these and use the per-email fields below.
  linkedin_block_html: string | null;
  summit_block_html: string | null;
  linkedin_block_enabled: boolean;
  linkedin_block_cta_url: string | null;
  linkedin_block_cta_label: string | null;
  summit_block_enabled: boolean;
  summit_block_cta_url: string | null;
  summit_block_cta_label: string | null;
  // Per-email box configs — post_issuance.
  post_issuance_linkedin_enabled: boolean;
  post_issuance_linkedin_html: string | null;
  post_issuance_linkedin_cta_url: string | null;
  post_issuance_linkedin_cta_label: string | null;
  post_issuance_summit_enabled: boolean;
  post_issuance_summit_html: string | null;
  post_issuance_summit_cta_url: string | null;
  post_issuance_summit_cta_label: string | null;
  // Per-email box configs — reissuance.
  reissuance_linkedin_enabled: boolean;
  reissuance_linkedin_html: string | null;
  reissuance_linkedin_cta_url: string | null;
  reissuance_linkedin_cta_label: string | null;
  reissuance_summit_enabled: boolean;
  reissuance_summit_html: string | null;
  reissuance_summit_cta_url: string | null;
  reissuance_summit_cta_label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Recipient {
  id: string;
  course_template_id: string;
  first_name: string;
  email: string;
  certificate_name: string;
  status: RecipientStatus;
  claim_token: string | null;
  announcement_sent_at: string | null;
  claimed_at: string | null;
  accredible_credential_id: string | null;
  certificate_url: string | null;
  certificate_issued_at: string | null;
  post_issuance_sent_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface AccredibleGroup {
  id: string;
  accredible_group_id: string;
  accredible_group_identifier: string;
  name: string;
  course_name: string | null;
  description: string | null;
  synced_at: string;
  created_at: string;
}

export interface EmailLog {
  id: string;
  recipient_id: string;
  email_type: EmailType;
  to_email: string;
  subject: string;
  status: EmailLogStatus;
  provider_id: string | null;
  error_message: string | null;
  sent_at: string;
}

export type AllowedUserRole = "admin" | "user";

export interface AllowedUser {
  email: string;
  role: AllowedUserRole;
  full_name: string | null;
  added_at: string;
  last_signed_in_at: string | null;
}

export interface EmailPreviewVars {
  primeiro_nome: string;
  nome_certificado: string;
  curso: string;
  claim_url?: string;
  certificate_url?: string;
  data_emissao?: string;
}

export const RECIPIENT_STATUS_LABELS: Record<RecipientStatus, string> = {
  pending: "Pendente",
  checking_accredible: "Verificando Accredible",
  pre_existing: "Já tinha certificado",
  announced: "Anunciado",
  claimed: "Reivindicado",
  pending_issuance: "Aguardando Zapier",
  issued: "Emitido",
  sent: "Enviado",
  failed: "Falhou",
};
