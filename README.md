# Mind Certificados

Sistema interno da Mind pra emitir certificados Accredible em escala, com 2 emails customizados por curso (anúncio + pós-emissão) embrulhados no padrão visual Mind.

---

## O que já está pronto

✅ **Supabase backend** (projeto **Certificados** — `iclpvamfvffsqptbmlfv`)
- URL: `https://iclpvamfvffsqptbmlfv.supabase.co`
- 4 tabelas: `cert_course_templates`, `cert_recipients`, `cert_accredible_groups`, `cert_email_log`
- RLS restrito a usuários `@joinmind.com.br` (helper function `cert_is_mind_user()`)
- 3 edge functions deployadas e ativas:
  - `sync-accredible-groups` (verify_jwt=true)
  - `send-announcements` (verify_jwt=true)
  - `claim-certificate` (verify_jwt=false — endpoint público pro link do email)
- 1 template de exemplo já inserido: **Mind Journey 2025** (você pode editar/deletar)

✅ **Frontend Next.js 14** completo
- 3 tabs: **Templates**, **Emitir**, **Histórico**
- Autenticação por magic link (só `@joinmind.com.br`)
- Status em tempo real via Supabase Realtime
- Preview ao vivo dos emails enquanto você escreve
- `tsc --noEmit` passa sem erros

---

## 🚨 Faltam 4 passos pra ligar tudo (≈ 10 min total)

## Os 3 Zaps que você precisa publicar

| # | Zap | Função | Secret no Supabase |
|---|---|---|---|
| 1 | **Mind Certificados → Accredible** | Emite certificado quando a pessoa clica no botão do email | `ZAPIER_WEBHOOK_URL` |
| 2 | **Mind Sync Groups** | Atualiza a lista de grupos quando você cria novos no Accredible | `ZAPIER_SYNC_WEBHOOK_URL` |
| 3 | **Mind Check Credential** | Verifica se a pessoa já tem certificado antes de mandar email | `ZAPIER_CHECK_WEBHOOK_URL` |

### Zap 3 — Mind Check Credential (5 min)

**Trigger:** Webhooks by Zapier → Catch Hook → copia a URL

**Step 2 — Accredible Find Credentials**:
- App: Accredible Certificates
- Event: **Find Credentials**
- Email: mapeia pro `recipient_email` do webhook
- Group ID: mapeia pro `group_id` do webhook
- "Successful if no search results are found?" → **True** (não trata como erro)
- "If multiple search results are found" → Return first

**Step 3 — Webhooks POST**:
- Method: POST
- URL: `https://iclpvamfvffsqptbmlfv.supabase.co/functions/v1/credential-check-callback`
- Payload Type: JSON
- Data:
  - `recipient_id` → do Step 1 (Catch Hook)
  - `callback_token` → do Step 1
  - `credential_url` → do Step 2 (`URL` do Find Credentials) — pode vir vazio se não achar, e isso é OK
  - `credential_id` → do Step 2 (`ID`)
  - `issued_on` → do Step 2 (`Issued On`)

**Publica** e cola a URL do Catch Hook no Supabase como `ZAPIER_CHECK_WEBHOOK_URL`.

---

### Zap 1 — Mind Certificados → Accredible (5 min)

Como o plano Accredible que você tem não inclui API direta, a emissão vai **via Zapier** (que já tem Accredible conectado na sua conta). Vamos criar **UM** Zap com 2 etapas.

1. Abra **https://zapier.com/app/zaps** → **Create Zap**

2. **Trigger:**
   - App: **Webhooks by Zapier**
   - Event: **Catch Hook**
   - Continue → você recebe uma URL tipo `https://hooks.zapier.com/hooks/catch/12345/abcdef/`
   - **Copie essa URL**

3. **Action 1 — Criar credencial no Accredible:**
   - App: **Accredible Certificates**
   - Event: **Create Credential**
   - Configure os campos com os dados do webhook:
     - `Recipient Name` → mapeie pra `recipient_name` do webhook
     - `Recipient Email` → mapeie pra `recipient_email` do webhook
     - `Cohort Name` → mapeie pra `cohort_name` do webhook (= identifier do grupo)
     - `Issue Date` → mapeie pra `issued_on`
     - `Publish Credential` → **True**

4. **Action 2 — POST de volta pro nosso sistema:**
   - App: **Webhooks by Zapier**
   - Event: **POST**
   - URL: `https://iclpvamfvffsqptbmlfv.supabase.co/functions/v1/zapier-callback`
   - Payload Type: **JSON**
   - Data:
     - `recipient_id` → mapeie pro `recipient_id` do webhook (trigger)
     - `callback_token` → mapeie pro `callback_token` do webhook (trigger)
     - `credential_url` → mapeie pro **URL** retornado pelo Action 1 (Accredible)
     - `credential_id` → mapeie pro **ID** retornado pelo Action 1

