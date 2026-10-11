# ATLAS DOMINION

**v1.3 – RELATIVE REICHSMACHT BEIM ANGREIFEN**

Ein großes, gut entwickeltes Land lässt sich schwerer erobern als ein kleiner, schwacher Nachbar. Dabei bleibt die *örtliche Grenzverteidigung* entscheidend und kein Land wird automatisch uneinnehmbar.

## Relative militärische Stärke

- Für jedes Land ermittelt die Simulation aus **allen Einwohnern/Truppen** (freie Reserve, Grenzbesatzung, aktuell eingesetzte Armeen), kontrolliertem Territorium und Städten einen gemeinsamen Machtwert. Er wird einmal pro Simulationstick berechnet, um die großen Karten performant zu halten.
- Beim Angriff auf ein anderes Land wird deine Macht mit der des Gegners verglichen. Die Angriffswirkung verändert sich graduell: **70–130 % des normalen Schadens**. Ein großer Gegner kann also bis zu 30 % deiner Angriffswirkung abschwächen. Ein schwacher Gegner lässt sich bis zu 30 % effizienter bekämpfen.
- Ein stärkerer Gegner erhöht außerdem die **eigenen Kampfverluste**. Die Aufschläge sind begrenzt, damit auch kleine Staaten gewinnen können. Neutraler Boden bleibt von dieser Machtwertung ausgenommen und verursacht weiterhin keine Kampftoten.
- Hauptstädte, lokal stationierte Truppen, echte Angriffsstärke, Verteidigungsdoktrin und Frontpositionen bleiben separat wirksam. **Starke Länder sind nicht unangreifbar.**
- Die KI verwendet denselben Machtfaktor zur Einschätzung riskanter Offensiven und priorisiert weiterhin schwache Grenzabschnitte.
- Im Hover-Tooltip des gegnerischen Gebiets wird der Faktor transparent gezeigt, etwa **„ANGRIFFSWIRKUNG: 82 % · STARKER GEGNER“** oder **„120 % · MACHTVORTEIL“**. Diese Prozentzahl ist der rechnerische Schadensfaktor, keine Siegwahrscheinlichkeit.
- Das bestehende Geld-/Städte-System, die dunkle Europa-Karte, der organische Eroberungseffekt und die echte Verlustrechnung bleiben erhalten.

## Tests

Neue Regressionstests in `tests/warfare.test.mjs` überprüfen: Stärke durch Einwohner/Gebiet/Städte, monotone Wirkung, Wirkungsgrenzen (70–130 %), höhere Angreiferverluste gegen mächtige Staaten, KI-Risikobewertung und tatsächliche geringere Beschädigung derselben lokalen Verteidigung.

## Start

```bash
cd ~/Projects/atlas-dominion
git switch main
git pull --ff-only origin main
npm test && PORT=8095 npm run dev
```

Danach http://localhost:8095 öffnen. Der vollständige TypeScript-Build und Browser-Test müssen mit `npm test` auf dem Mac bestätigt werden.

## Historie

- v1.2.2 – Reparierte Tests für neutrale Offensiven und gedämpftes Wachstum
- v1.2.1 – Balancierte Wirtschaft und kompakte K/M/Mrd.-Anzeige
- v1.2 – Echte Gefallene, intelligentere KI und organische Eroberungsfronten
- v1.1 – Einwohner = Truppen; Städte und Geld
- v1.0 – Länderbasiertes Klicken und kontrastreiche Karte

Kartengrundlage: Natural Earth 110m (Public Domain). Das Projekt ist unabhängig von OpenFront.
