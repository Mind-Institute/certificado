import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';

const EXEC = '/tmp/chrome-headless-shell-linux64/chrome-headless-shell';
const file = '/home/user/certificado/Mind_Dash_Proposta_Disney_v3.html';
let html = readFileSync(file, 'utf8');

// CSS de impressão: paginação A4, cada seção em página nova, blocos nunca cortados
const printCss = `
<style id="print-fix">
  @page { size: A4; margin: 0; }
  html, body { background:#000 !important; }
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
  .rv{opacity:1 !important;transform:none !important;transition:none !important}

  /* cada seção começa em uma página nova, com respiro consistente */
  section, header.cover{
    break-before: page;
    border-bottom: none !important;
    padding: 60px var(--pad) !important;
    min-height: 100vh;
    display: flex; flex-direction: column; justify-content: center;
  }
  header.cover{ break-before: avoid; }

  /* nunca cortar um bloco no meio de uma página */
  .card,.box,.week,.step,.phase,.inv,.how,.chip,.row,.three .box,
  .mlists .box,.ptab .r,.feat div,.incl div{ break-inside: avoid; }
  .weeks,.tl,.grid3,.grid2,.mlists,.phases,.three,.rows,.ptab,.incl{ break-inside: auto; }

  /* títulos não ficam órfãos do conteúdo seguinte */
  h2{ break-after: avoid; }
  .eyebrow{ break-after: avoid; }
</style>`;
html = html.replace('</head>', printCss + '</head>');

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox','--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(400);

await page.pdf({
  path: '/home/user/certificado/Mind_Dash_Proposta_Disney_v3_paginado.pdf',
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
});

await browser.close();
console.log('PDF paginado gerado');
