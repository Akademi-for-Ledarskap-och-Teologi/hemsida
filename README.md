# ALT – kodblock för altutbildning.se

All egen kod på [altutbildning.se](https://www.altutbildning.se) ligger här. Squarespace-sidorna innehåller bara en kort
snutt som hämtar koden härifrån. **Ändra alltid koden här – inte i Squarespace.**

## Så fungerar det

Varje kodblock i Squarespace innehåller bara två rader:

```html
<div data-alt-block="personalregister"></div>
<script src="https://akademi-for-ledarskap-och-teologi.github.io/hemsida/loader.js"></script>
```

`loader.js` hämtar `block/personalregister.html` från GitHub Pages, lägger in den på sidan och kör koden.
En ändring som sparas (committas) här syns på hemsidan efter 1–2 minuter.

## Kodblocken

| Fil i `block/` | Sida | Vad det är |
|---|---|---|
| `sidfot` | alla sidor (sidfot) | Sidfoten (ligger i sidfoten på alla sidor) |
| `startsida` | / (startsidan) | Startsidan, allt under videon |
| `dagens-ord` | / (startsidan) | Dagens ord (grekiska) på startsidan |
| `kontakt` | /kontakt | Översta delen av /kontakt |
| `personalregister` | /kontakt | Personalregistret på /kontakt |
| `pastorsprogram` | /pastorsprogram | Klickbar årsplan på /pastorsprogram |
| `kursplaner` | /kursplaner | Kursplaner på /kursplaner |
| `teologiaret` | /teologiaret | Klickbar studieplan på /teologiaret |
| `teologiprogram` | /teologiprogram | Klickbar årsplan på Teologiprogrammets sida |
| `diakoniterminen` | /diakoniterminen | Klickbar studiegång på /diakoniterminen |
| `missionsterminen` | /missionsterminen | Klickbar studiegång på /missionsterminen |
| `bibellasningskalkylator` | /vanliga-fragor | Bibelläsningskalkylatorn på /vanliga-fragor |
| `ips-publikationer` | /ips-publikationer | Publikationslistan på /ips-publikationer |
| `uppsatser` | /uppsatser | Uppsatsarkivet på /uppsatser |
| `kurskatalog` | /kurskatalog (opublicerad) | Kurskatalogen med studieplan |
| `ansokan` | /testansokan (opublicerad) | Ny ansökningsguide, ska ersätta /ansokan |

## Ändra något

1. Öppna filen i `block/` här på GitHub och klicka på pennan (Edit).
2. Gör ändringen och klicka **Commit changes**.
3. Vänta 1–2 minuter och ladda om sidan på altutbildning.se.

Gick något fel? Öppna filens **History**, välj den tidigare versionen och återställ den.

## Lägga till ett nytt kodblock

1. Lägg en ny fil i `block/`, t.ex. `block/nyhetsbrev.html`, med HTML, `<style>` och `<script>` som vanligt.
2. Lägg ett kodblock i Squarespace med:
   ```html
   <div data-alt-block="nyhetsbrev"></div>
   <script src="https://akademi-for-ledarskap-och-teologi.github.io/hemsida/loader.js"></script>
   ```

## Data som blocken hämtar

Flera block hämtar innehåll från Google Drive (t.ex. personalregistret från kalkylarket *ALT Personalregister*
och bilder från mappen *Personalbilder - Hemsida*). Innehållet ändras där – inte här.
Google-API-nyckeln som används är bara för läsning av offentligt delade filer. Lås den till
`altutbildning.se/*` under *API-nycklar → Begränsningar för webbplatser* i Google Cloud Console.

## Gradientbilder (bilder i rutorna)

Bilderna i rutorna (med färgtoning) styrs från Google Drive – inte här i koden:

- **Mapp:** ALT / *Gradientbilder* – ladda upp bilderna hit.
- **Kalkylark:** *Gradientbilder – koppling till block* (i samma mapp), flik *Koppling*.
  En rad per ruta: Block, Ruta, Bild (filnamn i mappen eller en bildlänk), Gradientfärg (valfri),
  Sidled/Höjdled ruta (%), Sidled/Höjdled stor ruta (%) och Zoom ruta/stor ruta (%, 100–300).
  Tom bildcell = vanlig färgruta.
- **Finjustera** vilken del av bilden som syns: lägg till `#bildfokus` i adressen
  (t.ex. `altutbildning.se/teologiaret#bildfokus`), ställ in och klicka *Kopiera till arket*,
  klistra in i kolumn E på rätt rad.

Koden ligger i `gradientbilder.js` och används av teologiaret, pastorsprogram, teologiprogram,
diakoniterminen, missionsterminen, ansokan, kurskatalog och bibellasningskalkylator.

## Överlämning

Repot ligger i organisationen **Akademi-for-Ledarskap-och-Teologi** på GitHub. Lägg till den som tar över som *Owner*
under organisationens *People*, så har den full åtkomst.
