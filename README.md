# Suus Typeface – type zonder lettertype

Een Illustrator-tool die tekst "zet" zonder lettertype: je typt tekst in een
paneel en de tool plaatst per teken een stuk vector-artwork uit een
bibliotheek op het artboard. Elk teken bestaat uit drie lagen over elkaar
(schaduw, vulling, highlight) en heeft meerdere varianten.

Het paneel is een CEP-extensie (HTML/JS) met een ExtendScript-engine. UXP is
voor Illustrator nog niet publiek beschikbaar.

**Status:** fase 0 t/m 3 – typen met de ingebouwde Suus-penseelletters of met
een eigen bibliotheek, testbibliotheek maken, alle instellingen, live
voorbeeld. Fase 4 (een geplaatst blok selecteren en opnieuw bewerken) volgt.

## Inhoud

```
panel/
  CSXS/manifest.xml          CEP-manifest (host ILST, CSXS 9 en hoger)
  .debug                     remote debugging op poort 8088
  index.html                 paneel
  js/main.js                 paneelscript (praat met Illustrator via evalScript)
  host/index.jsx             ExtendScript-engine (draait in Illustrator)
  library/suus-penseel.svg   standaardbibliotheek: de penseelletters van Suus
install-mac.sh               installatie macOS
install-windows.bat          installatie Windows
```

## Installeren

Haal de bestanden op: op GitHub **Code > Download ZIP** en pak de ZIP uit,
of `git clone` de repository.

### macOS

1. Open **Terminal** (Programma's > Hulpprogramma's).
2. Typ `bash ` (met spatie), sleep `install-mac.sh` in het Terminal-venster
   en druk op Enter.
3. Sluit Illustrator helemaal af (Cmd+Q) en start het opnieuw.

### Windows

1. Dubbelklik `install-windows.bat`. Krijg je de melding "Windows heeft uw pc
   beschermd", kies dan **Meer informatie > Toch uitvoeren**.
2. Sluit Illustrator helemaal af en start het opnieuw.

### Wat de installatie doet

- Zet `PlayerDebugMode` aan voor CSXS 9 t/m 13, zodat Illustrator een
  niet-ondertekende extensie laadt (macOS: `defaults write com.adobe.CSXS.<n>`,
  Windows: `HKEY_CURRENT_USER\Software\Adobe\CSXS.<n>`). CSXS 13 staat er
  voor de zekerheid bij voor nieuwere Illustrator-versies; een ongebruikte
  sleutel kan geen kwaad.
