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
})();
