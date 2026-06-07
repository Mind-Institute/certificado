# Mind Certificados — Handoff Técnico Completo

Sistema interno da Mind pra emitir certificados Accredible em escala, com 3 emails customizados por curso, tracking no HubSpot e gerenciamento via tela web.

---

## 1. Visão executiva

**Problema que resolve:** Adriana precisa emitir certificados pra grupos de pessoas que terminam cursos da Mind (Mind Journey, Formação Gestão Estratégica, Mind Summit, etc). Cada destinatário deve receber emails em momentos diferentes (anúncio → emissão sob demanda → entrega), com tracking de quem realmente engaja (clica, adiciona no LinkedIn, mostra interesse no Mind Summit). O sistema também precisa **não emitir certificados que não vão ser usados** (Accredible cobra por emissão).

**O que o sistema faz:**
1. Adriana cadastra um template por curso (3 emails + 2 caixas por email)
2. Faz upload de destinatários (CSV ou manual)
3. Clica "Processar destinatários"
4. Sistema checa Accredible: a pessoa já tem certificado neste grupo?
   - **Tem:** envia email de reenvio com o link existente
   - **Não tem:** envia email de anúncio "você é elegível, clique pra emitir"
5. Pessoa clica → sistema emite certificado no Accredible → envia email pós-emissão com botões LinkedIn e Mind Summit
6. Cada clique vai pro HubSpot via webhook

**URL de produção:** https://mind-certificados.vercel.app
**Login:** Google OAuth restrito a emails cadastrados na tabela `cert_allowed_users`

---

## 2. Arquitetura geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   👤 Adriana (admin)         👤 Destinatário (recebe email)         │
│         │                              │                            │
│         ▼                              ▼                            │
│  ┌──────────────────────────────────────────────────┐               │
│  │    Frontend Next.js 14 (Vercel)                  │               │
│  │    mind-certificados.vercel.app                  │               │
│  │    - Login Google                                │               │
│  │    - Tabs: Templates, Emitir, Histórico, Admin   │               │
│  │    - Editor WYSIWYG TipTap                       │               │
│  │    - Sidebar com contador Resend ao vivo         │               │
│  └─────────────┬────────────────────────────────────┘               │
│                │                                                    │
│                │ supabase-js client (RLS)                           │
│                ▼                                                    │
│  ┌──────────────────────────────────────────────────┐               │
│  │   Supabase (iclpvamfvffsqptbmlfv)                │               │
│  │                                                  │               │
│  │   Tabelas:                                       │               │
│  │   - cert_course_templates                        │               │
│  │   - cert_recipients                              │               │
│  │   - cert_accredible_groups                       │               │
│  │   - cert_email_log                               │               │
│  │   - cert_engagement_log                          │               │
│  │   - cert_allowed_users (whitelist)               │               │
│  │                                                  │               │
│  │   Edge Functions (Deno):                         │               │
│  │   - sync-accredible-groups                       │               │
│  │   - sync-groups-callback                         │               │
│  │   - check-existing-credential                    │               │
│  │   - credential-check-callback                    │               │
│  │   - claim-certificate                            │               │
│  │   - track-event                                  │               │
│  └─────┬──────────────┬───────────────┬─────────────┘               │
│        │              │               │                             │
│        ▼              ▼               ▼                             │
│  ┌──────────┐  ┌────────────┐  ┌──────────────┐                     │
│  │  Resend  │  │   Zapier   │  │   HubSpot    │                     │
│  │  (email) │  │   (3 zaps) │  │  via Zapier  │                     │
│  └──────────┘  └─────┬──────┘  └──────────────┘                     │
│                      │                                              │
│                      ▼                                              │
│              ┌──────────────┐                                       │
│              │  Accredible  │ ← emissão/busca de certificados       │
│              └──────────────┘                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Por que Zapier no meio:** seu plano Accredible não inclui API direta. Zapier tem integração nativa autenticada com Accredible e atua como ponte autorizada. Custo: free tier (100 tasks/mês) ou Starter ($20/mês, 750 tasks).

---

