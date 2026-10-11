# ATLAS DOMINION

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
