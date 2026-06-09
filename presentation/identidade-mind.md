# Identidade Visual — Mind

Guia de marca para apresentações e materiais Mind. Tema **light** (fundo branco),
conforme tokens oficiais.

---

## Cores

| Papel | Nome | HEX |
|---|---|---|
| Fundo | Branco | `#FFFFFF` |
| Texto | Tinta | `#13131A` |
| Texto secundário | — | `#5C5C68` |
| Card / fill claro | — | `#F6F6F8` |
| Borda | Tinta 10% | `rgba(19,19,26,0.10)` |
| **Mind** | Verde | **`#68EE95`** |
| **Prime** | Roxo | **`#9843FF`** |
| **VIP** | Coral | **`#FF7057`** |
| **Business** | Cinza | **`#2C2D3D`** |

> O verde Mind `#68EE95` é claro demais para texto pequeno sobre branco. Usamos
> ele em **preenchimentos, bordas, pontos e realces**, e uma versão legível
> `#0E9E51` (mesma família) para **texto** de ênfase. Logo/sparkle usam o `#68EE95` puro.

**Regra:** fundo branco, texto tinta, **um** termo destacado por headline (verde legível, ou realce verde).

---

## Tipografia

- **Satoshi** (Fontshare) com fallback de sistema.
  - Headlines: Satoshi **900**, `letter-spacing: -0.035em`
  - Corpo: Satoshi 500 · Kickers: 700 maiúsculas, `letter-spacing: 0.22em`
- Coloque os arquivos em `presentation/fonts/` (ver `css/fonts.css`) para Satoshi
  real em preview/PDF sem depender de CDN.

---

## Logo

Wordmark **"Mind"** em Satoshi Black `#13131A` + **sparkle** (estrela 4 pontas) verde `#68EE95`.
Canto inferior direito. Recriado em SVG/CSS — substituível pelo SVG oficial.

---

## Layout

- **16:9**, fundo branco, **cantos arredondados** (raio 20px) com borda sutil.
- Cruzes discretas (`+`) nos 4 cantos — detalhe de marca.
- Kicker (com ponto colorido) no topo · headline · conteúdo que **preenche o quadro** · logo no rodapé direito.

## Componentes (`css/minddash.css`)

| Componente | Classe |
|---|---|
| Kicker | `.kicker` (`.c` coral, `.p` roxo, `.gray`) |
| Headline + ênfase | `.headline` + `.g` (verde) / `.hl` (realce) / `.c` / `.p` |
| Linhas numeradas | `.rows` > `.numrow` (`.coral`, `.purple`) |
| Cards | `.cards` > `.card` |
| Fluxo pílula | `.flow` > `.node` (`.last` = verde) |
| Checklist | `.checklist` (`.two`) |
| Timeline (cards) | `.timeline` > `.tl` (`.last` = coral) |
| Objetivo | `.objective` |
| Preço | `.pricebox` / `.price` |
| Pílula/selo | `.pill` (`.g`/`.c`/`.p`) |
| Quote | `.quote` / `.quote-mark` |

> Nota técnica: o reveal força `display:block` nos slides — por isso o tema usa
> `display:flex !important` na section para o conteúdo preencher a altura.
