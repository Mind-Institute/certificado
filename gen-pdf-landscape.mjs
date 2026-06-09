import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';

const EXEC = '/tmp/chrome-headless-shell-linux64/chrome-headless-shell';
const file = '/home/user/certificado/Mind_Dash_Proposta_Disney_v3.html';
let html = readFileSync(file, 'utf8');

const PAD = 44;            // padding interno de cada página (px)
const PAGE_W = 1123, PAGE_H = 794;   // A4 landscape em px @96dpi

const printCss = `
<style id="print-fix">
  @page { size: A4 landscape; margin: 0; }
  html, body { background:#000 !important; }
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
  .rv{opacity:1 !important;transform:none !important;transition:none !important}

  section, header.cover{
    break-before: page;
    border-bottom: none !important;
    padding: ${PAD}px var(--pad) !important;
    min-height: 100vh;
    display: flex; flex-direction: column; justify-content: center;
  }
  header.cover{ break-before: avoid; }

  /* a jornada semana-a-semana flui em varias paginas, alinhada ao topo */
  section.flow{ justify-content: flex-start !important; }

  /* nunca cortar um bloco no meio de uma pagina */
  .card,.box,.week,.step,.phase,.inv,.how,.chip,.row,.three .box,
  .mlists .box,.ptab .r,.feat div,.incl div{ break-inside: avoid; }
  h2,.eyebrow{ break-after: avoid; }
</style>`;
html = html.replace('</head>', printCss + '</head>');

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox','--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: PAGE_W, height: PAGE_H }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(400);

// Auto-encaixe: cada secao (exceto a jornada) vira exatamente 1 pagina,
// com o conteudo escalado para caber sem transbordar.
const report = await page.evaluate(({ PAGE_H, PAD }) => {
  // marca a secao da jornada (contem .weeks) para fluir em varias paginas
  const wk = document.querySelector('.weeks');
  if (wk) wk.closest('section').classList.add('flow');

  const usable = PAGE_H - PAD * 2;
  const out = [];
  document.querySelectorAll('section, header.cover').forEach((sec, i) => {
    if (sec.classList.contains('flow')) { out.push(`#${i} flow`); return; }
    const wrap = sec.querySelector('.wrap');
    if (!wrap) return;
    const h = wrap.getBoundingClientRect().height;
    let s = 1;
    if (h > usable) {
      s = usable / h;
      wrap.style.transform = `scale(${s})`;
      wrap.style.transformOrigin = 'center center';
    }
    sec.style.height = PAGE_H + 'px';
    sec.style.minHeight = PAGE_H + 'px';
    sec.style.overflow = 'hidden';
    out.push(`#${i} h=${Math.round(h)} scale=${s.toFixed(2)}`);
  });
  return out;
}, { PAGE_H, PAD });
console.log(report.join('\n'));

await page.pdf({
  path: '/home/user/certificado/Mind_Dash_Proposta_Disney_v3_landscape.pdf',
  width: '297mm', height: '210mm',
  printBackground: true,
  preferCSSPageSize: true,
});

await browser.close();
console.log('PDF landscape gerado');
