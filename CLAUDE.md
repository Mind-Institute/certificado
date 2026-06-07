# Claude Code — Project Context

This is the working context for Claude Code (and any agent) operating on **Mind Certificados**.
Read this FIRST before doing anything. Also read `HANDOFF.md` for the full architecture explanation.

---

## Project root

```
/Users/adrianarossi/Library/Application Support/Claude/local-agent-mode-sessions/b1f6682d-d358-4eca-baee-9c643c69705a/d15d0aba-bd66-472a-9dff-7dbcb9f62cf3/local_d8d5be5b-ae83-44f0-b09e-363770beb64c/outputs/mind-certificados
```

Always `cd` to this folder before running anything. Path has spaces — quote it.

---

## Stack at a glance

- **Frontend:** Next.js 14 App Router, TypeScript strict, Tailwind, lucide-react, TipTap WYSIWYG (v2.27.2 pinned)
- **DB + Auth:** Supabase Postgres + RLS + Google OAuth
- **Backend logic:** Supabase Edge Functions (Deno + TypeScript)
- **Hosting frontend:** Vercel (`mind-certificados` project)
- **Email:** Resend (free tier 3k/mo)
- **Accredible bridge:** 3 Zaps in Adriana's Zapier account
- **CRM tracking:** HubSpot via Zapier webhook

---

## External service IDs / endpoints

### Supabase
- Project: `Certificados`
- Project ID: `iclpvamfvffsqptbmlfv`
- URL: `https://iclpvamfvffsqptbmlfv.supabase.co`
- Org: `Mind` (`fxnvyouyymuwohkmswsh`)
- Region: `us-east-2`
- Dashboard: https://supabase.com/dashboard/project/iclpvamfvffsqptbmlfv

### Vercel
- Project: `mind-certificados`
- Live URL: https://mind-certificados.vercel.app
- Team: Adriana Drulla's projects
- Dashboard: https://vercel.com/adriana-drullas-projects/mind-certificados

### Zaps (in Adriana's Zapier account, account ID `24740331`)

| # | Name | Catch Hook URL | Calls back to |
|---|---|---|---|
| 1 | Mind Certificados → Accredible | `https://hooks.zapier.com/hooks/catch/24740331/4bxjf91/` | `zapier-callback` |
| 2 | Mind Sync Groups | `https://hooks.zapier.com/hooks/catch/24740331/4bpy185/` | `sync-groups-callback` |
| 3 | Mind Check Credential | `https://hooks.zapier.com/hooks/catch/24740331/4bp33h8/` | `credential-check-callback` |

### Accredible
- Plano não inclui API direta. Toda comunicação passa por Zapier (acima).
- Adriana já tem 6 grupos sincronizados no Supabase, ver tabela `cert_accredible_groups`.

### Resend
- Domain `joinmind.com.br` autenticado
- API key configurada em Supabase secrets como `RESEND_API_KEY`
- Free tier: 100/dia, 3000/mês
- Dashboard: https://resend.com/emails

### HubSpot via Zapier
- Webhook URL configurado como secret `HUBSPOT_ZAPIER_URL` (opcional)

### Google OAuth
- Configurado no Google Cloud Console + Supabase Auth Providers → Google
- Domain restriction: emails na tabela `cert_allowed_users`

---

## Where secrets live (NEVER hardcode!)

### Supabase Edge Function Secrets
Set via: https://supabase.com/dashboard/project/iclpvamfvffsqptbmlfv/settings/functions

| Secret | Conteúdo |
|---|---|
| `RESEND_API_KEY` | `re_...` |
| `FROM_EMAIL` | `Time Mind <contato@joinmind.com.br>` |
| `APP_URL` | `https://mind-certificados.vercel.app` |
| `ZAPIER_WEBHOOK_URL` | Catch Hook URL do Zap 1 |
| `ZAPIER_SYNC_WEBHOOK_URL` | Catch Hook URL do Zap 2 |
| `ZAPIER_CHECK_WEBHOOK_URL` | Catch Hook URL do Zap 3 |
| `HUBSPOT_ZAPIER_URL` | (opcional) URL Zap HubSpot |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected |

### Vercel Environment Variables
Set via: `npx vercel env add` ou dashboard

| Var | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://iclpvamfvffsqptbmlfv.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_JZhGzpJBa09MQEJAkgsUgA_8AjaBgRE` |

### `.env.local` (dev local)
Já existe em `.env.local`. Contém as 2 vars `NEXT_PUBLIC_*`.

---

## Project structure

