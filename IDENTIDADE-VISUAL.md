# Identidade Visual — Mind

> **Fonte única e oficial** da identidade visual do Mind.
> Este arquivo é portátil: copie/cole/anexe em qualquer projeto (Claude Code, Cowork, Figma, Canva, papel timbrado, propostas, decks). Se algo mudar na marca, mude **aqui** primeiro.

---

## Paleta de cores

| Cor | Hex | Uso |
|---|---|---|
| 🟢 **Verde Mind** | `#68EE95` | Positivo, destaque, marca |
| 🔴 **Coral** | `#FF7057` | Risco, alerta |
| 🟣 **Roxo** | `#9843FF` | Drivers / engajamento |
| ⚫ **Preto** | `#000000` | Fundo |
| ⚪ **Branco** | `#FFFFFF` | Texto |

> Observação: as descrições da coluna "Uso" de Verde, Roxo e Coral estavam parcialmente cortadas na referência original. Os usos acima refletem o que foi confirmado — ajustar caso a Adriana detalhe melhor.

## Tipografia

- **Fonte oficial: Satoshi** — usada em **toda** a tipografia (títulos e corpo).
- Em ambientes onde Satoshi não estiver disponível, usar fallback sans-serif neutro (`system-ui`, `sans-serif`).
- Satoshi **não** é uma fonte do Google Fonts — é da Fontshare (Indian Type Foundry). Para web, carregar via Fontshare ou arquivos `.woff2` próprios.

## Logo

- Wordmark **"mind"** em verde (`#68EE95`) + símbolo de 4 pétalas/cruz à direita.
- Arquivo de referência neste repositório: `logo.png`.
- Símbolo/ícone: padrão de 5 círculos verdes sobre fundo preto (ver `app/icon.svg`).

---

## Tokens para código (Tailwind)

```ts
colors: {
  brand: {
    "green-mind": "#68EE95", // positivo / destaque
    coral:        "#FF7057", // risco / alerta
    roxo:         "#9843FF", // drivers / engajamento
    black:        "#000000", // fundo
    white:        "#FFFFFF", // texto
  },
}
```

## Variáveis CSS (para HTML / papel timbrado / e-mail)

```css
:root {
  --mind-verde:  #68EE95;
  --mind-coral:  #FF7057;
  --mind-roxo:   #9843FF;
  --mind-preto:  #000000;
  --mind-branco: #FFFFFF;
  --mind-fonte:  "Satoshi", system-ui, sans-serif;
}
```
