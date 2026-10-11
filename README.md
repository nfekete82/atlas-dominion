# ATLAS DOMINION

**v1.2.1 – BALANCIERTES GELD & KOMPAKTE ZAHLEN**

## Wirtschaft und Anzeige repariert

- Die direkte Multiplikation `Anzahl Städte × Einwohnerzahl` wurde aus dem Wachstumsmodell entfernt. Solche multiplikativen Effekte verursachten binnen Minuten astronomische Einwohnerzahlen, Kassenstände und Tick-Einnahmen.
- Bevölkerung wächst weiterhin mit den vorhandenen Einwohnern, dem kontrollierten Land, Hauptstädten und gebauten Städten. Zusätzliche Städte bringen aber **abnehmende Wachstumsvorteile** (Quadratwurzel statt Exponentialeffekt).
- Steuereinnahmen sind nun deutlich niedriger, steigen aber weiter nachvollziehbar mit der Bevölkerung; Städte und Territorium bieten kleine Zusatzboni.
- **Einheitliche Kurzschreibweise** in allen Zahlenanzeigen: `1,5K` (Tausend), `2,5M` (Millionen), `3,2 Mrd.` (Milliarden), `1,2 Bio.` (Billionen). Einwohner, Truppen, Geld, Tick-Wachstum, Angriffe, Verteidigung und Länderliste nutzen dieselbe Formatierung.
- Extremen Zahlen wird notfalls eine kurze wissenschaftliche Darstellung gegeben. Zweispaltige Statistikfelder brechen Zahlen nicht mehr über viele Zeilen um.
- Langzeittests prüfen, dass zahlreiche Städte über Tausende Simulationsschritte **kein exponentielles Wachstum** auslösen und neue Partien numerisch stabil bleiben.

**Nach dem Update eine neue Partie beginnen.** Bereits durch die alte Formel im Browser entstandene Fantasiezahlen werden durch die Korrektur nicht rückwirkend reduziert.

---

**v1.2 – ECHTE KAMPFVERLUSTE, SCHLAUERE KI & ORGANISCHE FRONTEN**

## Neu in v1.2

- **Einwohner bleiben bei einer Mobilisierung Einwohner.** Die für einen Angriff eingesetzten Einheiten werden nur zwischen Reserve und aktiver Offensive verschoben. Erst gefallene Soldaten verringern tatsächlich den Gesamtbestand.
- **Neutraler Boden kostet Marschaufwand, aber keine Menschenleben.** Jede Offensive besitzt ein begrenztes Erschöpfungsbudget (`effort`), das auch bei friedlicher Expansion verbraucht wird. Dadurch entstehen keine unendlichen kostenlosen Landnahmen.
- **Verteidigter Boden kostet beide Seiten Soldaten.** Lokale stationierte Verteidiger und Notfallreserve können sterben, die Angreifer verlieren abhängig von der Gegenwehr und beim Sturm auf Hauptstädte besonders viele Einheiten.
- **Überlebende kehren zurück**, wenn eine Offensive an Erschöpfung oder einer nicht mehr erreichbaren Front endet. Gefallene bleiben verloren. Im HUD werden eigene Gefallene und zugefügte Gegnerverluste sowie Verluste der laufenden Offensive angezeigt.
- **KI-Stile und Frontscoring:** Expansion, aggressive Eroberung, defensive Vorsicht und opportunistische Schwächeausnutzung; Städte und Hauptstädte werden strategisch berücksichtigt. KI-Ziele bleiben deterministisch.
- **Fließender, leicht abbrennender Eroberungseffekt** entlang wirklich eroberter Zellen: organische, begrenzte Verlaufskanten und eine sanft glühende, abgerundete aktuelle Kampfgrenze. Keine ausgedehnten Dauer-Kreise, kein Teleportieren, kein Eingriff in die Sektorsimulation.
- Einwohnerwachstum, Steuer-Geld, die ausschließlich baubaren Städte und Länder-Klicksteuerung aus v1.1 bleiben erhalten.

## Testen

```bash
cd ~/Projects/atlas-dominion
git switch main
git pull --ff-only origin main
npm test && PORT=8095 npm run dev
```