```
mind-certificados/
├── HANDOFF.md                  ← documentação completa (LER)
├── CLAUDE.md                   ← este arquivo
├── README.md                   ← onboarding inicial (defasado)
│
├── package.json                ← deps; @tiptap/* pinned em 2.27.2 (não bumpar!)
├── vercel.json                 ← installCommand customizado p/ contornar cache npm
├── next.config.mjs
├── tsconfig.json               ← strict; exclude supabase/ (Deno, não Node)
├── tailwind.config.ts          ← cores brand-green-mind (#68EE95), brand-black
├── middleware.ts               ← auth gate + whitelist check em /dashboard/*
├── .env.local                  ← vars do Supabase (não commitar)
│
├── app/                        ← Next.js App Router
│   ├── layout.tsx              ← root, favicon, Inter font
│   ├── globals.css             ← Tailwind directives
│   ├── icon.svg                ← favicon (Mind 5-circle pattern em verde)
│   ├── page.tsx                ← redir login ou dashboard
│   ├── login/page.tsx          ← Google OAuth button + error display
│   ├── auth/callback/route.ts  ← OAuth callback, checa cert_allowed_users
│   ├── claim/[token]/page.tsx  ← redir pra edge function claim-certificate
│   └── dashboard/
│       ├── layout.tsx          ← sidebar + content
│       ├── page.tsx            ← redir → /dashboard/templates
│       ├── templates/page.tsx  ← Tab 1: cards Accredible
│       ├── emitir/page.tsx     ← Tab 2: upload + processar
│       ├── historico/page.tsx  ← Tab 3: lista realtime
│       └── admin/page.tsx      ← Tab 4 (só admins)
│
├── components/
│   ├── sidebar.tsx                  ← nav + Resend counter + sign out
│   ├── template-form.tsx            ← ⚠ COMPLEXO ~800L: modal full-screen
│   ├── email-body-editor.tsx        ← TipTap wrapper
│   ├── recipient-upload.tsx         ← CSV parser (papaparse)
│   ├── recipient-manual-form.tsx
│   ├── recipient-detail-panel.tsx   ← side drawer no Histórico
│   ├── status-badge.tsx
│   ├── resend-quota-widget.tsx      ← realtime Supabase subscription
│   └── toast.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts          ← createBrowserClient (uso comum)
│   │   └── server.ts          ← createServerClient (RSC, route handlers)
│   ├── types.ts               ← interfaces de TODAS as tabelas
│   └── email-preview.ts       ← render HTML pra iframe de preview
│
└── supabase/functions/         ← ⚠ código Deno, NÃO Node!
    ├── _shared/                ← compartilhado entre funções (mas Supabase MCP deploy é per-function inline)
    ├── sync-accredible-groups/
    ├── sync-groups-callback/
    ├── check-existing-credential/
    ├── credential-check-callback/
    ├── claim-certificate/
    ├── zapier-callback/
    ├── track-event/
    └── send-announcements/     ← LEGACY, não usado mais
```

---

## Deployed edge function versions (truth source = Supabase, not local files)

| Function | Last deployed version | Status |
|---|---|---|
| `sync-accredible-groups` | v12 | ✅ |
| `sync-groups-callback` | v10 | ✅ aceita CSVs paralelos |
| `check-existing-credential` | v3 | ✅ |
| `credential-check-callback` | v5 | ✅ usa colunas `reissuance_*` |
| `claim-certificate` | v12 | ✅ apenas redireciona via Zap 1 |
| `zapier-callback` | v13 | ✅ usa colunas `post_issuance_*` |
| `track-event` | v10 | ✅ |
| `send-announcements` | v11 | 💀 LEGACY (substituído por check-existing-credential) |

**IMPORTANTE:** As cópias locais em `supabase/functions/` podem estar dessincronizadas com Supabase. Para editar uma função, ler a versão deployada via Supabase MCP `get_edge_function` ou rebuild + redeploy.

---

## Common commands

```bash
# Sempre cd primeiro
cd "/Users/adrianarossi/Library/Application Support/Claude/local-agent-mode-sessions/b1f6682d-d358-4eca-baee-9c643c69705a/d15d0aba-bd66-472a-9dff-7dbcb9f62cf3/local_d8d5be5b-ae83-44f0-b09e-363770beb64c/outputs/mind-certificados"

# Frontend
npm install                  # se mexer em package.json
npm run dev                  # localhost:3000
npx tsc --noEmit             # type check (RODAR antes de commitar)
npx next build               # production build

# Deploy frontend
npx vercel --prod            # já está linkada ao projeto

# Editar env vars no Vercel
npx vercel env add NOME_VAR production
npx vercel env rm NOME_VAR production

# Supabase Edge Functions (via MCP — preferir)
# Use mcp__e5a91c63-...__deploy_edge_function
# Para SQL queries, mcp__e5a91c63-...__execute_sql ou apply_migration
```

---

## DB schema overview

6 tabelas custom (todas prefixo `cert_`):
- `cert_course_templates` — ~35 colunas, configuração do curso + 3 emails + 4 caixas customizáveis
- `cert_recipients` — destinatários, status enum, timestamps de cada etapa
- `cert_accredible_groups` — cache dos grupos do Accredible
- `cert_email_log` — log de emails enviados (use isso pra contagem de quota Resend)
- `cert_engagement_log` — log de cliques (LinkedIn, Summit, etc)
- `cert_allowed_users` — whitelist de quem pode logar (email PK, role admin|user)

**Detalhes completos:** ver `HANDOFF.md` seção 5.

