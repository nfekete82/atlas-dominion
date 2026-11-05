# Sandforge: Bastion Wars — WebGL-3D-Konsolidierung und Release-Abnahme

Stand: 05.11.2026. Zielbranch: `fix/webgl-classic-input-parity-20261104` (PR #227, Entwurf). Startpunkt bei Erstellung: `5c2716c8bdffb86dd617a1931109edfac81d3ddf`.

## Entscheidung

**Eine aktive Spielversion: WebGL/Three.js.** Gelände, 3D-Kamera, Einheiten,
Gebäude, Bauvorschau, Fog of War, Geschütze, Effekte und Auswahlfeedback
werden durch den WebGL-Renderer dargestellt. DOM/CSS bleibt für HUD, Menüs,
Barrierefreiheit und Einstellungen; ein 2D-Canvas für Minimap und einmalig
erzeugte Texturen ist sinnvoll und **kein zweiter Spielrenderer**.

Das alte Canvas-Spiel darf erst nach einer erfolgreichen Paritäts- und
Spielstandabnahme aus dem Standard-Einstieg entfernt werden. Es bleibt bis
dahin als `/classic.html` oder versioniertes Archiv ansprechbar.

## Tatsächlicher Ist-Zustand

- Standard-Einstieg `/` / `index.html`: ältere Canvas-Spieloberfläche,
  Einstieg über `src/reborn/main.ts` und `src/reborn/renderer.ts`.
- WebGL-Spiel: `/webgl-preview.html`; Szene in
  `scripts/webgl-preview.js`, Spielobjekte in
  `scripts/webgl-battlefield.js`, Eingaben/HUD per WebGL-spezifischem Code.
- Beide Varianten nutzen die gemeinsame `src/reborn/simulation.ts`.
  Zwei getrennte Eingabe- und Präsentationspfade existieren noch.
- `scripts/build.mjs` liefert **beide** Einstiege aus.
- PR #184 (`8630b44`) untersuchte überwiegend das Canvas-Hauptspiel,
  optimierte dessen gemeinsame Zielsuche und dokumentierte **18 dort schon
  vorher vorhandene** fehlgeschlagene Node-Tests. Das ist **kein** Nachweis,
  dass die neuere WebGL-Version dieselben Fehler hat.
- PR #227 hat den jüngeren 3D-Spielstand. Letzte bestätigte Gesamtprüfung:
  **75/75 WebGL-Integrationstests** auf `4fc5ce5`. Auf dem neueren
  Panzerstand `81544d1` fiel eine echte Drehraten-Regression auf.
  Die Korrektur `5c2716c` braucht erneute lokale Abnahme.
- Die beiden Branches sind divergiert; keine blinde Übernahme eines PRs.

## Arbeitsfolge und Freigabesperren

### G0 — Stabiler Basisstand (Pflicht vor weiteren großen Merges)

1. `npm run test:webgl-integration` auf dem aktuellen PR-Head ausführen.
   Erwartete Anzahl nach der letzten Panzeränderung: **13 Node- und
   64 Browser-Tests**. Ergebnisse nicht als bestanden markieren, bevor
   sie auf genau diesem Commit protokolliert wurden.
2. Separate lokale Änderungen wie `scripts/webgl-construction.js`
   sichern/abgleichen, bevor Working Trees gewechselt werden.
3. Reale Spielrunde mit Panzerstart, Richtungswechsel, Turmausrichtung,
   Mündungsfeuer und globaler Produktion prüfen.
4. `npm test` auf **demselben** 3D-Branch durchführen und sämtliche
   Fehler klassifizieren (echte Regression, veraltete Canvas-Erwartung,
   bereits bestehender Fehler, Test-Infrastruktur). Kein pauschales
   Aufweichen der Assertions.

**Gate:** Build und WebGL-Integration grün; keine ungeklärte neue Regression.

### G1 — Gemeinsame Simulation und Feature-Parität

- Die Performance-Optimierung der Zielsuche aus PR #184 selektiv in den
  neueren `simulation.ts`-Stand übertragen, einschließlich deterministischer
  Referenztests; **keinen** überschreibenden Merge der älteren Simulation.
- Canvas-spezifische Eingabekorrekturen (Escape, Fokusverlust,
  Auswahlrechteck) als Verhalten in der WebGL-Eingabe testen und fehlende
  Fälle dort beheben.
- Einheitliche Steuerung, Auswahl, Mehrfachauswahl, Einheitenaufträge,
  Bauphasen, Rally-Punkte, Speichern/Laden, Sicht/Nebel, Pause,
  KI-Verhalten und Endzustände mit einer Paritätsmatrix erfassen.
- Mündungsanker nicht aus Canvas-Sprite-Offsets übernehmen: WebGL muss
  sie an echten glTF/GLB-Knoten messen.

**Gate:** Für jedes Spieler-Feature ein bestandener WebGL-Regressionsfall,
kein Verlust von Spielständen oder abgesicherten Legacy-Szenarien.

### G2 — WebGL-3D als Standard-Einstieg

1. Die WebGL-Startseite von einem „Preview“-Einstieg zu `/` überführen
   (Titel, Ladebildschirm, Menü, Einstellungen, Fehlerzustände).
2. Bestehende Links/Savegames und Browser-Tests sauber migrieren. Legacy-
   Tests erhalten einen ausdrücklich benannten Canvas-Einstieg statt
   stillschweigend den falschen Renderer zu laden.
3. Canvas-Spiel nur im internen/Legacy-Pfad behalten; Standard-Build und
   Deployment müssen ohne alte Canvas-Spiel-Abhängigkeiten starten.
4. Für Geräte ohne funktionsfähiges WebGL eine verständliche Fehlermeldung
   statt eines weißen Bildschirms anzeigen.

**Gate:** `/` startet standardmäßig die vollständige WebGL-Version,
Laden/Fortsetzen/Neues Spiel funktionieren und kein Test setzt versehentlich
die klassische Einstiegsversion voraus.

### G3 — Art Direction, Gameplay und KI-Qualität

- Einheitliche Stil-/Maßstabsvorgaben für Panzer, Infanterie, Helme, Waffen,
  Fahrzeuge, Gebäude, Bauprops, Felsen, Vegetation, Schatten und PBR.
- Authored-GLB-Hierarchien testen (z. B. `Tank_Turret`, `Tank_Gun`,
  `TurretHead`, `TurretMuzzleL/R`), inklusive echter Schussereignisse.
- Bewegung: getrennte Wanne/Turm/Kanone, kein Snap beim Anfahren, keine
  doppelt angewandte Drehung, Fahrzeuge folgen Wegpunkten ohne Ruckeln.
- KI: mehrere Seeds, Karten und Gegner, Baseline-vs-Director gepaart;
  **Siegquote**, HQ-Schaden, Missionsabbrüche, bezahlte Aktionen und
  Gefechtsdauer protokollieren. Zeitlimit ist **kein Sieg**.
- Sound, Bildschirmskalierung, HUD-Kontrast, Animationen und
  Produktionsstatus visuell bei mindestens drei Zoomstufen begutachten.

**Gate:** Kritische Spielabläufe vollständig, konsistenter visueller Stil,
keine bekannten spielblockierenden KI- oder Bewegungsfehler.

### G4 — Stabilität, Performance und Veröffentlichung

- Langzeit-Gefechte mit 4/8/12/16 Bastionen, vielen Einheiten und großen
  Kämpfen. FPS, Framezeiten, Simulation-p95, Speicherentwicklung,
  Draw Calls und Ladezeiten messen, nicht nur isolierte CPU-Benchmarks.
- Kein dauerhafter Stillstand von Einheiten mit gültigen Befehlen,
  kein Speicherausreißer nach großen Gefechten, kein Gameplay-Stottern
  nach dem Kampf. Fehler reproduzierbar mit Seed und Zeitstempel erfassen.
- Browser- und Node-Gesamtsuite, Save/Load-Regression und visuelle
  Screenshots dokumentieren; die 18 alten Canvas-Fehler jeweils explizit
  lösen, archivieren (nur echte Legacy-Fälle) oder als Release-Blocker
  markieren.
- Erst nach Freigabe PR-Integrationsreihenfolge festlegen, Mainline
  aktualisieren, Release-Tag setzen und Uberspace/Docker-Deployment testen.

**Gate:** Null ungeklärte kritische Fehler, reproduzierbar grüner
WebGL-Release-Testplan auf dem exakt veröffentlichten Commit.

## Arbeitsregeln

- **Keine doppelte Entwicklung** von alten Canvas- und neuen WebGL-Features.
- Ein PR-/Feature-Zweig pro Arbeitspaket; vor Merge die Zielbasis neu
  abgleichen. Keine unsicheren Force-Pushes oder Überschreibungen lokaler
  Dateien.
- Keine Änderung der Hitbox/Spielbalance nur für schönere 3D-Proportionen.
- Jede Implementierung besitzt konkrete Testfälle und bei Grafikänderungen
  eine echte Modell-/Browserkontrolle, nicht ausschließlich Zahlenprüfungen.
- Jede Statusmeldung nennt den geprüften Commit und trennt **implementiert**,
  **statisch geprüft**, **lokal getestet** und **visuell abgenommen**.

## Umsetzung – WebGL-Konsolidierung, erster Entwicklungsschritt

Die Änderungen sind auf PR #227 implementiert, aber **noch nicht lokal/visuell
abgenommen**. Der PR bleibt deshalb als Entwurf bestehen:

- PR-184-Zielsuche wurde **selektiv** in den aktuellen 3D-Simulationsstand
  übertragen; der pro Tick erneuerte `unitById`-Index ersetzt die temporäre
  Kopie aller Einheiten und Gebäude in `acquire()`.
- Die **zwei deterministischen Tests** aus PR #184 wurden übernommen und
  sind Teil von `npm run test:webgl-integration`; der komplette Panzer- und
  WebGL-Stand wurde nicht durch einen älteren Canvas-Branch ersetzt.
- Ein dediziertes GitHub-Actions-Gate unter
  `.github/workflows/sandforge-webgl-consolidation.yml` prüft TypeScript,
  Combat-Index und Chromium-WebGL-Integration. Es prüft danach ausdrücklich
  auch den Root-Einstieg mit tatsächlichem WebGL-Canvas.
- Der Build bietet jetzt einen **reversiblen G2-Kandidaten**:
  `SANDFORGE_RENDERER=webgl npm run build` oder `npm run dev:3d`.
  Nur dabei wird `dist/index.html` zur 3D-Spielseite; die alte Canvas-Seite
  liegt unter `/classic.html`. Ohne Flag bleibt `/` unverändert, bis G0/G1
  nachweislich bestanden sind.
- In der WebGL-Eingabe werden ein hängen gebliebenes Auswahlrechteck und
  bewaffnete Bau-/Angriffs-/Sammelpunktmodi bei Fenster-Fokusverlust
  bereinigt. Ein neuer Browser-Test prüft die Regression.

Diese Arbeiten sind **kein fertiger Release**: weitere Grafik-/AI-/Langzeittests
und die formale Umstellung des Default-Builds folgen erst nach erfolgreicher
Abnahme. Die 18 historisch dokumentierten Canvas-Fehler sind dadurch nicht
pauschal gelöst.

### Sofort lokal testen

```bash
cd ~/Projects/sandforge-input-preview
git fetch origin
git switch --detach origin/fix/webgl-classic-input-parity-20261104
npm run test:webgl-integration
PORT=8102 HOST=127.0.0.1 npm run dev:3d
```

Dann `http://127.0.0.1:8102/` (3D-Haupteinstieg) und
`http://127.0.0.1:8102/classic.html` (Canvas-Referenz) prüfen.

## Laufende lokale Abnahme

```bash
cd ~/Projects/sandforge-input-preview
git fetch origin
git switch --detach origin/fix/webgl-classic-input-parity-20261104
npm run test:webgl-integration
PORT=8102 HOST=127.0.0.1 npm run preview
```

WebGL-Spiel: `http://127.0.0.1:8102/webgl-preview.html?bastions=4&seed=2074&perf=1`

Dieser Plan ist **kein** Nachweis einer bereits abgeschlossenen Migration
oder Release-Freigabe.