- Kopieert de map `panel` naar de CEP-extensiemap als
  `com.nielsberk.suustypeface`:
  - macOS: `~/Library/Application Support/Adobe/CEP/extensions/`
  - Windows: `%APPDATA%\Adobe\CEP\extensions\`

**Na elke update:** nieuwe ZIP downloaden (of `git pull`), het
installatiescript opnieuw draaien en Illustrator herstarten.

## Gebruik

Open het paneel via **Venster > Extensies > Suus Typeface** (in sommige
versies **Extensies (verouderd)**). Maak of open een document.

1. Typ tekst in het tekstvak. Enter = nieuwe regel. Kleine letters worden
   hoofdletters; tekens die niet in de bibliotheek staan worden overgeslagen
   en gemeld.
2. Klik **Plaats**. Het blok verschijnt in het midden van je beeld.
3. De knop heet nu **Bijwerken**: pas tekst of instellingen aan en klik
   opnieuw. Het blok wordt vervangen; de linkerbovenhoek blijft op zijn plek,
   ook als je het blok intussen hebt verschoven.
4. **Nieuw blok** zorgt dat de volgende klik een extra blok plaatst in plaats
   van het huidige bij te werken.
5. **Live voorbeeld** werkt het blok kort na elke wijziging vanzelf bij.

De eerste keer opent Illustrator de bibliotheek als extra tabblad en springt
meteen terug naar jouw document. Laat dat tabblad open; dat is sneller.

### Instellingen

| Instelling | Betekenis |
| --- | --- |
| Grootte | % van de bibliotheekgrootte (100% = kapitaalhoogte van ca. 100 pt bij Suus penseel). Lijndiktes schalen mee. |
| Tracking | ruimte tussen letters, in duizendsten van de kapitaalhoogte |
| Woordafstand | breedte van een spatie, in % van de kapitaalhoogte |
| Regelafstand | afstand tussen basislijnen, in % van de kapitaalhoogte |
| Uitlijning | links, midden of rechts (per regel) |
| Uitvoer | **Per laag**: drie lagen *Type L1* (schaduw, onderaan), *Type L2* (vulling) en *Type L3* (highlight). **Per letter**: één groep per letter met de drie delen, in laag *Type*. |
| Varianten | **Willekeurig** (met seed, nooit twee keer achter elkaar dezelfde variant van een letter), **Om de beurt**, of **Altijd variant 1** |
| Seed | bepaalt de willekeurige keuze; **Nieuwe seed** geeft een andere mix |
| Kleuren | **Eigen kleuren gebruiken** aan: vulling en lijn per laag worden overschreven. Uit: de kleuren uit de bibliotheek blijven staan. |

Elk blok bestaat uit groepen met de naam `TT_<id>_L1`, `TT_<id>_L2`,
`TT_<id>_L3` (per laag) of `TT_<id>` (per letter). In de notitie van die
groepen (venster Kenmerken) staan tekst, instellingen, seed en id. Fase 4
gebruikt dat om een blok later weer in te laden.

## De Suus-penseelletters

`panel/library/suus-penseel.svg` is automatisch overgetrokken van de drie
foto's van de penseelletters:

- 25 letters, 55 varianten: meestal 2 per letter, **O** heeft er 4 en **S** 5.
- **Y ontbreekt** (die stond niet op de vellen) en wordt overgeslagen.
- Per glyph: *L2* = de overgetrokken letter (rood), *L1* = dezelfde vorm
  4 pt naar rechtsonder (donkerblauw), *L3* = een dunne lijn binnen in de
  streek (crème).
- Rijen die scheef gefotografeerd waren zijn rechtgezet en alle rijen zijn
  op dezelfde kapitaalhoogte gebracht.

Betere kwaliteit krijg je met een vlakke scan (scanner of scan-app) in plaats
van een foto. Teken je de Y en eventueel cijfers en leestekens, dan kan de
bibliotheek opnieuw gemaakt worden. Je kunt het SVG-bestand ook in
Illustrator openen, aanpassen en bewaren als `.ai`, en dat bestand kiezen
onder **Bibliotheek > Kies…**.

## Een eigen bibliotheek

Elk Illustrator-document (`.ai`, `.svg` of `.pdf`) kan een bibliotheek zijn:

- Per variant een groep met de naam `<LETTER>_<nummer>`, bijvoorbeeld `A_1`,
  `A_2`. Het aantal varianten mag per letter verschillen.
- In die groep drie objecten of groepen met de naam `L1` (schaduw),
  `L2` (vulling) en `L3` (highlight).
- Plus een rechthoek zonder vulling en zonder lijn met de naam `_box`: de cel
  van de letter. Links/rechts = de breedte die de letter inneemt, onderkant
  = basislijn, hoogte = kapitaalhoogte.
- Zonder `L1`/`L2`/`L3` wordt de hele groep als vulling gebruikt; zonder
  `_box` wordt de omtrek van de letter de cel.

**Testbibliotheek maken** bouwt zo'n document met A–Z in drie varianten uit
systeemlettertypes en vraagt waar je het wilt bewaren. Daarna is die
bibliotheek gekozen. **Controleer** laat zien welke letters een bibliotheek
heeft. **Standaard** zet de Suus-penseelletters terug.

## Fase 1–3 testen

1. Update en installeer opnieuw (zie *Na elke update*), herstart Illustrator.
2. Maak een nieuw document (**Bestand > Nieuw**) en open het paneel.
3. Typ `SUUS` en klik **Plaats**. Verwacht: de penseelletters in het midden
   van je beeld, met in het Lagen-venster *Type L1*, *Type L2* en *Type L3*,
   en de status *OK: 4 tekens geplaatst in blok …*.
4. Zet **Grootte** op 200 en klik **Bijwerken**: groter, linkerbovenhoek op
   dezelfde plek, het oude blok is weg.
5. Typ `SUUS`, Enter, `HALLO`, kies **Midden** en **Bijwerken**: twee regels,
   gecentreerd.
6. Kies **Per letter** en **Bijwerken**: nu één groep met per letter een
   groep in laag *Type*.
7. Klik een paar keer **Nieuwe seed** en **Bijwerken**: andere varianten van
   de S en de U.
8. Open **Kleuren**, zet **Eigen kleuren gebruiken** aan, kies kleuren en
   **Bijwerken**.
9. Zet **Live voorbeeld** aan en typ: het blok werkt zich na een halve
   seconde bij.
10. Open **Bibliotheek**, klik **Controleer**: *25 tekens, 55 varianten.
    Ontbreekt: Y*.
11. Klik **Testbibliotheek maken**, bewaar het bestand, maak een nieuw
    document en klik **Plaats**: nu letters uit systeemlettertypes, met per
    variant een eigen kleur.

Stuur me bij een fout de statusregel. Zet onder **Hulp bij problemen** ook
**Debug-informatie tonen** aan: de status bevat dan extra regels (richting,
schaal, oorsprong, tijd) en eronder staat een log.

## Als het niet werkt

**Het paneel staat niet in het menu**

- Controleer of de map bestaat:
  - macOS: Finder > **Ga > Ga naar map…** >
    `~/Library/Application Support/Adobe/CEP/extensions/com.nielsberk.suustypeface`
  - Windows: plak `%APPDATA%\Adobe\CEP\extensions\com.nielsberk.suustypeface`
    in de adresbalk van Verkenner.
- Controleer de debug-vlag (verwacht: `1`):
  - macOS: `defaults read com.adobe.CSXS.12 PlayerDebugMode`
  - Windows: `reg query HKCU\Software\Adobe\CSXS.12 /v PlayerDebugMode`
- Sluit Illustrator echt af (niet alleen het venster) en start opnieuw.
- Zet de CEP-log aan, herstart Illustrator en stuur me de regels over
  `com.nielsberk.suustypeface`:
  - macOS: `defaults write com.adobe.CSXS.12 LogLevel 6`, logs staan in
    `~/Library/Logs/CSXS/`
  - Windows: `reg add HKCU\Software\Adobe\CSXS.12 /v LogLevel /t REG_SZ /d 6 /f`,
    logs staan in `%TEMP%` (bestanden die beginnen met `CEP` of `CSXS`)

**Het paneel opent maar blijft leeg of geeft een fout**

- Open met het paneel open in Chrome `http://localhost:8088` en kijk in de
  Console. Werkt dat niet: ga naar `chrome://inspect`, klik **Configure…**,
  voeg `localhost:8088` toe en klik op het paneel onder *Remote Target*.
