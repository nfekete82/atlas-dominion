# ATLAS DOMINION

**v1.3.1 – SICHTBARE KAMPFVERLUSTE UND KLARE EINWOHNERANZEIGE**

## Warum die Einwohner scheinbar nie sanken
- Das Spiel behandelt Angriffsbefehle als **Mobilisierung**, nicht als sofortigen Tod. Vor dem ersten Gefecht bleiben eingesetzte Soldaten Teil der Gesamtbevölkerung.
- **Neutrale Eroberung** verursacht keine Kampfverluste.
- Bei gegnerischen Sektoren war die bisherige Basis-Verlustrate sehr niedrig. Das fortlaufende Einwohnerwachstum konnte die Verluste deshalb stärker überdecken als beabsichtigt.

## Neue Regeln und Anzeige
- Bei echter feindlicher Gegenwehr verlieren Angreifer nun wesentlich mehr Soldaten. Der Angriff kostet im normalen Gefecht **häufig etwa 1,8 Soldaten pro tatsächlich gefallenem Verteidiger**; die genaue Zahl ist von der lokalen Verteidigung und der relativen Reichsmacht abhängig.
- Auch ein nur schwach verteidigtes **Feindgebiet** verursacht nun spürbare, aber begrenzte Angriffskosten. Höchstens **85 % der gerade eingesetzten Soldaten pro Gefecht** können dort fallen.
- Ein bei der Sektoreroberung vollständig besiegter Grenzposten zählt für die Verlustquote dieses Gefechts; zuvor waren diese letzten Verteidiger im Angreifer-Verlustvergleich nicht berücksichtigt.
- **Neutrale Sektoren bleiben kampfverlustfrei.** Ihre Eroberung verbraucht weiterhin das begrenzte Marschbudget.
- Im Feld **EINWOHNER / TRUPPEN** stehen jetzt *Gesamt, Mobil, An der Grenze, Im Angriff und Gefallen*. Die Gesamtbevölkerung sinkt nur durch Gefallene und steigt gleichzeitig durch normales Wachstum; die kumulierten Gefallenen bleiben stets sichtbar.
- Die Kampfrechnung für Spieler und KI ist identisch und bleibt deterministisch.

Zwei neue Regressionstests überprüfen die Mindestverluste im Feindgebiet, den Vorteil der Verteidigung und den Rückgang der tatsächlichen Bevölkerung in einer laufenden feindlichen Offensive.

---

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
