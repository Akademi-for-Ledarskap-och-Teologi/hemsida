/* =====================================================================
   ALT – Gradientbilder (gemensamt för alla kodblock)

   Bilderna i rutorna styrs från Google Drive:
     Mapp:      ALT / Gradientbilder
     Kalkylark: "Gradientbilder – koppling till block", flik "Koppling"
       Block | Ruta | Bild | Gradientfärg | Sidled ruta | Höjdled ruta |
       Sidled stor ruta | Höjdled stor ruta | Kommentar

   Bild = filnamn i mappen Gradientbilder (med eller utan filändelse)
          eller en fullständig bildlänk (https://...).
   Sidled/Höjdled = 0–100 (%). Tomt = 50. "Stor ruta" tom = samma som rutan.

   Finjustera på sidan: lägg till #bildfokus i adressen, t.ex.
   altutbildning.se/teologiaret#bildfokus

   Blocken använder:
     ALTGrad.get(block, function(){ ...rendera om... })
     ALTGrad.entry(block, ruta)              -> {img, c, tab, hero} eller null
     ALTGrad.layers(block, ruta, where, färg, riktning) -> HTML (bild + toning)
     ALTGrad.pos(block, ruta, where)         -> "x% y%"
     where: 'tab' = lilla rutan, 'hero' = stora rutan
   ===================================================================== */
