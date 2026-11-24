/* =====================================================================
   ALT – laddare för hemsidans kodblock
   Varje kodblock i Squarespace innehåller bara:
     <div data-alt-block="NAMN"></div>
     <script src="https://akademi-for-ledarskap-och-teologi.github.io/hemsida/loader.js"></script>
   Laddaren hämtar block/NAMN.html från GitHub Pages, lägger in den i
   div:en och kör blockets skript. Ändra koden i block/ – inte i Squarespace.
   ===================================================================== */
(function(){
  var me = document.currentScript;
  var BASE = (me && me.src) ? me.src.replace(/[^\/]*(\?.*)?$/, '') : 'https://akademi-for-ledarskap-och-teologi.github.io/hemsida/';

  function load(el){
    if(el.getAttribute('data-alt-loaded')) return;
    el.setAttribute('data-alt-loaded','1');
    var name = el.getAttribute('data-alt-block');
    fetch(BASE + 'block/' + encodeURIComponent(name) + '.html', {cache:'no-cache'})
      .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function(html){
        el.innerHTML = html;
        /* Skript som läggs in via innerHTML körs inte – skapa om dem i ordning */
        el.querySelectorAll('script').forEach(function(old){
          var s = document.createElement('script');
          for(var i=0;i<old.attributes.length;i++){ s.setAttribute(old.attributes[i].name, old.attributes[i].value); }
          s.text = old.textContent;
          old.parentNode.replaceChild(s, old);
        });
      })
      .catch(function(e){
        el.removeAttribute('data-alt-loaded');
        console.error('[ALT] Kunde inte ladda kodblocket "' + name + '":', e);
      });
  }

  function scan(){ document.querySelectorAll('[data-alt-block]').forEach(load); }
  scan();
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);

  /* ---------- Sökträff: #hitta=text rullar fram till texten och markerar den ----------
     Sökblocket (block/sok.html) länkar till sidan#hitta=rubrik. Kodblocken laddas
     efter sidan, så vi försöker några gånger innan vi ger upp. */
  if(!window.__altHitta){
    window.__altHitta = 1;
    var m = location.hash.match(/^#hitta=(.+)$/);
    if(m){
      var want; try { want = decodeURIComponent(m[1]); } catch(e){ want = ''; }
      var fold = function(s){ var o=''; for(var i=0;i<s.length;i++){ var c=s[i].toLowerCase()[0], d=c.normalize?c.normalize('NFD')[0]:c; o+=/[a-z0-9]/.test(d)?d:' '; } return o.replace(/\s+/g,' ').trim(); };
      var find = function(q){
        var f = fold(q); if(!f) return null;
        var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode:function(n){
          var p = n.parentElement; if(!p || p.closest('script,style,noscript,header,nav,#alt-sok,.altg-ed,[aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT; } });
        var n, best = null;
        while((n = w.nextNode())){
          var el = n.parentElement, t = fold(el.textContent);
          if(t.indexOf(f) >= 0){ if(/^H[1-4]$/.test(el.tagName) || el.closest('h1,h2,h3,h4')) return el.closest('h1,h2,h3,h4') || el; if(!best) best = el; }
        }
        return best;
      };
      var tries = [400, 1000, 2000, 3500, 6000], k = 0;
      var attempt = function(){
        var words = want.split(/\s+/), el = find(want) || (words.length > 3 && find(words.slice(0, 3).join(' ')));
        if(!el){ if(k < tries.length) setTimeout(attempt, tries[k++]); return; }
        var st = document.createElement('style');
        st.textContent = '@keyframes alt-hitta{0%,60%{background:rgba(200,162,74,.45)}100%{background:transparent}}.alt-hitta{animation:alt-hitta 2.6s ease-out;border-radius:6px;scroll-margin-top:120px}';
        document.head.appendChild(st);
        el.classList.add('alt-hitta');
        el.scrollIntoView({ behavior:'smooth', block:'center' });
        try { history.replaceState(null, '', location.pathname + location.search); } catch(e){}
      };
      if(document.readyState === 'complete') setTimeout(attempt, tries[k++]); else window.addEventListener('load', function(){ setTimeout(attempt, tries[k++]); });
    }
  }
})();
