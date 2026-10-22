# ATLAS DOMINION

[![Build und Simulationstests](https://github.com/nfekete82/atlas-dominion/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/nfekete82/atlas-dominion/actions/workflows/ci.yml)


**RTS-Verbesserungen vom 22.10.2026:** Die KI berücksichtigt echte lokale Unterstützung, verstärkt zurückgekehrte Formationen gegen Gold, investiert in sichere Industrie und sichert nahe unverteidigte Restgebiete. Truppenanzeigen zählen Feldarmeen und Seetransporte vollständig; Kampfmarker bleiben bei dichtem Kontakt lesbar. Kartenflächen werden zeilenweise gezeichnet und feste Kontaktradien wiederverwendet.

Die RTS-Steuerung bleibt erhalten: **Linksklick auswählen, Rechtsklick bewegen/angreifen, Umschalt-Rechtsklick Kontextmenü.** [Messwerte, Grenzen, Tests und vergleichbare Screenshots](docs/qa/deep-game-20261022/README.md).

**Finales Balancing und Performance-Polish:** Beschossene KI-Armeen nehmen nahe unbewachte Türme gezielt ein. Der identische 50-Länder-Vergleich zeigt 15,2 % weniger Verluste und 1,9 % mehr Gebietsgewinn gegenüber dem vorherigen Entwicklungsstand. Optimierte Konturen halbieren ungefähr die Kartenaufbauzeit bei identischen Pixeln. [Abschlussvergleich über alle vier Schwierigkeitsgrade, Browserprofil und Regression](docs/qa/final-polish-20261022/README.md).

### Lesbare Stadtmarker

Gebaute Städte erscheinen als 30 CSS-Pixel große Canvas-Skyline mit kleinem Levelbadge (1–5), auch bei 100 % Kartenzoom. Level 0 bleibt ohne Zahl. Bronze kennzeichnet 0–2, Silber 3–4 und Gold 5. Kollisionsprüfung schützt andere Städte, Frontzähler, Hauptstadtnamen und Kartenbedienelemente. Eng stehende Städte werden nach Priorität ausgedünnt; Zoomen macht weitere Städte sichtbar. Die Symbole und ihre Rechtsklick-Trefferflächen verwenden dieselben Bildschirmmaße.

```bash
npm test
npm ci --prefix tests/browser
npm run test:browser
```

Die Browsertests starten ihren Testserver auf Port 8096 und verwenden lokal Chrome. Alternativ: `ATLAS_BROWSER_CHANNEL=chromium npm run test:browser` nach `cd tests/browser && npx playwright install chromium`. Ein laufender Container lässt sich mit `ATLAS_BASE_URL=http://127.0.0.1:8095 npm run test:browser` prüfen. [QA-Bericht und Vorher-/Nachher-Bilder](docs/qa/city-markers-20261012/README.md).

**v1.8 – KONTINUIERLICHER FRONTAUFPRALL STATT SEKTORTREFFERN**

Das tatsächliche OpenFront-Kampfsystem beruht auf persistenten Armeen, einer dynamischen orthogonalen Zielfront, einem **Kampfzeitbudget pro Tick** und Soldatenverlusten, die vom Verhältnis der real kämpfenden Truppen zum gegnerischen Bestand abhängen. ATLAS DOMINION implementiert dieses Prinzip **unabhängig mit eigenen Formeln und Skalierung**, keine fremden Programmteile werden übernommen. OpenFront steht unter der GNU AGPL v3; deshalb wird ausdrücklich nichts hineinkopiert.

### Neuer ATLAS-Kampfkern
- **Alle Ländern, einschließlich der KI**, erstellen wirkliche fortlaufende Angriffsarmeen aus ihren **mobilen echten Einwohnern**. Kein KI-Sofortschlag mehr während der normalen Partie, keine kostenlosen Einheiten. Angriffsarmeen reduzieren die freie Reserve und werden getrennt gehalten.
- **Jeder eroberte Sektor ist ein ganzer Sieg**: Ein Angriff bezahlt einen Teil der Simulationszeit *und* echte Soldatenverluste pro eroberter Kachel. Es gibt bei aktiven Armeen keine alten zufälligen Teilschäden an Sektor-HP mehr.
- **Schnellere breite Angriffsfronten**: Angriffszeit sinkt bei vielen angreifenden Soldaten und mehreren gleichzeitig erreichbaren Grenzseiten; bei starker feindlicher Bevölkerung, hohen Einwohnern pro Sektor und befestigten Hauptstädten steigen Zeit und Angreiferverluste.
- **Verteidigung kostet echte Einwohner**: Verluste an einer Grenze werden zuerst bei stationierten Soldaten, dann in der lebenden mobilen Reserve abgezogen; die Angegriffenen verlieren echte Menschen. Sehr starke Grenzbesatzungen müssen schrittweise geschlagen werden, bevor ihre Stellung fällt. Besatzung darf nicht unsichtbar verschwinden.
- **Neutralexpansion ist preiswert, aber nicht mehr kostenlos**: Auch Märsche über neutrales Land verursachen geringe reale Verluste, wie beim großen RTS-Vorbild. Die viel höheren feindlichen Kampfverluste unterscheiden sich weiterhin deutlich.
- **Gegenangriffe haben echte Wirkung**: Zwei laufende Armeeen, die einander an derselben Landfront begegnen, löschen gegenseitig exakt die tatsächlich vorhandenen Soldaten aus (bis zur kleineren Armee). Beide Seiten verzeichnen die daraus resultierenden realen Verluste.
- **Karten-Animation & kleine blaue/rote Frontzähler** bleiben an echte aufgezeichnete Kampfereignisse und real verbliebene Angriffstruppen gebunden.
- **Weniger Meldungslärm:** kleine neutrale Vorstöße bleiben bei der kompakten Statusanzeige.
- **Keine Wasser-, Besitz- oder Teleport-Abkürzungen**. Angriffe können nur in tatsächlich direkt angrenzende Länderkacheln vorrücken.

Diese Umsetzung ist eine **eigenständige Annäherung an OpenFront-Spielregeln**, keine 1:1-Kopie der vollständigen OpenFront-Engine: ATLAS hat andere Kartendaten, Gebäude, Länder-KI, Einwohnergrößen und keinen originalen Fallout-/Terrain- oder Teampakt-Kampf.

### Grundlage
- [OpenFront v34 Ground Combat](https://openfront.wiki/Combat/)
- [Aktuelle OpenFront Engine AttackExecution](https://github.com/openfrontio/OpenFrontIO/blob/main/packages/engine/src/execution/AttackExecution.ts)
- [Aktuelle OpenFront EngineConfig](https://github.com/openfrontio/OpenFrontIO/blob/main/packages/engine/src/configuration/EngineConfig.ts)

### Tests
`tests/front-combat.test.mjs` überprüft ganztilegen Kampf, echte Verluste, Kaderdichte, Frontgeschwindigkeit, Fortifikationen, Kollisionen entgegengesetzter Armeen, echte KI-Armeen und Determinismus. Außerdem laufen bestehende Klick-, Verteidigungs-, Browser-, Eroberungs- und Wirtschaftstests.

---

**v1.7 – NATÜRLICHER FRONTVORSCHUB, KLEINE GRENZZAHLEN UND WENIGER MELDUNGEN**

Im Vergleich zum veröffentlichten OpenFront-Kampfsystem fällt auf: Angriffe arbeiten dort mit einer laufend aktualisierten Menge **direkt angrenzender Zielkacheln** und werden beim erneuten Klick auf dieselbe Front verstärkt. ATLAS DOMINION übernimmt dieses Prinzip **eigenständig umgesetzt** und behält die bestehenden echten Einwohner-/Kampfverluste.

### Das wurde überarbeitet
- **Kein starrer Klickradius mehr:** Der Klick wählt den realen Startsektor an deiner Landesgrenze. Jeder neu eroberte Sektor erweitert die aktuell relevante Front; auch 25+ Sektoren vom ursprünglichen Klick entfernt wird der Angriff an derselben zusammenhängenden Landfront fortgesetzt, solange Truppen und Marschausdauer reichen. Keine Wasser-/Drittstaat-Teleports.
- **Gegnerland wird zusammenhängend übernommen:** Die Front bewertet tatsächliche orthogonale Kontakte, zuletzt eroberte Sektoren, offenen Widerstand und geglättete zusammenhängende Kanten. Verteidigte Sektoren werden konsequent unter Druck gesetzt. Das Ergebnis bleibt deterministisch.
- **Erneut auf dieselbe Front klicken = echte Verstärkung:** Nur eine laufende Armee je naher Zielregion. Neue mobile Soldaten werden ihr tatsächlich zugeteilt; Marschbudget und überlebende Truppen wachsen korrekt. Entfernte Fronten desselben Landes können separat bleiben. Neutrales Land ist weltweit derselbe Besitzer: große Abstände **werden absichtlich nicht zusammengeführt**.
- **Weniger Spam:** Kleine neutrale Angriffe erscheinen nicht mehr im strategischen Ereignisprotokoll. Erst größere abgeschlossene Neutral-Expeditionen (10+ Sektoren) erzeugen **eine kurze Zusammenfassung**. Spielerinformationen stehen währenddessen kompakt im Angriffsstatus.
- **Kleine Frontzähler wie gewünscht:** Die früheren 112×23-Pixel-Plaketten sind jetzt auf **78×15 Pixel** reduziert. Blau/Rot zeigt die echten Truppen eines kürzlichen Einzelgefechts, direkt neben der gemeinsamen Grenze. Das gesamte **noch gebundene Angriffsheer** erscheint als separate kleine Blau-Zahl an derselben Grenzstelle – nicht als erfundene Summe aller Treffer. Neutralgebiete bekommen kein rotes 0-Heer.
- **Ruhigere Sidebar:** Keine permanenten „Keine direkte Feindschlacht“-Meldungen; kompakte Übersicht über aktive neutrale Expansion, Kriege und echte Gefallene.
- Die dunkle Karte, 50 Länder, KI-Schwierigkeitswahl, Städte, Gelderträge, echte Verteidigung und Gewusel-Effekte bleiben erhalten.

### Vergleich mit OpenFront
Quellen: [OpenFront Combat Wiki](https://openfront.wiki/Combat/) und [OpenFront AttackExecution (Quellcode)](https://github.com/openfrontio/OpenFrontIO/blob/main/src/core/execution/AttackExecution.ts). Wir übernehmen das **Spielprinzip kontinuierlicher gemeinsamer Fronten**, nicht dessen Code oder Assets.

### Tests
`tests/offensive-front.test.mjs` verifiziert dauerhafte zusammenhängende Expansion, Anti-Teleport-Bedingungen, Fokus auf umkämpfte Sektoren, lokale Angriffsverstärkung, saubere Neutralmeldungen und deterministische Simulation. Bestehende Klick-/Front-/Wellen-/Kampfregressionstests bleiben erhalten.

```bash
cd ~/Projects/atlas-dominion
git switch main
git pull --ff-only origin main
npm test && PORT=8095 npm run dev
```

---

**v1.6 – LEBENDIGE FRONTSCHLACHTEN, TRUPPENANIMATIONEN & ORGANISCHER VORMARSCH**

### OpenFront-inspiriertes Spielgefühl mit eigener Implementierung
- **Lebendige Fronten statt isolierter Kachelblitze:** Jeder reale Angriff erzeugt ein rein lesbares `BattleEvent` mit Angreiferland, Verteidigerland, Grenzsektor, tatsächlich eingesetzten Soldaten, realen Verteidigern, realen Toten und Eroberungsstatus. Die Daten beeinflussen nie den Kampf selbst.
- **Blue vs Red:** In Gefechten, an denen der Spieler beteiligt ist, stehen **Blau für die eigenen**, **Rot für feindliche Truppen**, unabhängig davon, wer angreift. Andere KI-Kriege werden dezenter mit neutraler Farbe markiert, um Blau nicht fälschlich als KI zu bezeichnen.
- **Soldaten-Gewusel und Kontaktfunken:** Kleine deterministic animierte Front-Einheiten bewegen sich von beiden Seiten auf die tatsächliche Landgrenze zu; Funkeneffekte nur bei echtem Verteidigerkontakt. Keine Pixel-Massen oder Fake-Armeen.
- **Lesbare reale Truppenzahlen:** Nahe aktiven Spielerfronten kleine blau-rote Zahlenanzeigen. Die Zahl ist der *Höchstwert tatsächlich kämpfender Soldaten in einem einzelnen Gefecht dieser Runde* – nicht die Summe mehrfach eingesetzter gleicher Soldaten. Die gesamte im Angriff gebundene Armee wird weiterhin separat im rechten HUD angezeigt.
- **Front-Clustering:** Gleichzeitige Schlachten zwischen denselben Ländern an benachbarten echten Grenzabschnitten werden gruppiert, nicht als Hunderte einzelner Badges dargestellt. Ein Limit von 34 sichtbaren Gruppen pro Bild und Viewport-Culling halten selbst die 50-Länder-Partie flüssig.
- **Bessere Angriffsfolge:** Aktive Aufträge bevorzugen neu gewonnene zusammenhängende Frontabschnitte, statt zufällig über entfernte Teile desselben Nachbarlandes zu springen. Eroberungen erfolgen ausschließlich über reale angrenzende Landzellen; Seeangriffe benötigen weiterhin explizite Landungen.
- **Organische Übernahme:** Die tatsächlich gekaperten Sektoren wechseln über 265 ms weich ihre Farbe und zeigen kurz einen warmen, abgerundeten Frontsaum, ohne Wasser oder unbeteiligte Länder einzufärben. Die finalen Ländergrenzen bleiben scharf.
- **Barrierefreiheit:** Bei aktivierter Betriebssystem-Einstellung für reduzierte Bewegung wird der Soldatenpartikel-Effekt abgeschaltet. Die Kampfzahlen bleiben lesbar.
- **UI:** Rechts kleine Blau-/Rot-Legende plus tatsächliche Kämpfe und Gefallene in dieser Runde; ansonsten nur die vertraute Karte.

### Qualität
`tests/front-battles.test.mjs` überprüft reale Grenzkontakte, korrekte Player/Enemy-Farblogik, keine Diagonal- oder Zeilensprünge, Gruppierung, keine erfundenen Neutral-Verteidiger, keine doppelt gezählten mehrfach kämpfenden Soldaten, reines Rendering ohne Spielmutation sowie deterministische Gefechte. Die Eroberungswellen-Regressionstests prüfen auch die 265-ms-Zeit und sauberes Auslaufen aller Effekte.

```bash
cd ~/Projects/atlas-dominion
git switch main
git pull --ff-only origin main
npm test && PORT=8095 npm run dev
```

---

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


## Naval Warfare 2.0 und echte Topografie

Erreichbare Inseln und Küsten können per normalem Linksklick angegriffen werden; gültige Landfronten haben Vorrang. Flotten fahren über berechnete Wasserzellen, binden echte Soldaten während der Reise und beginnen den Kampf erst bei Ankunft. Entfernung bestimmt die Reisedauer. Laufende Hin- und Rückfahrten sind einschließlich Route deterministisch gespeichert; ältere Version-1-Spielstände werden migriert. Die KI nutzt dieselben bezahlten Seewege, schützt Heimatreserven und respektiert friedliche Anfangsphase sowie eine zusätzliche Begrenzung gegen Angriffe durch mehr als zwei Nationen.

Dezentes reales Natural-Earth-Relief und 988 Seegeometrien liegen transparent über Besitzflächen und unter Städtenamen, Stadtmarkern und Frontanzeigen. Die Ebene ist rein visuell und gecacht. [Geodaten, Lizenz und Reproduktion](docs/GEODATA.md) · [Implementierung, Tests, Performance und echte Vorher/Nachher-Screenshots](docs/qa/naval-topography-20261012/README.md).
