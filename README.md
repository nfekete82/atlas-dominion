# ATLAS DOMINION

**v0.9 — STÄDTEBAU, EINWOHNER & RUHIGERE EUROPAKARTE**

Browserbasiertes Echtzeit-Strategiespiel mit 50 unabhängigen europäischen Ländern und einer 480 × 260 großen Landmaske aus Natural Earth (Public Domain).

## Neu in v0.9

### Dezentere Karte
- Hauptstadtnamen außerhalb des eigenen Landes erscheinen erst beim näheren Zoom.
- Kleine, halbtransparente Länder- und Armee-Badges mit weniger Überschneidungen.
- Kleine Gebäudesymbole zeigen, wo entwickelt wurde (ab passender Zoomstufe).

### Langsamerer Beginn
- **90 mobile Soldaten, 240 Einwohner, 90 Vorräte** pro Fraktion statt 400 Startsoldaten.
- Der anfängliche Einflussbereich jeder Hauptstadt wurde reduziert.
- Einwohner wachsen pro Tick; Rekrutierung nimmt tatsächlich Zivilbevölkerung weg, statt unendlich aus dem Nichts Soldaten zu schaffen.
- Ohne vorhandene Einwohner sind keine Rekruten verfügbar. Das frühere 9.000er-Limit bleibt abgeschafft.
- Vorräte entstehen durch kontrollierte Gebiete, Hauptstädte und Gebäude; sie finanzieren den Bau.
- Die KI errichtet in größeren Abständen eigenständig Siedlungen, Städte und Kasernen und bezahlt dieselben Baukosten.

### Bauen mit Rechtsklick
**Rechtsklick auf einen eigenen, unbebauten Landsektor** öffnet ein kompaktes Kontextmenü:

| Gebäude | Vorräte | Spielwirkung |
| --- | ---: | --- |
| Siedlung | 35 | Mehr Einwohnerwachstum, etwas mehr Rekrutierung |
| Stadt | 90 | Bestehende Siedlung verbessern; deutlich mehr Einwohnerwachstum |
| Kaserne | 65 | Deutlich mehr Rekruten pro Tick aus der Zivilbevölkerung |
| Festung | 75 | Hohe lokale Garnison, stärkere Abwehr an diesem Sektor |
| Hafen | 70 | Küstengebäude; zusätzlicher Vorratsnachschub |

Die eigene Hauptstadt kann nicht überschrieben werden. Auf fremdem Land, Wasser und bereits bebauten Sektoren ist der Bau gesperrt. Eine Stadt ist nur ein Upgrade einer Siedlung. Baukosten werden sofort von den Vorräten abgezogen. Bei Eroberung eines Sektors geht das dortige Gebäude an den neuen Besitzer über.

## Bedienung

- Vor Spielbeginn ein Land samt Hauptstadt aus der Länderliste auswählen; die anderen 49 Länder werden von KI geführt.
- **Linksklick** auf angrenzendes Feindgebiet oder bis zu 14 verbundene Landsektoren in Grenznähe: eigene Armee startet an der echten Grenzfront.
- **Rechtsklick** auf eigenes Land: Baumenü.
- **SHIFT+Linksklick** auf einen markierten Hafen: Seelandung auf dokumentiertem Seeweg.
- **Maus ziehen** verschiebt die Karte, **Mausrad** zoomt, **Leertaste** pausiert.
- Prozentregler steuert den Truppeneinsatz.

## Start

```bash
cd ~/Projects/atlas-dominion
git switch main
git pull --ff-only origin main
npm test && PORT=8095 npm run dev
```

Anschließend http://localhost:8095 öffnen.

## Technik

`src/engine/economy.ts` enthält Gebäudekosten, Bevölkerung, Rekrutierung und Vorratseinkommen.
`src/engine/game.ts` verwaltet Gebäude pro Landsektor, die Eigentumsrechte, Baustufen und die unveränderten deterministischen Frontkämpfe.
Die Bevölkerungswerte sind eine **vereinfachte Spielsimulation**, keine Abbildung realer Einwohnerzahlen von Ländern.

Kartengeometrie: Natural Earth 110m, Public Domain. Hauptstadtkoordinaten im Modul `src/data/countries.ts`.

## Historie

- v0.8: 50 Länder und Hauptstadt-Startauswahl
- v0.7: Frontkämpfe und tolerante Grenzklicks
- v0.6: Regionale Verteidigung und grenzenloses Wachstum
- v0.5: Strategische KI
- v0.4: Eroberungswellen
