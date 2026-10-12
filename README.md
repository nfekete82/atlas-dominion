# ATLAS DOMINION

[![Build und Simulationstests](https://github.com/nfekete82/atlas-dominion/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/nfekete82/atlas-dominion/actions/workflows/ci.yml)


**v1.5 – WÄHLBARER KI-SCHWIERIGKEITSGRAD VOR DEM SPIEL**

OpenFront bietet im Einzelspieler-Setup vier Schwierigkeitsstufen. ATLAS DOMINION übernimmt das Prinzip mit eigenem Balancing. **Wähle im Startfenster zuerst eine KI-Stufe und dann dein Land.** Bei »Neues Spiel« kannst du erneut wählen.

| KI-Stufe | KI-Starttruppen | KI-Wachstum | KI-Aktivität | KI-Verteidigung | Stadtbau |
|---|---:|---:|---:|---:|---|
| Entspannt | 65 | 0,85× | 0,65× | 0,75× | alle 180 Ticks |
| Ausgeglichen (Standard) | 90 | 1× | 1× | 1× | alle 100 Ticks |
| Intensiv | 120 | 1,14× | 1,2× | 1,2× | alle 75 Ticks |
| Unmöglich | 165 | 1,28× | 1,4× | 1,4× | alle 55 Ticks |

**Nur die KI-Länder werden verändert.** Der menschliche Spieler hat immer 90 Starttruppen, 90 Startgeld, identische Wirtschaftsformeln und dieselben echten Kampfschäden. Es entstehen keine versteckten Gratisarmeen im Kampf. Die Schwierigkeitsgrade verändern die KI-Startwerte, das reale Wachstum, Marsch- und Angriffsausdauer, die Zahl möglicher Frontaktionen, Risikobereitschaft sowie echte Grenzverstärkungen. »Ausgeglichen« entspricht dem bisherigen v1.4.1-Verhalten.

Die Auswahl ist pro Partie fixiert und erscheint in der Seitenleiste. Bei jedem neuen Spiel kannst du sie ändern. Das System bleibt deterministisch: gleiche Karte, Seed, Schwierigkeit und Befehle führen zu gleichen Ergebnissen.

Neue `tests/difficulty.test.mjs` prüfen alle vier Stufen, identische Spielereinstellungen, voneinander verschiedene KI-Stärken, reale Truppenhaltung und deterministische Simulation. `tests/http.test.mjs` prüft Startbildschirm und Bereitstellung des Difficulty-Moduls.

---

**v1.4.1 – VERTEIDIGUNGSVERLUSTE UND GEGENANGRIFFE**

- **Bei einer feindlichen Eroberung sterben wieder echte Verteidiger:** Auch Sektoren ohne vorher stationierte Grenzgarnison können aus der *tatsächlichen mobilen Bevölkerung* ein begrenztes Aufgebot zur Verteidigung erhalten. Die eingesetzten Milizionäre werden bei einem Gefecht als echte Verluste verbucht – keine künstlich erschaffenen Soldaten. Der nationale Einwohner-/Truppenwert fällt entsprechend, sofern das Wachstum die Verluste nicht ausgleicht.
- **Letzte defensive Verluste** werden im Bevölkerungsblock ausdrücklich angezeigt (»Verteidigung: −X diese Runde«). Langfristige Gefallene werden weiterhin kumuliert angezeigt.
- **Linksklick auf eine eigene bedrohte Grenze** löst einen **Gegenangriff** auf den nächsten direkt angrenzenden feindlichen Landsektor aus. Auch ein Klick bis zu 12 zusammenhängende eigene Sektoren hinter der Front wird erkannt. Keine Teleports über Wasser oder durch andere Länder.
- **Rechtsklick auf einen eigenen bedrohten Grenzsektor** zeigt neben »Stadt bauen« die Option **»Grenze verstärken«**. Sie stationiert den im Prozentregler eingestellten Anteil der **wirklich vorhandenen mobilen Soldaten** direkt an diesem Grenzposten, ohne Einwohner zu erzeugen oder zu töten.
- Auf einer nicht bedrohten eigenen Fläche wird kein Angriff gestartet; normale Feind- und Neutralgebietsklicks sowie Seeangriffe bleiben erhalten.
- Fünf neue Szenarioprüfungen in `tests/counterattack-defense.test.mjs` überprüfen reale Defensivverluste, Rückangriffe, Kartenbegrenzungen, echte Truppenübertragung und Determinismus.

**Steuerung:** Linksklick auf ein Feindgebiet **oder** dein eigenes bedrohtes Grenzgebiet = Angriff/Gegenangriff. Rechtsklick auf eigene bedrohte Grenze = gezielt Soldaten zur Verteidigung stationieren.

---

**v1.4 – AGGRESSIVERE KI, SCHNELLERE EROBERUNG UND BESSERE GRENZVERTEIDIGUNG**

**Automatischer Qualitätscheck:** Bei jedem Pull Request und jeder Änderung an `main` baut GitHub Actions das Projekt mit Node.js 22 und führt alle Simulations- und Regressionstests aus. Der Status steht im Abzeichen oben. Nach dem Wechsel des Repositories zu `public` wurde der vorherige fehlgeschlagene Lauf erfolgreich erneut ausgeführt: **93 Tests bestanden, 0 fehlgeschlagen** (12. Oktober 2026).

## Was in v1.4 anders ist

- **Deutlich höhere KI-Aktivität:** 6–20 mögliche echte Angriffe je Simulations-Tick (je nach Reichsgröße und Persönlichkeit) statt anfänglich 2. Das ist ein *Maximum*; verfügbare echte Soldaten, Feindstärke und Marschausdauer begrenzen alle Angriffe.
- **Stärkere KI-Angriffe:** Der einzelne Frontschlag setzt auf neutralem Land bis zu 17, gegen gegnerische Gebiete abhängig vom KI-Stil bis zu 29–34 vorhandene Soldaten ein. Die KI nimmt so feindliche Sektoren entschlossener ins Visier.
- **Erhöhte Marschausdauer:** KI startet mit 110 statt 32 Ausdauerpunkten, regeneriert wesentlich schneller (mindestens 12 je Tick; begrenzt nach realem Einwohnerwachstum) und kann bis zu 300 ansparen. Ausdauer ist **keine zusätzliche Bevölkerung**.
- **Mutigere Entscheidungen, aber weiterhin taktisch:** Die vier Persönlichkeiten bekommen jeweils eine eigene **begrenzte Risikotoleranz**. Die KI greift eher einen leicht stärkeren Nachbarn an, meidet jedoch aussichtslose Großmächte. Die tatsächlichen Angriffsverluste, Einwohner und Grenzregeln bleiben unverändert.
- **Fokussierte Offensiven:** Der letzte echte Frontkontakt erhält einen begrenzten taktischen Fokusbonus. Bots versuchen, einen Durchbruch fortzusetzen, statt ständig das Ziel zu wechseln. Kein Überspringen fremder Gebiete oder Wasser.
- **Grenzverteidigung schneller:** Gefährdete Grenzen können pro Tick mehr eigene mobile Truppen erhalten; eine feste Mindestreserve verhindert, dass jeder Soldat dauerhaft stationiert wird. Das Militärbudget überträgt echte Truppen und erschafft keine neuen.
- **Spieler-Regeln unverändert:** Du wählst weiterhin Einsatz-Prozent, Zielgebiete und Militärdoktrin. Die KI bekommt keinen versteckten Schadensbonus und ignoriert keine lokalen Verluste.
- Die Karte, der Städtebau, Geldwirtschaft, die KI-Persönlichkeiten und die v1.3.1-Kampfverluste bleiben erhalten.

## Neue Tests
`tests/ai-tactics.test.mjs` testet begrenzte KI-Ausdauer, maximale Angriffe, Truppeneinsatz, real bezahlte Grenzstationierung, Zielrisko und deterministische Multiplayer-Simulation. Bestehende Tests prüfen weiterhin Wirtschafts- und Kampfverluste.

```bash
cd ~/Projects/atlas-dominion
git switch main
git pull --ff-only origin main
npm test && PORT=8095 npm run dev
```

---

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
