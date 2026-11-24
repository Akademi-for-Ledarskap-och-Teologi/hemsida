/* =====================================================================
   ALT – bygger sökindexet (sokindex.json) för sökblocket (block/sok.html)

   Går igenom alla sidor i altutbildning.se/sitemap.xml i en riktig webbläsare,
   väntar tills kodblocken (och deras data från Drive) har laddats och sparar
   texten på varje sida uppdelad per rubrik. På så vis hittar sökningen både
   Squarespace-innehåll och allt som kodblocken visar.

   Körs automatiskt av GitHub Actions (.github/workflows/sokindex.yml):
   varje natt, när ett kodblock ändras och när man kör det för hand.
   Lokalt: npm i puppeteer-core && CHROME=/usr/bin/google-chrome node verktyg/bygg-sokindex.mjs
   ===================================================================== */
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const SITE = process.env.SITE || 'https://www.altutbildning.se';
const OUT = process.env.OUT || new URL('../sokindex.json', import.meta.url);
const SKIP_URL = /\/(cart|checkout|account|commerce|config|search|s\/|testansokan)(\/|$|\?)/i;
const EXTRA = ['/'];                                   // sidor som alltid ska med
const PARALLEL = 4;

async function sitemapUrls(){
  const xml = await (await fetch(SITE + '/sitemap.xml')).text();
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, '&'));
  const all = new Set(EXTRA.map(p => SITE + p));
  urls.forEach(u => { try { const x = new URL(u); if (x.origin !== new URL(SITE).origin && !/altutbildning\.se$/.test(x.hostname)) return; all.add(SITE + x.pathname); } catch {} });
  return [...all].filter(u => !SKIP_URL.test(new URL(u).pathname));
}

/* Körs i sidan: plockar ut text per rubrik, utan meny, sidfot och sökblocket */
function extract(){
  const SKIP = 'header,footer,nav,script,style,noscript,template,iframe,svg,select,option,' +
    '.header,#footer-sections,.sqs-block-search,[data-alt-block="sidfot"],[data-alt-block="sok"],' +
    '.altg-ed,[aria-hidden="true"],.sqs-cookie-banner-v2,.sqs-announcement-bar-dropzone,#alt-sok,#alt-footer';
  const root = document.querySelector('#page') || document.querySelector('main') || document.body;
  const clean = s => s.replace(/\s+/g, ' ').trim();
  const chunks = []; let cur = { h:'', id:'', x:[] };
  const push = () => { const x = clean(cur.x.join(' ')); if (cur.h || x) chunks.push({ h:cur.h, id:cur.id, x }); };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n){
      if (n.nodeType === 1 && n.matches(SKIP)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n;
  while ((n = walker.nextNode())){
    if (n.nodeType === 1){
      if (/^H[1-4]$/.test(n.tagName)){
        const h = clean(n.textContent);
        if (h){ push(); cur = { h, id:n.id || '', x:[] }; }
        walker.currentNode = n;               // hoppa över rubrikens egna textnoder
        let last = n; while (last.lastChild) last = last.lastChild; walker.currentNode = last;
      } else if (n.tagName === 'BR' || /^(P|LI|DIV|SECTION|ARTICLE|TD|TH|DT|DD)$/.test(n.tagName)) cur.x.push(' ');
      else if (n.tagName === 'INPUT' && /^(button|submit)$/i.test(n.type)) cur.x.push(n.value);
    } else {
      cur.x.push(n.nodeValue);
    }
  }
  push();
  const og = document.querySelector('meta[property="og:title"]');
  let title = clean((og && og.content) || document.title || '');
  title = title.replace(/\s*[—–|-]\s*(ALT|Akademi för Ledarskap och Teologi).*$/i, '');
  const desc = document.querySelector('meta[name="description"]');
  return { title, desc:clean((desc && desc.content) || ''), chunks };
}

async function crawl(browser, url){
  const page = await browser.newPage();
  await page.setViewport({ width:1280, height:900 });
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 ALT-sokindex');
  try {
    const res = await page.goto(url, { waitUntil:'networkidle2', timeout:60000 });
    if (!res || res.status() >= 400) { console.warn('  hoppar över', res && res.status(), url); return null; }
    const finalUrl = page.url().split('#')[0];
    // Vänta på kodblocken och deras data (Drive, kalkylark ...)
    await page.waitForFunction(() => [...document.querySelectorAll('[data-alt-block]')].every(el => el.getAttribute('data-alt-loaded') && el.children.length), { timeout:20000 }).catch(() => {});
    await page.waitForNetworkIdle({ idleTime:1500, timeout:20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));
    const data = await page.evaluate(extract);
    return { url:finalUrl, ...data };
  } catch (e) {
    console.warn('  fel', url, e.message); return null;
  } finally { await page.close(); }
}

const urls = await sitemapUrls();
console.log(urls.length + ' sidor');
const browser = await puppeteer.launch({ executablePath:process.env.CHROME || '/usr/bin/google-chrome', args:['--no-sandbox','--disable-gpu'] });
const pages = []; let i = 0;
await Promise.all(Array.from({ length:PARALLEL }, async () => {
  while (i < urls.length){ const u = urls[i++]; const p = await crawl(browser, u); if (p) { pages.push(p); console.log('  ok', p.chunks.length, u); } }
}));
await browser.close();

/* Kompakt format: p = sidor [url, titel, beskrivning], c = stycken [sida, rubrik, id, text] */
pages.sort((a, b) => a.url.localeCompare(b.url, 'sv'));
const seen = new Set(), out = { built:new Date().toISOString(), p:[], c:[] };
pages.forEach(p => {
  if (seen.has(p.url)) return; seen.add(p.url);
  const pi = out.p.push([p.url.replace(SITE, '') || '/', p.title, p.desc]) - 1;
  p.chunks.forEach(c => { if (c.h || c.x.length > 2) out.c.push([pi, c.h, c.id, c.x.slice(0, 8000)]); });
});
if (out.p.length < 5) { console.error('För få sidor (' + out.p.length + ') – sparar inte indexet.'); process.exit(1); }
writeFileSync(OUT, JSON.stringify(out));
console.log('Klart: ' + out.p.length + ' sidor, ' + out.c.length + ' stycken');
