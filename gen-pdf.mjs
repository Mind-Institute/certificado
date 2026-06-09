import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';

const EXEC = '/tmp/chrome-headless-shell-linux64/chrome-headless-shell';

const file = '/home/user/certificado/Mind_Dash_Proposta_Disney_v3.html';
let html = readFileSync(file, 'utf8');

// Força os elementos de reveal visíveis e mantém cores/fundos na impressão
const printCss = `
<style id="print-fix">
  .rv{opacity:1 !important;transform:none !important;transition:none !important}
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
  .cover{min-height:auto !important;padding:90px 0 !important}
  section{break-inside:avoid-page}
  .card,.box,.week,.step,.phase,.inv,.how,.chip{break-inside:avoid}
</style>`;
html = html.replace('</head>', printCss + '</head>');

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
// garante fontes carregadas
await page.evaluate(() => document.fonts.ready);
// mede já no modo de impressão (o layout reflui um pouco diferente da tela)
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(500);

// altura total do conteúdo + folga para gerar UMA página contínua sem cortar nada
const height = await page.evaluate(() => Math.max(
  document.body.scrollHeight,
  document.documentElement.scrollHeight,
  document.documentElement.getBoundingClientRect().height
)) + 40;

await page.pdf({
  path: '/home/user/certificado/Mind_Dash_Proposta_Disney_v3.pdf',
  width: '1200px',
  height: `${height}px`,
  printBackground: true,
  pageRanges: '1',
});

await browser.close();
console.log('PDF gerado · altura:', height, 'px');