5. **Publique o Zap** (toggle ON)

### Passo 2 — Configurar Secrets no Supabase (2 min)

1. Abra **https://supabase.com/dashboard/project/iclpvamfvffsqptbmlfv/settings/functions**
2. Em **Edge Functions → Secrets**, adicione:

| Nome | Valor |
|---|---|
| `ZAPIER_WEBHOOK_URL` | A URL que você copiou no Passo 1 (`https://hooks.zapier.com/hooks/catch/...`) |
| `RESEND_API_KEY` | sua key do Resend (resend.com → API Keys) |
| `FROM_EMAIL` | `Mind Institute <no-reply@joinmind.com.br>` |
| `APP_URL` | URL do Vercel depois do deploy (ex: `https://mind-certificados.vercel.app`) |

> **Resend:** se ainda não tem conta, crie em https://resend.com (free tier de 3.000 emails/mês). Vai precisar autenticar o domínio `joinmind.com.br` em DNS (3 registros TXT/CNAME).
> Enquanto o domínio não estiver verificado, use `onboarding@resend.dev` como `FROM_EMAIL` pra testar — só funciona enviando pra você mesma.

> **Não precisa mais de `ACCREDIBLE_API_KEY`** — Zapier resolve isso usando a integração já autenticada na sua conta Zapier.

### Passo 3 — Deploy do frontend no Vercel (2 min)

No terminal do seu Mac, dentro da pasta do projeto:

```bash
cd "/Users/adrianarossi/Library/Application Support/Claude/local-agent-mode-sessions/b1f6682d-d358-4eca-baee-9c643c69705a/d15d0aba-bd66-472a-9dff-7dbcb9f62cf3/local_d8d5be5b-ae83-44f0-b09e-363770beb64c/outputs/mind-certificados"
npx vercel
```

Quando perguntar:
- **Set up and deploy?** → Y
- **Which scope?** → sua conta pessoal
- **Link to existing project?** → N
- **Project name?** → `mind-certificados`
- **In which directory is your code?** → `./` (Enter)
- **Want to modify settings?** → N

Depois de criado, configure as env vars:

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
# Cole: https://iclpvamfvffsqptbmlfv.supabase.co
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Cole: sb_publishable_JZhGzpJBa09MQEJAkgsUgA_8AjaBgRE
```

E faça o deploy de produção:

```bash
npx vercel --prod
```

Anote a URL final (ex: `https://mind-certificados.vercel.app`) e cole no secret `APP_URL` do Supabase (passo 1).

### Passo 4 — Primeiro login (1 min)

1. Acesse a URL do Vercel
2. Login com `adriana@joinmind.com.br` → você recebe o magic link
3. Vá em **Templates** — você já tem **3 grupos sincronizados** no dropdown (Mind Journey Fellow, Formação Gestão Estratégica, Mind Summit 2025) + **1 template de exemplo** já criado (Mind Journey 2025)
4. Vá em **Emitir** → adicione você mesma como destinatário → dispare o teste!

> **Nota:** A "Sincronização de grupos do Accredible" no botão da Tab 1 não funciona mais com Zapier (porque era via API direta). Se você criar novos grupos no Accredible no futuro, me avisa que eu sincronizo via Zapier MCP, ou você adiciona manualmente em **Supabase → Table Editor → cert_accredible_groups**.

---

## Como o sistema funciona (5 min de leitura)

### Tab 1 — Templates
Você cadastra um curso uma vez. Cada curso tem:
- Nome
- Grupo Accredible (selecionado do dropdown sincronizado)
- 2 emails escritos em **texto puro**:
  - **Anúncio:** assunto + corpo do email "parabéns" com botão "Acessar certificado"
  - **Pós-emissão:** assunto + corpo do email que sai DEPOIS que a pessoa clica e o certificado é emitido (com botões LinkedIn e Mind Summit anexados automaticamente)

Você só escreve texto — o sistema embrulha automaticamente no HTML preto/branco/verde com logo Mind.

#### Variáveis dinâmicas

Use estas marcações no texto e o sistema substitui:

| Marcador | Vira |
|---|---|
| `{{primeiro_nome}}` | Primeiro nome da pessoa |
| `{{nome_certificado}}` | Nome completo (do certificado) |
| `{{curso}}` | Nome do curso |
| `{{certificate_url}}` | URL do certificado Accredible (só no pós-emissão) |
| `{{claim_url}}` | URL do botão de claim (só no anúncio) |
| `{{data_emissao}}` | Data formatada em pt-BR (só no pós-emissão) |