## 3. Stack completo

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR + RSC, ótima DX, deploy fácil |
| Hosting frontend | Vercel | Integração nativa Next.js, free tier |
| UI/Styling | Tailwind CSS + lucide-react icons | Rápido, consistente |
| Editor de email | TipTap (WYSIWYG) v2.27 | React-friendly, output HTML limpo |
| Database | Supabase Postgres | Realtime, RLS, fácil de operar |
| Backend lógico | Supabase Edge Functions (Deno) | Sem servidor, rápido, mesmo provider |
| Auth | Supabase Auth + Google OAuth | Padrão indústria, sem senha pra gerenciar |
| Email | Resend (API key) | Free 3k/mês, deliverability boa, API simples |
| Bridge p/ Accredible | Zapier (3 zaps via webhooks) | Adriana já tem Accredible conectado lá |
| CRM tracking | HubSpot via Zapier webhook | Já é o CRM da Mind |
| Certificados | Accredible | Plataforma estabelecida que a Mind já usa |

---

## 4. Fluxos end-to-end

### 4.1 Fluxo principal — emitir certificado pra um destinatário NOVO

```
1. Adriana faz upload do CSV em Emitir
   → cert_recipients criada com status='pending'
   
2. Adriana clica "Processar destinatários"
   → frontend chama edge function check-existing-credential
   → para cada recipient, POSTa pro Zap 3 (Mind Check Credential)
   → recipient.status = 'checking_accredible'
   
3. Zap 3 (Zapier):
   trigger: webhook recebido
   action 1: Accredible Find Credentials (email + group_id)
   action 2: webhook POST pro credential-check-callback
   
4. credential-check-callback recebe:
   → como Accredible NÃO retornou credential_url
   → renderiza email anúncio (Email 1)
   → envia via Resend
   → recipient.status = 'announced'
   → loga em cert_email_log (status='sent')
   → fireHubSpot('announcement_email_sent')
   
5. Destinatário recebe email "Você foi reconhecida(o) como X"
   → clica no botão "Emitir meu certificado"
   → vai pra https://mind-certificados.vercel.app/claim/{token}
   → essa rota redireciona pro edge function claim-certificate
   
6. claim-certificate:
   → busca recipient pelo claim_token
   → recipient.status = 'pending_issuance'
   → POSTa pro Zap 1 (Mind Certificados → Accredible)
   → retorna HTML "preparando seu certificado" que auto-recarrega
   
7. Zap 1:
   trigger: webhook
   action 1: Accredible Create Credential
   action 2: webhook POST pro zapier-callback com credential_url
   
8. zapier-callback (edge function):
   → recipient.certificate_url = credential_url
   → recipient.status = 'issued'
   → renderiza email pós-emissão (Email 2) com caixas LinkedIn+Summit
   → envia via Resend
   → recipient.status = 'sent'
   → loga
   → fireHubSpot('certificate_issued' + 'post_issuance_email_sent')
   
9. Próximo refresh da página /claim/{token}:
   → recipient.certificate_url existe agora
   → redireciona direto pro Accredible
   
10. Destinatário recebe email pós-emissão
    → clica em "Adicionar ao LinkedIn"
    → vai pra /functions/v1/track-event?event=linkedin&...
    → track-event loga, fireHubSpot('clicked_linkedin'), redireciona
```

### 4.2 Fluxo alternativo — destinatário JÁ TEM certificado

Etapas 1-3 idênticas. Na etapa 4:

```
4. credential-check-callback recebe credential_url do Zap 3
   → recipient.certificate_url = credential_url existente
   → recipient.status = 'pre_existing'
   → renderiza email REENVIO (Email 3) com texto "Seu certificado X já tinha sido emitido em DD/MM"
   → envia via Resend
   → recipient.post_issuance_sent_at preenchido
   → fireHubSpot('reissuance_email_sent')

[NÃO PASSA POR EMISSÃO — economiza dinheiro com Accredible]
```

### 4.3 Fluxo — sincronizar grupos novos do Accredible

```
1. Adriana criou um grupo novo no Accredible
2. Vai em Templates → clica "Sincronizar grupos do Accredible"
3. Frontend chama sync-accredible-groups
4. sync-accredible-groups POSTa pro Zap 2 (Mind Sync Groups)
5. Zap 2:
   trigger: webhook
   action 1: Accredible Find Groups (sem filtro = todos)
   action 2: webhook POST pro sync-groups-callback com:
     groups: "id1,id2,id3" (CSV flatten do Zapier)
     names: "n1,n2,n3"
     identifiers: "i1,i2,i3"
     course_names: "c1,c2,c3"
6. sync-groups-callback faz "zip" das 4 CSV strings e upserts em cert_accredible_groups
7. Frontend recarrega → cards aparecem na tela de Templates
```

