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

/* Körs i sidan: plockar ut text per rubrik, utan meny, sidfot och sökblocket.
   Klickar sedan igenom kodblockens flikar (år 1, år 2 …) och inriktningar, eftersom
   bara den valda fliken finns på sidan åt gången. Text som bara syns i en annan flik
   sparas med flikens adress (t.ex. "ar=3&inr=past") så att sökträffen öppnar rätt flik. */
async function extract(){
  const SKIP = 'header,footer,nav,script,style,noscript,template,iframe,svg,select,option,' +
    '.header,#footer-sections,.sqs-block-search,[data-alt-block="sidfot"],[data-alt-block="sok"],' +
    '.altg-ed,[aria-hidden="true"],.sqs-cookie-banner-v2,.sqs-announcement-bar-dropzone,#alt-sok,#alt-footer';
  const clean = s => s.replace(/\s+/g, ' ').trim();
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function chunksOf(root, startH){
    const chunks = []; let cur = { h:startH || '', id:'', x:[] };
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
    return chunks;
  }
  /* Närmaste rubrik före kodblocket, så att text i början av blocket hamnar under rätt rubrik */
  function headingBefore(el){
    const hs = [...document.querySelectorAll('h1,h2,h3,h4')].filter(h => h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !h.closest(SKIP));
    return hs.length ? clean(hs[hs.length - 1].textContent) : '';
  }

  const root = document.querySelector('#page') || document.querySelector('main') || document.body;
  const startHash = location.hash;
  const chunks = chunksOf(root);
  const extra = [];

  const blocks = [...document.querySelectorAll('[data-alt-block]')].filter(b => !b.matches(SKIP) && !b.closest(SKIP));
  for (const b of blocks){
    const tabs = () => [...b.querySelectorAll('[role="tab"]')];
    const tracks = () => [...b.querySelectorAll('[data-act="track"]')];
    const nTabs = tabs().length;
    if (!nTabs && !tracks().length) continue;            // inget att klicka igenom
    const before = headingBefore(b);
    for (let i = 0; i < Math.max(nTabs, 1); i++){
      if (nTabs){ const t = tabs()[i]; if (!t) break; t.click(); await wait(500); }
      const nTracks = tracks().length;
      for (let j = 0; j < Math.max(nTracks, 1); j++){
        if (nTracks){ const t = tracks()[j]; if (!t) break; t.click(); await wait(500); }
        extra.push({ st:location.hash.replace(/^#/, ''), before, chunks:chunksOf(b, before) });
      }
    }
    if (nTabs && tabs()[0]) { tabs()[0].click(); await wait(200); }   // tillbaka till första fliken
  }
  try { history.replaceState(null, '', location.pathname + location.search + startHash); } catch (e) {}

  /* Lägg till det som inte redan fanns på sidan när den öppnades */
  const key = c => c.h + '|' + c.x;
  const seen = new Set(chunks.map(key));
  extra.forEach(e => e.chunks.forEach(c => {
    if (c.h === e.before) return;                         // flikraden m.m. överst i blocket finns redan med
    if (seen.has(key(c))) return; seen.add(key(c));
    chunks.push({ ...c, st:e.st });
  }));

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

/* Kompakt format: p = sidor [url, titel, beskrivning], c = stycken [sida, rubrik, id, text, flik]
   (flik finns bara när texten ligger i en annan flik i ett kodblock, t.ex. "ar=3") */
pages.sort((a, b) => a.url.localeCompare(b.url, 'sv'));
const seen = new Set(), out = { built:new Date().toISOString(), p:[], c:[] };
pages.forEach(p => {
  const path = new URL(p.url).pathname.replace(/\/$/, '') || '/';
  if (seen.has(path) || path === '/home') return; seen.add(path);
  const pi = out.p.push([path, p.title, p.desc]) - 1;
  p.chunks.forEach(c => { if (c.h || c.x.length > 2) out.c.push(c.st ? [pi, c.h, c.id, c.x.slice(0, 8000), c.st] : [pi, c.h, c.id, c.x.slice(0, 8000)]); });
});
if (out.p.length < 5) { console.error('För få sidor (' + out.p.length + ') – sparar inte indexet.'); process.exit(1); }
writeFileSync(OUT, JSON.stringify(out));
console.log('Klart: ' + out.p.length + ' sidor, ' + out.c.length + ' stycken');