- Toont de status *FOUT: host/index.jsx kon niet geladen worden*: zet Debug
  aan en stuur me de log.

**"Geen glyphs gevonden" bij Controleer of Plaats**

De melding noemt de eerste groepsnamen die Illustrator in de bibliotheek ziet.
Stuur me die regel: dan weet ik hoe jouw Illustrator-versie de namen uit het
SVG-bestand overneemt.

## Verwijderen

Verwijder de map `com.nielsberk.suustypeface` uit de CEP-extensiemap. De
debug-vlag mag blijven staan; terugzetten kan met `PlayerDebugMode 0`.

## Ontwikkeling

- `panel/host/index.jsx` is ExtendScript (ES3): geen `let`/`const`, geen
  arrow functions, geen `Array.map`/`forEach`/`filter`/`indexOf`, geen
  `String.trim`, geen `JSON`, geen `Math.imul`.
- Elke publieke `tt_*`-functie geeft een string terug: regel 1 begint met
  `OK` of `FOUT` (de statusregel), regels `@sleutel=waarde` zijn gegevens voor
  het paneel, overige regels zijn details.
- Instellingen gaan als URL-gecodeerde `sleutel=waarde`-string naar
  `tt_render` (geen eval, geen JSON); dezelfde vorm staat in de notitie van
  elk blok.
- Syntaxcontrole: `node --check < panel/host/index.jsx` (via stdin, omdat
  Node de extensie `.jsx` weigert) en `node --check panel/js/main.js`.

## Plan

- **Fase 0** – verbindingstest (getest in Illustrator 30.8.2, CEP 12.1.1)
- **Fase 1** – testbibliotheek uit systeemlettertypes (gebouwd, nog te testen)
- **Fase 2** – render-engine (gebouwd, nog te testen)
- **Fase 3** – paneel-UI met live voorbeeld (gebouwd, nog te testen)
- **Fase 4** – herbewerken: een geplaatst blok selecteren, **Laad selectie**,
  aanpassen en op dezelfde plek opnieuw opbouwen