### 4.4 Fluxo — admin gerencia usuários

```
1. Adriana (role='admin') acessa Tab Admin (só visível pra admins)
2. Vê tabela de cert_allowed_users
3. Adiciona email + nome + role → INSERT direto via Supabase client (RLS aceita só admin)
4. Toggla user↔admin → UPDATE
5. Remove (não pode remover a si mesma) → DELETE

Quando um email NÃO autorizado tenta logar:
- callback do auth checa cert_allowed_users
- se não tem → sign out + redirect /login?error=not_authorized
- middleware faz a mesma checagem em cada request
```

---

## 5. Database — Supabase (`iclpvamfvffsqptbmlfv`)

URL: `https://iclpvamfvffsqptbmlfv.supabase.co`
Dashboard: `https://supabase.com/dashboard/project/iclpvamfvffsqptbmlfv`

### 5.1 Tabela `cert_course_templates`

Um registro = um curso/certificado configurado. **Linkado 1:1 com um grupo do Accredible.**

| Coluna | Tipo | O que é |
|---|---|---|
| `id` | uuid | PK |
| `course_name` | text | Nome do curso (display) — geralmente vem do Accredible mas é editável |
| `accredible_group_id` | text | Numeric ID do grupo no Accredible (ex: "818295") |
| `accredible_group_identifier` | text | String identifier do grupo (ex: "2025_journey") |
| `announcement_subject` | text | Assunto do Email 1 — suporta `{{variaveis}}` |
| `announcement_body_text` | text | Corpo HTML do Email 1 (gerado por TipTap) |
| `post_issuance_subject` | text | Assunto do Email 2 |
| `post_issuance_body_text` | text | Corpo HTML do Email 2 |
| `reissuance_subject` | text | Assunto do Email 3 (reenvio) |
| `reissuance_body_text` | text | Corpo HTML do Email 3 |
| `post_issuance_linkedin_enabled` | bool | Mostrar caixa LinkedIn no Email 2? |
| `post_issuance_linkedin_html` | text | HTML do texto da caixa LinkedIn no Email 2 |
| `post_issuance_linkedin_cta_url` | text | URL customizada do botão LinkedIn (NULL = auto-gera link de share Accredible) |
| `post_issuance_linkedin_cta_label` | text | Label do botão (default: "Adicionar ao LinkedIn") |
| `post_issuance_summit_enabled` | bool | Mostrar caixa Mind Summit no Email 2? |
| `post_issuance_summit_html` | text | HTML do texto da caixa Summit no Email 2 |
| `post_issuance_summit_cta_url` | text | URL do botão Summit (default: lp.mindsummit.com.br) |
| `post_issuance_summit_cta_label` | text | Label (default: "Garantir meu lugar no Mind Summit 2026") |
| `reissuance_linkedin_*` (4 colunas) | — | Mesma estrutura mas pro Email 3 (independente) |
| `reissuance_summit_*` (4 colunas) | — | Mesma estrutura mas pro Email 3 (independente) |
| `linkedin_block_*`, `summit_block_*` | — | **LEGACY (8 colunas)** — antes era compartilhado entre Email 2 e Email 3. Mantido por backwards compat mas ignorado pelo código novo |
| `is_active` | bool | Template ativo? |
| `created_at`, `updated_at` | timestamptz | Auto |

**Total: ~35 colunas. Schema parece complexo mas representa fielmente os 3 emails + 4 caixas configuráveis por curso.**

### 5.2 Tabela `cert_recipients`

Um registro = uma pessoa que vai (ou recebeu) um certificado de um curso específico.

