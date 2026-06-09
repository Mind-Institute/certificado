# Mind — Proposta de Consultoria · Disney Brasil

Apresentação em **reveal.js** (HTML), na identidade visual Mind.
Pode ser **hospedada online** (link para o cliente) ou **exportada em PDF**.

---

## Ver localmente

Abra `index.html` num navegador. Para evitar bloqueios de CORS da fonte/CDN,
sirva por um servidor local:

```bash
cd presentation
python3 -m http.server 8000
# abra http://localhost:8000
```

**Navegação:** setas ← →, `Esc` (visão geral), `F` (tela cheia), `S` (notas).

---

## Exportar em PDF

1. Abra com `?print-pdf` no fim da URL:
   `http://localhost:8000/?print-pdf`
2. `Ctrl/Cmd + P` → **Salvar como PDF**
3. Configurações: **Paisagem**, margens **Nenhuma**, ativar **Gráficos de plano de fundo**.

> Dica: use o Chrome para o PDF mais fiel.

---

## Hospedar online (Vercel)

O deck é estático — sobe direto:

```bash
cd presentation
npx vercel        # primeira vez: segue o assistente
npx vercel --prod # publica e gera o link
```

Ou no painel da Vercel: novo projeto → aponte para a pasta `presentation/`
(sem build command; é HTML puro). Funciona igual em GitHub Pages / Netlify.

---

## Estrutura

```
presentation/
├── index.html            ← os 16 slides (15 de conteúdo + fecho)
├── css/minddash.css      ← tema/identidade Mind (cores, Satoshi, componentes)
├── identidade-mind.md    ← guia de marca (cores, fonte, logo, componentes)
└── README.md             ← este arquivo
```

## Editar conteúdo

Cada slide é um `<section>` em `index.html`, comentado (`SLIDE 1`, `SLIDE 2`...).
O texto fica direto no HTML — edite à vontade. Para cor de destaque numa palavra,
envolva em `<span class="g">verde</span>` ou `<span class="c">coral</span>`.

Os estilos vivem em `css/minddash.css`. Veja `identidade-mind.md` para a lista
de componentes reutilizáveis.

## Logo oficial

O logo "Mind" está recriado em SVG/CSS. Quando exportar o SVG oficial do Figma,
substitua o bloco `<div class="logo">…</div>` por `<img>` apontando para o arquivo.