Neue Tests: `tests/casualties.test.mjs`, `tests/ai-strategy.test.mjs`, `tests/capture-visual.test.mjs`. Existing tests zu neutralen Offensiven berücksichtigen das neue Marschbudget anstelle pauschaler Todesfälle.

---

**v1.1 – Einwohner = Truppen, Städte und Geld**

Eigenständiges browserbasiertes Eroberungsspiel mit 50 europäischen Startländern, deterministischen Grenzkämpfen und Städtebau per Rechtsklick.

## Einfaches Spielprinzip

- **Einwohner sind gleichzeitig Truppen.** Es gibt nur einen gemeinsamen Bestand. Stationierte Grenztruppen und laufende Angriffsverbände zählen weiterhin dazu; sie werden nicht doppelt gezählt. Verluste im Kampf reduzieren den Bestand.
- **Automatisches Wachstum:** Einwohner/Truppen wachsen pro Tick. Die Basisrate orientiert sich auch an Gebiet und aktuellen Einwohnern.
- **Städte bauen:** Rechtsklick auf einen eigenen, unbebauten Sektor und **Stadt bauen (75 €)**. Jede Stadt erhöht dauerhaft die Wachstumsrate. Hauptstädte sind bereits Städte und können nicht überbaut werden.
- **Geld statt Vorräte:** Steuereinnahmen sind proportional zur Einwohner-/Truppenzahl. Landbesitz, Hauptstädte und gebaute Städte steuern kleinere Zusatzbeträge bei. Größere Länder mit mehr Einwohnern verdienen dadurch automatisch schneller mehr Geld.
- **Schneller angreifen mit größerem Heer:** Über den Prozentregler werden Einwohner/Truppen an der Grenze in den Kampf geschickt. Je mehr Soldaten der Angriff tatsächlich enthält, desto mehr Grenzsektoren kann die Offensive pro Tick bearbeiten. Bestehende lokale Verteidiger verbrauchen weiterhin Angriffskraft. Kein Fernkampf oder Teleport.
- **KI baut Städte:** Alle 100 Ticks sucht jeder KI-Gegner bei ausreichendem Geld ein freies Feld für eine Stadt und bezahlt die gleichen Baukosten.
- **Weniger Anzeigen:** Im HUD gibt es Gebiete, gemeinsame Einwohner/Truppen, Wachstum, Kontrolle, Städtezahl und Geld. Es existieren keine separaten Soldaten- oder Zivilisten-Reserven mehr.

## Steuerung

| Aktion | Steuerung |
|---|---|
| Land wählen | Vor Spielbeginn aus 50 Ländern auswählen |
| Land angreifen | Linksklick irgendwo in einen tatsächlich verbundenen gegnerischen Landteil |
| Mehr Truppen senden | Prozentregler erhöhen – größerer Angriff kann schneller erobern |
| Stadt bauen | Rechtsklick auf eigenen freien Sektor |
| Seelandung | Shift + Linksklick auf eine markierte Seeanlegestelle |
| Karte | Ziehen / Mausrad zoomen |
| Pause | Leertaste |

Die 480×260 große Landkarte, der kontrastreiche dunkle Stil und die kleinen sichtbaren Stadtsymbole bleiben erhalten.

## Lokal starten

```bash
cd ~/Projects/atlas-dominion
git switch main
git pull --ff-only origin main
npm test && PORT=8095 npm run dev
```

Anschließend http://localhost:8095 öffnen.

## Technische Regeln

- `src/engine/economy.ts` enthält die deterministischen, monoton mit Bevölkerung wachsenden Formeln `troopGrowth` und `taxRevenue`.
- `src/engine/game.ts` nutzt ein einziges Einwohnervolk (`Faction.troops` + wirklich stationierte/eingesetzte Kräfte). Geld wird als `Faction.money` verwaltet.
- `src/engine/frontline.ts` begrenzt die maximale Angriffsbreite, lässt größere Kontingente aber deutlich schneller vorrücken als kleine.
- Geld, Truppen und gebaute Städte sind Spielwerte, **keine realen Bevölkerungs- oder Finanzstatistiken**.

Kartengrundlage: Natural Earth 110m (Public Domain). Alle Renderings und Spielelemente sind eigenständig, ohne kopierte OpenFront-Assets.