| Coluna | Tipo | O que é |
|---|---|---|
| `id` | uuid | PK |
| `course_template_id` | uuid FK | Linka pro template do curso |
| `first_name` | text | Primeiro nome |
| `email` | text | Email do destinatário |
| `certificate_name` | text | Nome completo a aparecer no certificado |
| `status` | enum | `pending` → `checking_accredible` → (`pre_existing` ou `announced`) → `claimed` → `pending_issuance` → `issued` → `sent` (ou `failed` em qualquer momento) |
| `claim_token` | uuid (unique) | Token do link do email anúncio |
| `callback_token` | uuid (unique) | Token usado nas chamadas de volta do Zapier (segurança) |
| `announcement_sent_at` | timestamptz | Quando saiu o Email 1 |
| `claimed_at` | timestamptz | Quando a pessoa clicou |
| `issuance_requested_at` | timestamptz | Quando disparamos pro Zap 1 |
| `accredible_credential_id` | text | ID retornado pelo Accredible após emissão |
| `certificate_url` | text | URL pública do certificado |
| `certificate_issued_at` | timestamptz | Quando o cert foi emitido |
| `post_issuance_sent_at` | timestamptz | Quando saiu Email 2 ou 3 |
| `error_message` | text | Última mensagem de erro (se status=failed) |
| `retry_count` | int | Contador de retries |
| `created_at`, `updated_at` | timestamptz | Auto |

### 5.3 Tabela `cert_accredible_groups`

Cache local dos grupos do Accredible (popula o select de quando criar template). Sincronizado via Zap 2.

| Coluna | Tipo | O que é |
|---|---|---|
| `id` | uuid | PK |
| `accredible_group_id` | text (unique) | ID numérico do Accredible |
| `accredible_group_identifier` | text (unique) | Identifier string do Accredible |
| `name` | text | Nome |
| `course_name` | text | Nome do curso (mostrado nos cards) |
| `description` | text | Descrição |
| `synced_at` | timestamptz | Último sync |
| `created_at` | timestamptz | Auto |

### 5.4 Tabela `cert_email_log`

Auditoria de todo email enviado. **Usada pelo widget de quota Resend no sidebar.**

| Coluna | Tipo | O que é |
|---|---|---|
| `id` | uuid | PK |
| `recipient_id` | uuid FK (SET NULL) | Linka pro recipient. Se deletar recipient, NÃO apaga o log (preserva contagem) |
| `email_type` | text | `announcement` / `post_issuance` / `reissuance` |
| `to_email` | text | Pra quem foi |
| `subject` | text | Assunto |
| `status` | text | `sent` ou `failed` |
| `provider_id` | text | ID retornado pelo Resend (rastreável no dashboard deles) |
| `error_message` | text | Se falhou, por quê |
| `sent_at` | timestamptz | Quando |

### 5.5 Tabela `cert_engagement_log`

Logs de clicks pra rastreamento (LinkedIn, Summit, claim, etc).

| Coluna | Tipo | O que é |
|---|---|---|
| `id` | uuid | PK |
| `recipient_id` | uuid FK (SET NULL) | Recipient relacionado |
| `event_type` | text | `clicked_linkedin`, `clicked_summit`, `claim_clicked`, etc |
| `event_metadata` | jsonb | Dados extras (URL destino, etc) |
| `user_agent` | text | Browser do destinatário |
| `ip_address` | text | IP (truncado) |
| `occurred_at` | timestamptz | Quando |

### 5.6 Tabela `cert_allowed_users`

Whitelist de emails autorizados a logar. Adriana = admin inicial.

| Coluna | Tipo | O que é |
|---|---|---|
| `email` | text (PK) | Email autorizado |
| `role` | text | `admin` ou `user` |
| `full_name` | text | Nome (display) |
| `added_at` | timestamptz | Quando foi adicionado |
| `last_signed_in_at` | timestamptz | Último login |

**Helpers SQL:** `public.cert_is_admin()` e `public.cert_is_authorized_user()` usados nas policies RLS.

### 5.7 RLS (Row Level Security)

- Todas as tabelas têm RLS ativo
- Authenticated users (Google logado) com email em `cert_allowed_users` têm acesso geral
- Apenas admins podem INSERT/UPDATE/DELETE em `cert_allowed_users`

---

## 6. Edge Functions (Supabase)

Todas em Deno/TypeScript. Path: `supabase/functions/{nome}/index.ts`.

### 6.1 `sync-accredible-groups` (verify_jwt=true)

Disparada pelo botão "Sincronizar grupos" na Tab Templates.
- Envia POST pro Zapier (`ZAPIER_SYNC_WEBHOOK_URL`) com `callback_url`
- Não faz nada além disso — Zapier responde via callback

### 6.2 `sync-groups-callback` (verify_jwt=false)

Recebe POST do Zap 2.
- Aceita vários formatos (CSV paralelo, array, objeto único)
- Faz zip das listas e upserts em `cert_accredible_groups`
- Preserva nomes existentes se o payload novo só tem IDs