(function(){
  if (window.ALTGrad) return;

  var FOLDER = '1HSa_eDz1CJZTbTLAxUAIY2vPTndCvyB2';
  var SHEET  = '1NxxOzC46kYvwhVmjVyvE1ytPPdCqYrF83Cu2NbeqUQ8';
  var TAB    = 'Koppling';
  var KEY    = 'AIzaSyAEunCE3KQD22E1s5goQSIj6G29QB_-Npc';
  var CACHE  = 'alt-grad-v1';

  var DATA = null, subs = [], started = false;

  function norm(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function pct(v){
    v = String(v == null ? '' : v).trim().replace('%', '').replace(',', '.');
    if (!v || isNaN(+v)) return null;
    return Math.max(0, Math.min(100, +v));
  }
  function rgba(hex, a){
    var m = String(hex || '').replace('#', '').match(/^([0-9a-f]{6})$/i); if (!m) return 'rgba(0,0,0,' + a + ')';
    var n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function parseCSV(t){
    var rows = [], row = [], cur = '', q = false, i, c;
    for (i = 0; i < t.length; i++){
      c = t[i];
      if (q){ if (c === '"'){ if (t[i+1] === '"'){ cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ','){ row.push(cur); cur = ''; }
      else if (c === '\n'){ row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
    if (cur !== '' || row.length){ row.push(cur); rows.push(row); }
    return rows;
  }
  function driveList(pageToken){
    var q = encodeURIComponent("'" + FOLDER + "' in parents and trashed=false");
    return fetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&key=' + KEY + '&pageSize=1000&fields=nextPageToken,files(id,name,mimeType)' + (pageToken ? '&pageToken=' + pageToken : ''))
      .then(function(r){ if (!r.ok) throw new Error('Drive ' + r.status); return r.json(); })
      .then(function(d){ if (!d.nextPageToken) return d.files || []; return driveList(d.nextPageToken).then(function(m){ return (d.files || []).concat(m); }); });
  }

  function notify(){ subs.forEach(function(fn){ try { fn(); } catch (e) { console.error('[ALT] Gradientbilder:', e); } }); }

  function build(rows, files){
    var head = (rows[0] || []).map(norm), data = {};
    function col(word, fb){ for (var i = 0; i < head.length; i++) if (head[i].indexOf(word) === 0) return i; return fb; }
    var cB = col('block', 0), cR = col('ruta', 1), cI = col('bild', 2), cC = col('gradientfarg', 3),
        cX = col('sidled ruta', 4), cY = col('hojdled ruta', 5), cXH = col('sidled stor', 6), cYH = col('hojdled stor', 7);
    rows.slice(1).forEach(function(r){
      var b = norm(r[cB]), k = norm(r[cR]), v = String(r[cI] || '').trim(); if (!b || !k || !v) return;
      var img = null;
      if (/^https?:\/\//i.test(v)) img = /squarespace-cdn\.com/.test(v) ? v.split('?')[0] + '?format=1500w' : v;
      else { var id = files[norm(v)]; if (id) img = 'https://lh3.googleusercontent.com/d/' + id + '=w2000'; }
      if (!img) return;
      var c = String(r[cC] || '').trim(); if (c && c[0] !== '#') c = '#' + c;
      (data[b] = data[b] || {})[k] = {
        img:img, c:/^#[0-9a-f]{6}$/i.test(c) ? c : null, name:String(r[cR]).trim(), block:String(r[cB]).trim(),
        tab:{ x:pct(r[cX]), y:pct(r[cY]) }, hero:{ x:pct(r[cXH]), y:pct(r[cYH]) }
      };
    });
    return data;
  }

  function start(){
    if (started) return; started = true;
    try { DATA = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) {}
    if (DATA) setTimeout(notify, 0);
    if (!window.fetch) return;
    var sheet = fetch('https://docs.google.com/spreadsheets/d/' + SHEET + '/gviz/tq?tqx=out:csv&headers=1&sheet=' + encodeURIComponent(TAB))
      .then(function(r){ if (!r.ok) throw new Error('Sheet ' + r.status); return r.text(); }).then(parseCSV);
    var drive = driveList().catch(function(){ return []; });   // utan Drive fungerar fortfarande bildlänkar
    Promise.all([sheet, drive]).then(function(res){
      var files = {};
      res[1].forEach(function(f){
        if (!/^image\//.test(f.mimeType || '')) return;
        var n = f.name.normalize ? f.name.normalize('NFC') : f.name;
        files[norm(n)] = f.id; files[norm(n.replace(/\.[a-z0-9]+$/i, ''))] = f.id;
      });
      DATA = build(res[0], files);
      try { localStorage.setItem(CACHE, JSON.stringify(DATA)); } catch (e) {}
      notify(); if (ED) edBuild();
    }).catch(function(e){ console.warn('[ALT] Gradientbilder kunde inte hämtas:', e); });
  }

  function entry(block, ruta){ var b = DATA && DATA[norm(block)]; return (b && b[norm(ruta)]) || null; }
  function set(e, where){
    var t = e.tab || {}, h = e.hero || {};
    var tx = t.x != null ? t.x : 50, ty = t.y != null ? t.y : 50;
    return where === 'hero' ? { x:h.x != null ? h.x : tx, y:h.y != null ? h.y : ty } : { x:tx, y:ty };
  }
  function pos(block, ruta, where){ var e = entry(block, ruta); if (!e) return '50% 50%'; var s = set(e, where); return s.x + '% ' + s.y + '%'; }
  var DIRS = {
    tab:  function(c){ return 'linear-gradient(20deg,' + rgba(c, .97) + ' 0%,' + rgba(c, .82) + ' 40%,' + rgba(c, .3) + ' 100%)'; },
    hero: function(c){ return 'linear-gradient(90deg,' + rgba(c, .97) + ' 0%,' + rgba(c, .9) + ' 40%,' + rgba(c, .45) + ' 75%,' + rgba(c, .25) + ' 100%)'; },
    up:   function(c){ return 'linear-gradient(to top,' + rgba(c, 1) + ' 0%,' + rgba(c, 1) + ' 34%,' + rgba(c, .55) + ' 58%,' + rgba(c, 0) + ' 82%)'; }
  };
  function attrs(block, ruta, where){ return ' data-altg-block="' + norm(block) + '" data-altg-ruta="' + norm(ruta) + '" data-altg-where="' + where + '"'; }
  function layers(block, ruta, where, color, dir){
    var e = entry(block, ruta); if (!e) return '';
    var g = (DIRS[dir] || DIRS[where] || DIRS.hero)(e.c || color);
    return '<span class="altg-bg" aria-hidden="true"' + attrs(block, ruta, where) + ' style="background-image:url(&quot;' + e.img + '&quot;);background-position:' + pos(block, ruta, where) + '"></span>' +
           '<span class="altg-ov" aria-hidden="true" style="background:' + g + '"></span>';
  }
  /* För block som har en <img> i rutan: byt bild och läge, markera för verktyget */
  function img(el, block, ruta, where){
    var e = entry(block, ruta); if (!el || !e) return false;
    el.setAttribute('data-altg-block', norm(block)); el.setAttribute('data-altg-ruta', norm(ruta)); el.setAttribute('data-altg-where', where);
    el.style.objectPosition = pos(block, ruta, where);
    if (el.getAttribute('src') !== e.img){ var p = new Image(); p.onload = function(){ el.src = e.img; el.hidden = false; }; p.src = e.img; }
    return true;
  }

  /* Gemensam CSS */
  var css = document.createElement('style');
  css.textContent =
    '.altg-on{background:var(--tc)!important;color:var(--tf)!important;isolation:isolate}' +
    '.altg-on .n,.altg-on .t,.altg-on .l{color:var(--tf)!important}' +
    '.altg-on > .f{background:rgba(255,255,255,.88)!important;color:#1c1c1c!important}' +
    '.altg-bg,.altg-ov{position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit}' +
    '.altg-bg{background-size:cover;background-repeat:no-repeat}' +
    '.altg-ed{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:310px;background:#fff;color:#1c1c1c;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.28);padding:16px 18px;font:15px/1.35 Georgia,serif;text-align:left}' +
    '.altg-ed .hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px}' +
    '.altg-ed .hd b{font:13px "Archivo Black","Arial Black",sans-serif;letter-spacing:.06em;text-transform:uppercase}' +
    '.altg-ed select{width:100%;font:inherit;font-size:14px;padding:6px 8px;border-radius:8px;border:1px solid #ddd;margin-bottom:10px;background:#fff;color:#1c1c1c}' +
    '.altg-ed button{font:inherit;font-size:14px;border:0;border-radius:8px;padding:7px 10px;cursor:pointer;background:#1c1c1c;color:#fff}' +
    '.altg-ed .seg{display:flex;gap:6px;margin-bottom:10px}.altg-ed .seg button{flex:1;background:#eee;color:#1c1c1c}' +
    '.altg-ed .seg button[aria-pressed="true"]{background:#1c1c1c;color:#fff}.altg-ed .seg button[disabled]{opacity:.35;cursor:default}' +
    '.altg-ed button.ghost{background:#eee;color:#1c1c1c}.altg-ed .x{background:none;color:#1c1c1c;font-size:20px;padding:0 4px;line-height:1}' +
    '.altg-ed label{display:block;margin:6px 0}.altg-ed label i{float:right;font-style:normal;color:#666}' +
    '.altg-ed input[type=range]{width:100%;margin:4px 0 0}' +
    '.altg-ed .tip{font-size:13px;color:#666;margin:6px 0 10px}' +
    '.altg-ed .out{display:grid;grid-template-columns:1fr auto;gap:2px 10px;font-size:13px;background:#f5f2ef;border-radius:8px;padding:8px 10px;margin-bottom:10px}' +
    '.altg-ed .act{display:flex;gap:6px;flex-wrap:wrap}.altg-ed .none{color:#666;font-size:14px;margin:0}' +
    '.altg-ed.min > :not(.hd){display:none}' +
    '[data-altg-where="hero"].altg-drag,.altg-drag [data-altg-where="hero"]{cursor:grab}';
  document.head.appendChild(css);

  /* ---------- Bildfokus-verktyg (#bildfokus) ---------- */
  var ED = /bildfokus/i.test(location.hash) ? { key:'', where:'tab' } : null, panel = null;
  function targets(key, where){
    var p = key.split('|');
    return [].slice.call(document.querySelectorAll('[data-altg-block="' + p[0] + '"][data-altg-ruta="' + p[1] + '"]' + (where ? '[data-altg-where="' + where + '"]' : '')));
  }
  function paint(key){
    var p = key.split('|'), e = entry(p[0], p[1]); if (!e) return;
    ['tab', 'hero'].forEach(function(w){
      var v = pos(p[0], p[1], w);
      targets(key, w).forEach(function(el){ if (el.tagName === 'IMG') el.style.objectPosition = v; else el.style.backgroundPosition = v; });
    });
  }
  function keys(){
    var seen = {}, out = [];
    [].forEach.call(document.querySelectorAll('[data-altg-block]'), function(el){
      var k = el.getAttribute('data-altg-block') + '|' + el.getAttribute('data-altg-ruta');
      if (!seen[k]){ seen[k] = 1; out.push(k); }
    });
    return out;
  }
  function label(k){ var p = k.split('|'), e = entry(p[0], p[1]); return ((e && e.name) || p[1]) + ' · ' + ((e && e.block) || p[0]); }
  function edBuild(){
    if (!ED) return;
    if (!panel){
      panel = document.createElement('div'); panel.className = 'altg-ed';
      panel.innerHTML =
        '<div class="hd"><b>Bildfokus</b><button type="button" class="x" data-e="min" aria-label="Minimera">–</button></div>' +
        '<select data-e="key"></select>' +
        '<p class="none">Ingen ruta med bild på den här sidan än.</p>' +
        '<div class="ctl"><div class="seg"><button type="button" data-w="tab">Liten ruta</button><button type="button" data-w="hero">Stor ruta</button></div>' +
        '<label>Sidled <i data-e="xv"></i><input type="range" name="x" min="0" max="100" step="1"></label>' +
        '<label>Höjdled <i data-e="yv"></i><input type="range" name="y" min="0" max="100" step="1"></label>' +
        '<p class="tip">Dra i den stora rutan för att flytta bilden. Piltangenter flyttar 1 % åt gången.</p>' +
        '<div class="out" data-e="out"></div>' +
        '<div class="act"><button type="button" data-e="copy">Kopiera till arket</button><button type="button" class="ghost" data-e="reset">Återställ</button></div></div>';
      document.body.appendChild(panel);
      panel.addEventListener('click', function(ev){
        var b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.w){ ED.where = b.dataset.w; edSync(); }
        else if (b.dataset.e === 'min'){ panel.classList.toggle('min'); b.textContent = panel.classList.contains('min') ? '+' : '–'; }
        else if (b.dataset.e === 'reset'){ var e = cur(); if (!e) return; if (ED.where === 'hero') e.hero = { x:null, y:null }; else e.tab = { x:null, y:null }; paint(ED.key); edSync(); }
        else if (b.dataset.e === 'copy'){
          var txt = ED.row.join('\t'), lbl = b.textContent;
          var done = function(){ b.textContent = 'Kopierat! Klistra in i kolumn E'; setTimeout(function(){ b.textContent = lbl; }, 2600); };
          if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, function(){ window.prompt('Kopiera:', txt); });
          else window.prompt('Kopiera:', txt);
        }
      });
      panel.addEventListener('change', function(ev){ if (ev.target.dataset.e === 'key'){ ED.key = ev.target.value; edSync(); } });
      panel.addEventListener('mousedown', function(ev){ if (ev.target.dataset && ev.target.dataset.e === 'key') edOptions(); });
      panel.addEventListener('input', function(ev){
        var n = ev.target.name; if (!n) return; var e = cur(); if (!e) return;
        var s = set(e, ED.where), o = ED.where === 'hero' ? (e.hero = { x:s.x, y:s.y }) : (e.tab = e.tab || {});
        o[n] = +ev.target.value; paint(ED.key); edSync();
      });
      var drag = null;
      document.addEventListener('pointerdown', function(ev){
        if (panel.contains(ev.target)) return;
        if (ev.target.closest('a,button,input,select,textarea,label')) return;
        var t = null, r = null;
        [].some.call(document.querySelectorAll('[data-altg-where="hero"]'), function(el){
          var b = el.getBoundingClientRect();
          if (ev.clientX >= b.left && ev.clientX <= b.right && ev.clientY >= b.top && ev.clientY <= b.bottom){ t = el; r = b; return true; }
        });
        if (!t) return;
        var k = t.getAttribute('data-altg-block') + '|' + t.getAttribute('data-altg-ruta'), p = k.split('|'), e = entry(p[0], p[1]); if (!e) return;
        ED.key = k; ED.where = 'hero'; edOptions(); edSync();
        var s = set(e, 'hero');
        drag = { e:e, x0:ev.clientX, y0:ev.clientY, x:s.x, y:s.y, w:r.width, h:r.height }; ev.preventDefault();
      });
      document.addEventListener('pointermove', function(ev){
        if (!drag) return;
        drag.e.hero = { x:Math.round(Math.max(0, Math.min(100, drag.x - (ev.clientX - drag.x0) / drag.w * 100))),
                        y:Math.round(Math.max(0, Math.min(100, drag.y - (ev.clientY - drag.y0) / drag.h * 100))) };
        paint(ED.key); edSync();
      });
      document.addEventListener('pointerup', function(){ drag = null; });
      setInterval(function(){ if (!panel.contains(document.activeElement)) edOptions(); }, 1500);
    }
    edOptions(); edSync();
  }
  function cur(){ if (!ED.key) return null; var p = ED.key.split('|'); return entry(p[0], p[1]); }
  function edOptions(){
    var ks = keys(), sel = panel.querySelector('[data-e="key"]');
    if (ks.indexOf(ED.key) < 0) ED.key = ks[0] || '';
    var html = ks.map(function(k){ return '<option value="' + k + '"' + (k === ED.key ? ' selected' : '') + '>' + label(k).replace(/</g, '&lt;') + '</option>'; }).join('');
    if (sel.innerHTML !== html) sel.innerHTML = html;
    edSync();
  }
  function edSync(){
    if (!panel) return;
    var e = cur(), has = !!e;
    panel.querySelector('.none').style.display = has ? 'none' : '';
    panel.querySelector('.ctl').style.display = has ? '' : 'none';
    panel.querySelector('[data-e="key"]').style.display = has ? '' : 'none';
    if (!has) return;
    var hasTab = targets(ED.key, 'tab').length, hasHero = targets(ED.key, 'hero').length;
    if (ED.where === 'tab' && !hasTab && hasHero) ED.where = 'hero';
    if (ED.where === 'hero' && !hasHero && hasTab) ED.where = 'tab';
    panel.querySelectorAll('[data-w]').forEach(function(b){
      b.setAttribute('aria-pressed', b.dataset.w === ED.where);
      b.disabled = b.dataset.w === 'tab' ? !hasTab : !hasHero;
    });
    var s = set(e, ED.where), t = set(e, 'tab'), h = set(e, 'hero');
    panel.querySelector('[name="x"]').value = s.x; panel.querySelector('[name="y"]').value = s.y;
    panel.querySelector('[data-e="xv"]').textContent = Math.round(s.x) + ' %';
    panel.querySelector('[data-e="yv"]').textContent = Math.round(s.y) + ' %';
    ED.row = [t.x, t.y, h.x, h.y].map(function(v){ return String(Math.round(v)); });
    panel.querySelector('[data-e="out"]').innerHTML =
      '<span>Sidled ruta</span><b>' + ED.row[0] + '</b><span>Höjdled ruta</span><b>' + ED.row[1] + '</b>' +
      '<span>Sidled stor ruta</span><b>' + ED.row[2] + '</b><span>Höjdled stor ruta</span><b>' + ED.row[3] + '</b>';
  }

  window.ALTGrad = {
    get:function(block, fn){ if (fn) subs.push(fn); start(); if (DATA && fn) setTimeout(fn, 0); if (ED) setTimeout(function(){ if (document.body) edBuild(); }, 300); },
    entry:entry, layers:layers, pos:pos, img:img, norm:norm
  };
})();
