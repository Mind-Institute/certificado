# Identidade Visual — Mind

Guia de marca extraído do deck original (Figma → export PDF) e conferido pixel a pixel.
Use este documento como fonte única para qualquer nova apresentação ou material Mind.

---

## Cores

| Papel | Nome | HEX | Uso |
|---|---|---|---|
| Fundo | Preto | `#000000` | fundo de todos os slides |
| Painel | Preto suave | `#0A0A0A` | painel interno (moldura) |
| Card | Cinza-grafite | `#141414` | cartões e blocos |
| Borda | Branco 9% | `rgba(255,255,255,0.09)` | bordas sutis |
| Texto | Branco | `#FFFFFF` | texto principal |
| Secundário | Cinza | `#9A9A9A` | subtítulos, corpo |
| Legenda | Cinza escuro | `#6B6B6B` | fontes, rótulos pequenos |
| **Destaque +** | **Verde Mind** | **`#68EE95`** | positivo, ênfase, marca |
| **Destaque −** | **Coral** | **`#FF7057`** | risco, alerta, contraste |
| Estrutura | Roxo | `#9843FF` | drivers / fatores estruturais |
| Institucional | Azul | `#4A7EBB` | instituições / parceiros |

**Regra de ouro:** fundo preto, texto branco, **um** termo destacado em verde (positivo) ou coral (risco) por headline. Nunca colorir a frase inteira.

---

## Tipografia

- **Família:** Satoshi (Fontshare — gratuita)
  `https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap`
- **Headlines:** Satoshi **900** (Black), tamanho grande, `letter-spacing: -0.03em`
- **Corpo / subtítulo:** Satoshi 500
- **Kickers (rótulos de seção):** Satoshi 700, MAIÚSCULAS, `letter-spacing: 0.26em`, coloridos

---

## Logo

Wordmark **"Mind"** em Satoshi Black branco, seguido de um **sparkle** (estrela de 4 pontas) em verde `#68EE95`.
Posição padrão: canto inferior direito do slide. No deck de keynote aparece como `MindDash`; em propostas institucionais usa-se `Mind`.

> ⚠️ Recriado em SVG/CSS a partir do Figma. Quando você exportar o logo oficial (SVG), é só substituir — o componente `.logo` no `css/minddash.css` aceita troca direta.

---

## Componentes do deck (classes CSS em `css/minddash.css`)

| Componente | Classe | Para que serve |
|---|---|---|
| Rótulo de seção | `.kicker` (`.c` coral, `.p` roxo) | topo de cada slide |
| Headline | `.headline` + spans `.g`/`.c`/`.p` | título grande com palavra destacada |
| Subtítulo | `.subhead` | linha de apoio |
| Big stat | `.stat` / `.stat.huge` + `.vs` | números grandes, comparação "vs" |
| Cards | `.cards` > `.card` + `.pill` | 3 blocos com selo colorido |
| Fluxo vertical | `.flow` > `.step` | passo-a-passo (abordagem) |
| Cards numerados | `.steps-grid` > `.step-card` | metodologia / oportunidade |
| Checklist | `.checklist` (`.two` 2 colunas) | entregáveis, itens inclusos |
| Entregáveis | `.deliverables` > `.dv` | lista com regras |
| Fase | `.phase` > `.ph-tag` | selo "Fase 1..4" |
| Objetivo | `.objective` | rodapé de slide de escopo |
| Timeline | `.timeline` > `.tl-item` | cronograma horizontal |
| Bio | `.bio` | parágrafos sobre pessoa |
| Preço | `.price` + `.validity` | investimento |
| Quote | `.quote` + `.quote-mark` | slides de transição/citação |
| Cadeia | `.chain` | Driver → Experiência → Consequência |
| Comparação | `.compare` (`.x` / `.v`) | "não é / é" |

---

## Layout

- Proporção **16:9** (1280×720 base).
- Cada slide é um **painel preto arredondado** (raio 22px) com borda branca 9%, recriando a moldura do Figma.
- Margens generosas (~5%). Kicker no topo, logo no rodapé direito, fonte/legenda no rodapé esquerdo.