Texto entre `**asteriscos duplos**` vira **negrito**. Linhas em branco viram novos parágrafos.

#### Exemplo (anúncio)

```
Olá {{primeiro_nome}},

Você foi reconhecido(a) como **Mind Journey Fellow**.

Esse reconhecimento marca a conclusão de um processo de
desenvolvimento contínuo em liderança, performance e saúde mental.

O link abaixo é permanente, então você pode acessar e salvar quando quiser.
```

### Tab 2 — Emitir
1. Escolhe o curso no dropdown
2. Sobe CSV (colunas: `primeiro_nome`, `email`, `nome_certificado`) ou adiciona manualmente
3. Confirma e clica **"Enviar emails de parabéns"**
4. Sistema dispara em lote, atualiza status pra `announced`

### Tab 3 — Histórico
Lista todos os destinatários com status em tempo real:
- ⏳ **pending** — adicionado, ainda não enviou parabéns
- 📨 **announced** — recebeu o email de parabéns
- ✋ **claimed** — clicou no link
- 🎓 **issued** — certificado criado/recuperado no Accredible
- ✅ **sent** — recebeu o email final com certificado
- ❌ **failed** — algo deu errado (clica pra ver o erro)

Filtros por curso e status. Click numa linha mostra detalhes + log de emails + botão de reenviar.

---

## Decisões de design (defaults que escolhi)

1. **Tab 3 = Histórico/Status** — é a view onde você acompanha tudo
2. **Blocos LinkedIn + Mind Summit no email pós-emissão são fixos** pra todos os cursos. Se precisar tornar configurável, é uma mudança rápida no código.
3. **Pessoa que já tem certificado no Accredible** — sistema detecta automaticamente, recupera a URL, e ainda envia os 2 emails (anúncio + pós-emissão) com a credencial existente. Não duplica.
4. **Pessoa clica no link 2x** — só envia o email pós-emissão na primeira vez; nas próximas só redireciona pro certificado.
5. **Envio em lote, com confirmação** — botão "Enviar pra X pessoas. Confirmar?".
6. **Acesso** — só emails `@joinmind.com.br`. Pra adicionar mais pessoas, basta acessarem com email da Mind e elas conseguem usar o sistema.

---

## Arquitetura técnica

```
Next.js (Vercel)
       ↓
Supabase Postgres + RLS
       ↓
Edge Functions (Deno/TS):
  ├─ send-announcements   → Resend → email parabéns
  ├─ claim-certificate    → POST Zapier webhook → mostra "preparando"
  └─ zapier-callback      → recebe URL do Zapier → email pós-emissão
                                 ↑
Zapier (sua conta) — 1 Zap:
  Webhook trigger → Accredible Create Credential → Webhook POST de volta
```

- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind, @supabase/ssr
- **Backend:** Supabase Edge Functions (Deno), RLS no Postgres
- **Email:** Resend (3.000 grátis/mês, deliverability boa)
- **Certificados:** Accredible via Zapier (sem precisar do plano Business)

---

## Estrutura de pastas

```
mind-certificados/
├── app/                          # Next.js App Router
│   ├── dashboard/                # Área autenticada (3 tabs)
│   ├── login/                    # Magic link login
│   ├── auth/callback/            # OAuth callback
│   └── claim/[token]/            # Redirect pro edge function
├── components/                   # Componentes React
├── lib/                          # Supabase clients + tipos + email preview
├── supabase/
│   └── functions/                # 3 edge functions já deployadas
└── middleware.ts                 # Auth guard
```

---

## Dúvidas frequentes

**O domínio joinmind.com.br precisa estar verificado no Resend?**
Sim, pra enviar de `no-reply@joinmind.com.br`. Enquanto não verifica, use `onboarding@resend.dev` (Resend permite, mas só envia pra você mesma — bom pra testar).

**Posso mudar os botões de LinkedIn e Mind Summit?**
Sim, mas pra todos os cursos ao mesmo tempo. O código fica em `supabase/functions/claim-certificate/index.ts`. Me chama que eu altero em 1 min.

**E se eu quiser que um email saia direto sem precisar a pessoa clicar no link?**
A função `claim-certificate` pode ser chamada diretamente do `send-announcements` se você quiser auto-emitir. Hoje o fluxo passa pelo click pra dar agência à pessoa, mas é fácil mudar.

**Como vejo logs de envio?**
Supabase dashboard → Edge Functions → clica na função → Logs. Ou via tabela `cert_email_log`.

**Quanto custa por mês?**
- Supabase free tier (até 500MB DB, 2GB egress) — provavelmente fica nele por bastante tempo
- Resend free tier (3k emails/mês)
- Vercel hobby (free)
- Accredible — você já paga
- **Total marginal: $0**