### 6.3 `check-existing-credential` (verify_jwt=true)

Disparada pelo botão "Processar destinatários" na Tab Emitir.
- Pra cada recipient, POSTa pro Zapier (`ZAPIER_CHECK_WEBHOOK_URL`)
- Marca status='checking_accredible'

### 6.4 `credential-check-callback` (verify_jwt=false)

Recebe POST do Zap 3 com resultado da busca.
- Se `credential_url` veio → envia Email 3 (reenvio) usando colunas `reissuance_*`
- Se vazio → envia Email 1 (anúncio)
- Fire-and-forget pro HubSpot

### 6.5 `claim-certificate` (verify_jwt=false)

Endpoint que a pessoa abre quando clica no botão do email anúncio.
- Se já tem `certificate_url` → redireciona pro Accredible
- Senão → POSTa pro Zap 1 (`ZAPIER_WEBHOOK_URL`), mostra HTML "preparando"
- Quando recarrega, deve já ter URL

### 6.6 `zapier-callback` (verify_jwt=false)

Recebe POST do Zap 1 após Accredible criar credencial.
- Salva `certificate_url` no recipient
- Renderiza Email 2 (pós-emissão) usando colunas `post_issuance_*`
- Envia via Resend + HubSpot fire

### 6.7 `track-event` (verify_jwt=false)

Endpoint público pros botões LinkedIn/Summit nos emails.
- GET: loga em `cert_engagement_log`, fire HubSpot, redireciona pra target
- POST: chamada interna por outras edge functions pra logar status changes

---

## 7. Frontend (Next.js 14)

### 7.1 Estrutura de pastas

```
app/
├── layout.tsx              ← root layout, metadata, favicon
├── globals.css             ← Tailwind directives
├── page.tsx                ← redireciona / → login ou dashboard
├── icon.svg / icon.png     ← favicon
│
├── login/page.tsx          ← tela login Google OAuth
├── auth/callback/route.ts  ← OAuth callback, checa whitelist
│
├── dashboard/
│   ├── layout.tsx          ← sidebar + área principal
│   ├── page.tsx            ← redir → /dashboard/templates
│   ├── templates/page.tsx  ← Tab 1: cards dos grupos Accredible
│   ├── emitir/page.tsx     ← Tab 2: upload + processar destinatários
│   ├── historico/page.tsx  ← Tab 3: lista de recipients com filtros (realtime)
│   └── admin/page.tsx      ← Tab 4: gerenciar cert_allowed_users (só admins)
│
└── claim/[token]/page.tsx  ← rota pública do link do email anúncio (redir pra edge function)

components/
├── sidebar.tsx                  ← sidebar com logo, nav, contador Resend, sign out
├── template-form.tsx            ← modal full-screen do editor de template
├── email-body-editor.tsx        ← wrapper TipTap WYSIWYG
├── recipient-upload.tsx         ← upload CSV
├── recipient-manual-form.tsx    ← form manual de recipient
├── recipient-detail-panel.tsx   ← side panel do detalhe (Histórico)
├── status-badge.tsx             ← badge colorido por status
├── resend-quota-widget.tsx      ← contador Hoje X/100 + Mês X/3.000 no sidebar
└── toast.tsx                    ← toast provider + hook useToast()

lib/
├── supabase/
│   ├── client.ts          ← createBrowserClient (RLS-aware)
│   └── server.ts          ← createServerClient (RSC)
├── types.ts               ← interfaces TypeScript de todas tabelas
└── email-preview.ts       ← render HTML do email pra iframe de preview

middleware.ts              ← auth gate em /dashboard/*, checa cert_allowed_users
```

### 7.2 Componentes-chave

**`template-form.tsx`** (~800 linhas, mais complexo do app)
- Modal full-screen com 2 colunas (form esquerda, preview direita sticky)
- Nome do curso e Grupo: locked, vêm do Accredible
- 3 sections de email: cada uma com Subject + Body (TipTap)
- Dentro de Email 2 e Email 3: 2 sub-sections (LinkedIn + Summit) cada com toggle + WYSIWYG + URL/label customizáveis
- Variable picker nos subjects
- Toggle preview Visual / HTML

**`email-body-editor.tsx`**
- TipTap StarterKit + Link + Placeholder
- Toolbar com Bold, Itálico, Listas, Link, Inserir Variável
- Output: HTML

