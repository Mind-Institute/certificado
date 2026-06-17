# Assistente Inteligente — Alexa → Claude

Skill personalizada da Alexa que captura sua fala, manda para a **API do Claude
(Anthropic)** e devolve a resposta em voz alta. Tem **memória curta**: enquanto a
sessão estiver aberta, o Claude lembra do que já foi dito.

```
Você fala ─▶ Alexa (AMAZON.SearchQuery) ─▶ Lambda (Node.js) ─▶ API do Claude
                                                                     │
Você ouve ◀─ Alexa lê a resposta ◀──────────────────────────────────┘
```

> **Importante:** isto NÃO é "ligar a Alexa ao app do Claude". É uma skill própria
> que você invoca: *"Alexa, abrir assistente inteligente"*. Você precisa de uma
> **chave de API da Anthropic** (cobrada por uso) — uma assinatura do Claude.ai
> não serve aqui.

---

## Estrutura

```
alexa-claude-skill/
├── lambda/
│   ├── index.js          # lógica da skill + chamada ao Claude
│   └── package.json      # dependências (ask-sdk-core, @anthropic-ai/sdk)
└── skill-package/
    ├── skill.json        # manifesto da skill
    └── interactionModels/custom/pt-BR.json   # frases e intents
```

---

## Pré-requisitos

1. Conta no **Amazon Developer Console** → https://developer.amazon.com/alexa/console/ask
2. Chave de API da **Anthropic** → https://console.anthropic.com/ (em *API Keys*)

---

## Opção A — Deploy mais simples: Alexa-hosted (recomendado para começar)

1. No [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask),
   clique em **Create Skill**.
2. Nome: `Assistente Inteligente` · Idioma: **Português (BR)**.
3. Tipo: **Custom** · Backend: **Alexa-hosted (Node.js)**.
4. Quando a skill abrir:
   - Aba **Build → Interaction Model → JSON Editor**: cole o conteúdo de
     `skill-package/interactionModels/custom/pt-BR.json` e clique em **Save** e
     depois em **Build Model**.
   - Aba **Code**: substitua o `index.js` e o `package.json` pelos arquivos da
     pasta `lambda/`. Clique em **Save** e **Deploy**.
5. Configure a chave da Anthropic como variável de ambiente:
   - Em projetos Alexa-hosted, adicione no topo do `index.js` **não** — em vez
     disso use o painel de variáveis do ambiente, ou crie a env var pela aba
     **Code** (terminal) com `ask`/configuração do projeto. Se preferir o caminho
     mais robusto e com controle de env vars, use a **Opção B (AWS Lambda)**.

> Alexa-hosted tem limitações para gerenciar variáveis de ambiente. Se quiser
> controle total da `ANTHROPIC_API_KEY`, vá direto para a Opção B.

---

## Opção B — AWS Lambda (mais robusto, controle total de variáveis)

### 1. Crie a função Lambda

1. No [AWS Console](https://console.aws.amazon.com/lambda) → **Create function**.
2. Runtime: **Node.js 18+** · região recomendada: `us-east-1` (Alexa usa essa).
3. Em **Configuration → Environment variables**, adicione:

   | Chave | Valor |
   |---|---|
   | `ANTHROPIC_API_KEY` | sua chave `sk-ant-...` |
   | `MODEL` | `claude-opus-4-8` (opcional — veja abaixo) |
   | `MAX_TOKENS` | `400` (opcional) |
   | `MAX_HISTORY` | `10` (opcional) |

4. Em **Configuration → General configuration**, aumente o **Timeout** para
   **8 segundos** (limite da Alexa).

### 2. Suba o código

```bash
cd lambda
npm install
zip -r ../skill.zip .          # inclui node_modules
# faça upload do skill.zip em Lambda → Code → Upload from → .zip file
```

### 3. Conecte Lambda ↔ Alexa

1. Na Lambda, adicione o trigger **Alexa Skills Kit** (cole o *Skill ID* da skill).
2. Copie o **ARN** da Lambda.
3. No Alexa Console → **Build → Endpoint** → selecione **AWS Lambda ARN** e cole o ARN.
4. **Build → Interaction Model → JSON Editor**: cole o `pt-BR.json`, salve e
   **Build Model**.

---

## Testar

Aba **Test** do Alexa Console (mude para **Development**), ou em qualquer
dispositivo Echo logado na mesma conta:

```
Você:   Alexa, abrir assistente inteligente
Alexa:  Olá! Sou seu assistente inteligente. Pode perguntar.
Você:   Explique segurança psicológica para líderes em uma frase prática.
Alexa:  (resposta do Claude, falada)
Você:   E como eu meço isso no meu time?      ← ela lembra do contexto
```

Para encerrar: *"parar"* ou *"cancelar"*.

---

## Escolha do modelo (latência × qualidade × custo)

O modelo é configurável pela env var `MODEL`. Para voz, latência importa:

| Cenário | Sugestão |
|---|---|
| Respostas mais inteligentes | `claude-opus-4-8` (padrão) |
| Mais rápido e mais barato (ideal p/ voz) | `claude-haiku-4-5` |

A skill já manda `effort: "low"`, `max_tokens` baixo e um prompt pedindo
respostas curtas — tudo para caber no limite de ~8 s da Alexa.

---

## Custo

- **Alexa / AWS Lambda:** o uso leve cabe no nível gratuito.
- **API da Anthropic:** cobrada por token (entrada + saída). Respostas curtas de
  voz custam frações de centavo cada. Veja https://www.anthropic.com/pricing.

---

## Limitações

- Você precisa invocar a skill ("abrir assistente inteligente") — ela não
  substitui a Alexa nativa.
- A memória é por sessão; ao fechar, zera. Para memória persistente entre
  sessões, dá para guardar o histórico no DynamoDB (próximo passo possível).
- Para conversa fluida com áudio em streaming e baixa latência, o caminho seria
  um app próprio usando a **Realtime API** — fora do escopo de uma Alexa Skill.

---

## Mover para um repositório próprio

Esta pasta é autocontida. Para extraí-la para um repo novo:

```bash
# a partir da raiz do repositório atual
cp -r alexa-claude-skill /caminho/para/novo-repo
cd /caminho/para/novo-repo
git init && git add . && git commit -m "Alexa Claude skill inicial"
# git remote add origin git@github.com:SEU_USUARIO/alexa-claude-skill.git
# git push -u origin main
```