**RLS:** ativa em todas. Helper SQL functions `cert_is_admin()` e `cert_is_authorized_user()` usadas nas policies.

**FK fundamental:** `cert_email_log.recipient_id` é `ON DELETE SET NULL` (foi mudado de CASCADE em produção). Se voltar pra CASCADE, deletar um recipient apaga o log → contador de quota zera errado.

---

## Conventions / things to respect

### Não bumpar TipTap
Pacotes `@tiptap/*` estão **pinados em 2.27.2** sem caret. Versões mais novas quebram o build OU o deploy.

### Frontend usa HTML para corpo de emails, NÃO markdown
O editor TipTap salva HTML. As funções de render reconhecem se a string é HTML (detecta `<\w+[\s>]`) e injeta direto, OU se é markdown legacy (`**bold**`, paragraphs por `\n\n`) e converte. Mantém compat backward.

### Edge functions são **Deno**, não Node
- Imports usam URLs: `https://esm.sh/...` ou `jsr:...`
- `Deno.env.get('NOME')` para secrets
- `Deno.serve(async (req) => ...)` como entrypoint
- Não usar `process.env`, `require`, `fs`

### Edge function deploys são por arquivo inline
Quando deployar via Supabase MCP, o arquivo é enviado como string. Mantenha cada função self-contained ou inclua os files do _shared no payload. Hoje cada função inline tudo que precisa.

### Per-email box columns (importante)
Cada curso tem **4 caixas customizáveis**: LinkedIn-em-Email2, Summit-em-Email2, LinkedIn-em-Email3, Summit-em-Email3.

Colunas seguem o padrão `{email_type}_{box}_{field}`:
- `post_issuance_linkedin_enabled` (bool)
- `post_issuance_linkedin_html` (text)
- `post_issuance_linkedin_cta_url` (text, null = auto-gera)
- `post_issuance_linkedin_cta_label` (text, null = default)
- ... (repete pra summit e pra reissuance)

Existem **8 colunas LEGACY** (`linkedin_block_*`, `summit_block_*`) — mantidas pra backwards compat mas IGNORADAS. Não escrever nelas.

### Quando adicionar uma coluna nova
Migration via `mcp__e5a91c63-...__apply_migration` (não via execute_sql).

### Cores brand
- `#000000` preto puro
- `#FFFFFF` branco
- `#68EE95` verde Mind
- Tailwind: `brand-black`, `brand-green-mind`

---

## Common pitfalls

| Problema | Causa | Fix |
|---|---|---|
| Vercel build falha com "Invalid Version" | `package-lock.json` corrompido com entries sem version (típico de pacotes nativos opcionais como `fsevents`) | `rm package-lock.json node_modules && npm install` |
| tsc reclama de `Deno` not defined em `supabase/` | tsconfig deve ter `"exclude": ["node_modules", "supabase"]` | Já está |
| Contador Resend zera ao deletar recipient | FK era CASCADE | Já foi mudado pra SET NULL — não reverter |
| Build do Vercel pega cache antigo | Vercel cache | `vercel.json` já tem `installCommand` com `rm -rf node_modules && npm install --no-audit --no-fund --legacy-peer-deps` |
| Realtime no Histórico não atualiza | Realtime publication desabilitada | Conferir no Supabase Dashboard → Database → Replication |

---

## Where to look for things

### "Quero entender o fluxo end-to-end"
→ `HANDOFF.md` seção 4

### "Quero ver o que cada coluna faz"
→ `HANDOFF.md` seção 5

### "Onde renderiza o email final que sai pro destinatário?"
→ `supabase/functions/zapier-callback/index.ts` (Email 2) e `supabase/functions/credential-check-callback/index.ts` (Email 1 e 3)

### "Onde fica o editor de template?"
→ `components/template-form.tsx` — abre como modal full-screen com 2 colunas

### "Como saber se uma feature foi deployed ou só está local?"
→ Edge functions: `mcp__e5a91c63-...__list_edge_functions` → checa `version` + `updated_at`
→ Frontend: ver lista de deploys do Vercel

### "Quero rodar SQL na DB"
→ Use `mcp__e5a91c63-...__execute_sql` (para SELECT) ou `apply_migration` (para DDL)

---

## Adriana (operadora) — perfil

- CEO Mind, não-técnica mas confortável em terminal
- Email: `adriana@joinmind.com.br`
- Já está cadastrada como `admin` em `cert_allowed_users`
- Prefere explicações concisas, sem jargão pesado
- Comunicação em **português brasileiro**
- Usa Cowork (Claude desktop) pra design + Claude Code pra mexer em código

---

## When in doubt

1. Read `HANDOFF.md` (architecture)
2. Check this file (paths + conventions)
3. Look at production state (Supabase + Vercel dashboards) before assuming local is canonical
4. Tipos sempre via `lib/types.ts` — single source of truth
5. Ao mudar schema da DB, atualizar TANTO `lib/types.ts` QUANTO `HANDOFF.md`
6. Ao deployar nova versão de edge function, atualizar a tabela de "Deployed edge function versions" aqui em CLAUDE.md