**`resend-quota-widget.tsx`**
- Query `cert_email_log WHERE status='sent'` filtrada por hoje/mês (timezone local)
- Refresh a cada 60s + Supabase Realtime subscription pra updates instantâneos
- Barra verde/âmbar/vermelha por % do limite

---

## 8. Integrações externas

### 8.1 Zapier (3 zaps na conta da Adriana)

| Zap | Trigger | Steps | Secret no Supabase |
|---|---|---|---|
| **Zap 1: Mind Certificados → Accredible** | Webhook Catch Hook | 1. Accredible Create Credential 2. Webhook POST → zapier-callback | `ZAPIER_WEBHOOK_URL` |
| **Zap 2: Mind Sync Groups** | Webhook Catch Hook | 1. Accredible Find Groups 2. Webhook POST → sync-groups-callback (com 4 CSVs paralelos: groups, names, identifiers, course_names) | `ZAPIER_SYNC_WEBHOOK_URL` |
| **Zap 3: Mind Check Credential** | Webhook Catch Hook | 1. Accredible Find Credentials 2. Webhook POST → credential-check-callback | `ZAPIER_CHECK_WEBHOOK_URL` |

**Importante:** "Successful if no search results are found" deve ser TRUE no Zap 3 pra não tratar "não achei" como erro.

### 8.2 Resend (envio de email)

- API key em `RESEND_API_KEY`
- Domínio `joinmind.com.br` autenticado (DKIM/SPF)
- Integração Supabase configurada (webhooks de eventos)
- From: `Time Mind <contato@joinmind.com.br>` (`FROM_EMAIL`)
- Reply-to: `adriana@joinmind.com.br`
- Limites Free: 100/dia, 3.000/mês (rastreado pelo widget no sidebar)

### 8.3 HubSpot (CRM tracking)

- Recebe POSTs do Supabase via webhook Zapier (`HUBSPOT_ZAPIER_URL`)
- Eventos logados: `announcement_email_sent`, `certificate_issued`, `post_issuance_email_sent`, `reissuance_email_sent`, `clicked_linkedin`, `clicked_summit`, etc
- Payload inclui: email, first_name, course_name, certificate_url, occurred_at
- Você configura o Zap final pra criar contact/engagement no HubSpot

### 8.4 Accredible

- Plano atual NÃO inclui API direta → integração via Zapier
- Conta Mind Institute
- 6 grupos cadastrados (Mind Journey, Formação Gestão, Mind Summit 2025, + 3 novos)

### 8.5 Google OAuth

- Cloud Console: OAuth 2.0 Client ID (Web)
- Authorized origins: `https://mind-certificados.vercel.app`, `http://localhost:3000`
- Authorized redirect: `https://iclpvamfvffsqptbmlfv.supabase.co/auth/v1/callback`
- Habilitado no Supabase Auth → Providers → Google

---

## 9. Secrets e configuração

### Supabase Edge Functions Secrets
| Nome | Valor |
|---|---|
| `RESEND_API_KEY` | `re_...` |
| `FROM_EMAIL` | `Time Mind <contato@joinmind.com.br>` |
| `APP_URL` | `https://mind-certificados.vercel.app` |
| `ZAPIER_WEBHOOK_URL` | URL Catch Hook do Zap 1 |
| `ZAPIER_SYNC_WEBHOOK_URL` | URL Catch Hook do Zap 2 |
| `ZAPIER_CHECK_WEBHOOK_URL` | URL Catch Hook do Zap 3 |
| `HUBSPOT_ZAPIER_URL` | (opcional) URL do Zap HubSpot |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Auto-injetados |

### Vercel Environment Variables
| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://iclpvamfvffsqptbmlfv.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` |

---

## 10. Operações comuns

### Adicionar uma nova pessoa autorizada a logar
Tab Admin → "+ Adicionar usuário" → preenche email/nome/role → Salvar.

### Criar template pra um novo curso
1. Cria o grupo no Accredible
2. Templates → "Sincronizar grupos do Accredible" (1 min)
3. Card cinza com "Configurar emails" aparece
4. Clica no card → editor full-screen abre
5. Preenche 3 emails + 4 caixas → Salvar

### Enviar certificados pra uma turma
1. Emitir → seleciona curso no dropdown
2. Upload CSV (colunas: `primeiro_nome`, `email`, `nome_certificado`) ou manual
3. Clica "Processar destinatários" → confirma
4. Acompanha em Histórico (status atualiza em tempo real)

