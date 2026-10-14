# Suus Typeface – type zonder lettertype

Een Illustrator-tool die tekst "zet" zonder lettertype: je typt tekst in een
paneel en de tool plaatst per teken een stuk vector-artwork uit een
bibliotheek op het artboard. Elk teken bestaat uit drie lagen over elkaar
(schaduw, vulling, highlight) en heeft meerdere varianten.

Het paneel is een CEP-extensie (HTML/JS) met een ExtendScript-engine. UXP is
voor Illustrator nog niet publiek beschikbaar.

**Status: fase 0 – verbindingstest.** Het paneel heeft nu alleen één knop die
controleert of het paneel met Illustrator kan praten.

## Inhoud

```
panel/
  CSXS/manifest.xml   CEP-manifest (host ILST, CSXS 9 en hoger)
  .debug              remote debugging op poort 8088
  index.html          paneel
  js/main.js          paneelscript (praat met Illustrator via evalScript)
  host/index.jsx      ExtendScript-engine (draait in Illustrator)
install-mac.sh        installatie macOS
install-windows.bat   installatie Windows
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

Draai het script opnieuw na elke update.

## Fase 0 testen

1. Start Illustrator. Een document openen is niet nodig.
2. Kies **Venster > Extensies > Suus Typeface**. (In sommige versies heet het
   menu **Extensies (verouderd)**.)
3. De statusregel toont: *Klaar. Klik op 'Test verbinding'.*
4. Klik **Test verbinding**. Verwacht: *OK: Hallo vanuit Illustrator 30.x.x –
   open documenten: 0, actief: geen*.
5. Open of maak een document en klik nog eens: de documentnaam verschijnt.
6. Vink **Debug-informatie tonen** aan. Onder de statusregel verschijnt een
   log met de CEP-versie, de extensiemap en informatie over de
   ExtendScript-engine. Deze instelling wordt onthouden.

Laat me weten:

- of het paneel in het menu verschijnt en opent;
- de tekst na het klikken op **Test verbinding**;
- de regel onderaan het paneel (*Host: ILST … · CEP …*);
- je besturingssysteem.

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

**CEP werkt helemaal niet in jouw Illustrator-versie**

Dan stappen we over op plan B: een zwevend ScriptUI-palet in één `.jsx`
(via **Bestand > Scripts > Ander script…**) met dezelfde engine.

## Verwijderen

Verwijder de map `com.nielsberk.suustypeface` uit de CEP-extensiemap. De
debug-vlag mag blijven staan; terugzetten kan met `PlayerDebugMode 0`.

## Ontwikkeling

- `panel/host/index.jsx` is ExtendScript (ES3): geen `let`/`const`, geen
  arrow functions, geen `Array.map`/`forEach`/`filter`, geen `JSON`, geen
  `Math.imul`. Elke publieke `tt_*`-functie geeft een string terug die begint
  met `OK` of `FOUT`.
- Syntaxcontrole: `node --check < panel/host/index.jsx` (via stdin, omdat
  Node de extensie `.jsx` weigert) en `node --check panel/js/main.js`.
- Na een wijziging: installatiescript opnieuw draaien, paneel sluiten en
  opnieuw openen. Na een wijziging in `manifest.xml`: Illustrator herstarten.

## Plan

- **Fase 0** – verbindingstest (nu)
- **Fase 1** – testbibliotheek: een `.ai` met A–Z in varianten (`A_1`, `A_2`,
  …), elk met de lagen `L1` (schaduw), `L2` (vulling), `L3` (highlight) en
  een onzichtbare cel `_box`
- **Fase 2** – render-engine: tekst omzetten naar geplaatste glyphs, per laag
  of per letter, met varianten, grootte, tracking, woord- en regelafstand,
  uitlijning en optioneel kleurpalet
- **Fase 3** – paneel-UI met live-voorbeeld
- **Fase 4** – herbewerken: een geplaatst blok selecteren, laden, aanpassen en
  op dezelfde plek opnieuw opbouwen

De eigen penseelletters worden later in dezelfde bibliotheekstructuur gezet
(groep `A_1` met `L1`/`L2`/`L3` en `_box`). Het aantal varianten mag per
letter verschillen.