### Reenviar pra alguém
- Histórico → clica no recipient → side panel abre → botão "Reprocessar"
- Re-faz a checagem no Accredible + envia email apropriado

### Ver logs de email no Resend
- https://resend.com/emails (filtra por destinatário ou domain)
- Cada email tem `provider_id` no nosso `cert_email_log` que bate com o ID no Resend

### Debugar uma edge function
- Supabase Dashboard → Edge Functions → clica na função → Logs
- Cada request tem timestamp + status code + execution time
- `console.log()` dentro da função aparece nos logs

### Trocar admin / desativar conta
- Admin tab → toggla role pra user / clica trash

---

## 11. Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| "Contador Resend mostra 0 mas mandamos emails" | FK `cert_email_log.recipient_id` tinha CASCADE e foi apagado quando recipient foi deletado | Já consertado (SET NULL). Pra recuperar contagem antiga, insert manual em `cert_email_log` |
| "Sincronizar grupos retorna 400 — Nenhum grupo no payload" | Zap 2 não tá enviando os 4 campos paralelos | Zap 2 step POST → adicionar fields: `groups`, `names`, `identifiers`, `course_names` |
| "Pessoa clica no link mas página fica eternamente 'Preparando'" | Zap 1 falhou OU `ZAPIER_WEBHOOK_URL` errada | Ver Zapier task history; conferir secret |
| "Email caiu em spam" | Domínio não autenticado completamente OU baixa reputação | Resend → Domains → conferir DKIM/SPF/DMARC verdes |
| "Não consigo logar" | Email não está em `cert_allowed_users` OU Google OAuth não configurado | Verifica no Supabase Table Editor; cofira config Supabase → Auth → Providers → Google |
| "Build do Vercel falha com 'Invalid Version'" | package-lock.json corrompido com entries sem version | `rm package-lock.json && npm install && vercel --prod` |

---

## 12. Limites e custos

| Serviço | Plano | Limite | Custo |
|---|---|---|---|
| Supabase | Free | 500MB DB, 2GB egress/mês, 500K edge fn invocations | $0 (Pro = $25/mo se passar) |
| Vercel | Hobby | Builds + hosting | $0 |
| Resend | Free | 100 emails/dia, 3.000/mês | $0 ($20/mo = 50k/mês) |
| Zapier | Free | 100 tasks/mês | $0 ($20/mo Starter = 750 tasks) |
| Accredible | (já paga) | Tier atual da Mind | já incluso |
| HubSpot | (já paga) | tier atual | já incluso |
| Google Cloud | OAuth | Free pra OAuth | $0 |

**Custo marginal do sistema hoje: $0/mês.**
Se a Mind crescer pra >3k emails/mês ou >100/dia, upgrade Resend é o primeiro a fazer.

---

## 13. Roadmap / next steps possíveis

- [ ] Botão "Reemitir todos certificados desse curso" em massa
- [ ] Dashboard de métricas (taxa de claim, taxa de LinkedIn click, etc)
- [ ] Customizar texto "Preparando seu certificado" por curso
- [ ] Schedule de reenvio automático pra quem não clicou em N dias
- [ ] Upload de logo customizado por curso
- [ ] Multi-tenant (suportar várias marcas além de Mind)

---

## 14. Onde estão os arquivos

Projeto na pasta:
```
/Users/adrianarossi/Library/Application Support/Claude/local-agent-mode-sessions/.../outputs/mind-certificados/
```

**Subpastas-chave:**
- `app/` — páginas Next.js
- `components/` — componentes React
- `lib/` — helpers + types
- `supabase/functions/` — código das edge functions (fonte da verdade tá no Supabase Dashboard, esse local pode estar desatualizado)

**Arquivos importantes:**
- `package.json` — deps (TipTap pinado em 2.27.2)
- `vercel.json` — config de deploy
- `middleware.ts` — auth gate
- `README.md` — setup inicial
- `HANDOFF.md` — esse arquivo

---

## 15. Contatos / responsáveis

- **Adriana Drulla Rossi** — CEO Mind, admin do sistema (`adriana@joinmind.com.br`)
- **Sistema construído com Claude** em sessão Cowork em junho 2026

---

**Última atualização:** Junho 2026
