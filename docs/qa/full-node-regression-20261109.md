# Sandforge – vollständige Node-Regression, 09.11.2026

## Verifizierter Ausgangspunkt

Quelle: lokales `npm test`-Terminalprotokoll des Projekteigentümers, getestet auf
`b31546afc37116e373cc8e9e0642d44b61121980`.

- TypeScript/Bundle: **PASS**.
- Browser-Testnachweis auf dem früheren WebGL-Code-Commit `3f30e379`: **72/72 Chromium PASS**, separat dokumentiert unter [WebGL-Abnahme](webgl-integration-20261109-3f30e379.md).
- Gesamte Node-Suite: **1356 Tests, 1321 PASS, 34 FAIL, 1 SKIP** (ca. 74,9 Sekunden).
- Ein fehlgeschlagener `npm test`-Lauf ist **keine** vollständige Freigabe.

## Ursachen und Korrekturstrategie

Die 34 Fehlergruppen umfassen:

| Anzahl | Bereich | Vorgehen |
| ---: | --- | --- |
| 6 | Umgebungs-/Fahrzeugsound | Bewegung nur bei gemessenem Ortswechsel hörbar; Standgeräusche bleiben aus; alte Sound-Fixtures aktualisiert |
| 5 | Bomber, Luftfahrzeug-Skalierung und Rückzug | Aktuelle große Orbit-Radien, hohe Bombergeschwindigkeit, neue 3D-Maßstäbe und timed Bombenabwurf berücksichtigen |
| 2 | Gebäude-Assets und Dekoration | Neue strategische Gebäude besitzen prozedural erstellte PBR-Meshes statt nicht vorhandener GLB-Dateien; neue Props zählen |
| 5 | Boarding, gemischte Truppen und Fahrzeugkollision | Isolierte Fixtures benötigen einen fernen Gegenspieler: sonst stoppt `eliminationOutcome` die Simulation nach dem ersten Tick |
| 7 | Kampagnenende und Bastionseroberung | Kein vorzeitiger Sieg nach bloßem HQ-/Sektorgewinn. Tatsächliche Eliminierung gezielt prüfen; Bomber-Capture-Fixtures im Hold-Modus |
| 5 | KI-Reaktion auf Türme | Gesunde Angriffstrupps bleiben engagiert; kritisch verwundete Einheiten ziehen sich weiterhin unmittelbar zurück |
| 1 | Bauauswahl | Geometrisch freie Fläche genügt nicht; ausgewählter Pionier muss auch einen tatsächlichen Zugangsweg haben |
| 1 | Reparaturunterstützung | Bomber für einen ortsfesten 90-Meter-Reparaturtest ausdrücklich auf Position halten |
| 2 | Forschung/Silo | IEEE754-Rundung tolerieren; echten nach `step(.05)` geänderten Ladestand bei Save/Load vergleichen |

**Korrekturumfang:** ausschließlich `tests/*.test.mjs`. An der produktiven Simulation, Assets, WebGL-Logik, Docker-Dateien, Paketkonfiguration und am Deployment wurde für diesen Korrekturdurchgang nichts geändert.

**Keine Entwarnung ohne Retest:** Fixtures wurden so angepasst, dass moderne Regeln *positiv* getestet werden. Erst die lokale erneute Ausführung entscheidet, ob noch echte Simulation-, Navigations- oder Timingfehler vorliegen.

## Zuerst nur die betroffenen Tests

```sh
npm run build
node --test \
 tests/reborn-atmosphere-v1.test.mjs \
 tests/reborn-bomber-idle-orbit.test.mjs \
 tests/reborn-building-decor.test.mjs \
 tests/reborn-control-retreat.test.mjs \
 tests/reborn-defense-map.test.mjs \
 tests/reborn-hq-bootstrap.test.mjs \
 tests/reborn-production.test.mjs \
 tests/reborn-selected-squad-pace.test.mjs \
 tests/reborn-support.test.mjs \
 tests/reborn-threat-response.test.mjs \
 tests/reborn-vehicle-aircraft-soundscape.test.mjs \
 tests/reborn.test.mjs \
 tests/sandforge-vehicle-building-clearance.test.mjs \
 tests/sandforge-webgl-playable.test.mjs \
 tests/webgl-airlift-scale-bomber-20261108.test.mjs \
 tests/webgl-jeep-boarding.test.mjs \
 tests/webgl-strategic-tech-20261109.test.mjs \
 tests/webgl-transport-roster-bomber-runs-20261108.test.mjs
```

Danach `npm test` und die separate Classic-Browser-Suite `npm run test:browser:classic` ausführen.
Für die Canvas-Suite den klassischen Build nur im isolierten Worktree erzeugen.
**Kein Merge, kein Port-8095-Deploy, kein Uberspace-Upload** durch die reine Testangleichung.

## Noch offene Integrationsrisiken

Der GitHub-Default-Branch `main` ist weiterhin ein älterer Canvas-Stand; der aktuelle WebGL-Branch ist auf viele Draft-PRs gestapelt und gegenüber `main` stark divergent. Auch bei vollständig grüner Node-Suite erfordern Produktion und Release separate Stack-Konsolidierung, CI, KI-/Performance-Abnahme und kontrollierte Rollback-Vorbereitung.
## Verifizierter Nachlauf auf `f85bfdf4` (09.11.2026)

Erneuter vollständiger lokaler `npm test`-Lauf:

| Ergebnis | Wert |
| --- | ---: |
| Build | PASS |
| Gesamte Tests | 1.357 |
| Bestanden | **1.354** |
| Fehlgeschlagen | **2** |
| Übersprungen | 1 |
| Laufzeit | ca. 70,8 s |

Die zuvor gemeldeten 34 Fehler sind bis auf zwei beseitigt. Die verbleibenden Punkte:

1. **Formationstempo:** Der eigentliche Bewegungsbefehl ist auf das langsamste Gruppenmitglied begrenzt, aber eine nachfolgende **weiche Abstandskorrektur** konnte den Panzer im selben Simulationsschritt zusätzlich vorwärts schieben (`3.544` statt erlaubter `3.25+0.12` Einheiten bei 20 Hz). Der Simulationscode begrenzt jetzt *nur diese kosmetische weiche Abstandskorrektur*, sofern die Einheit Teil eines aktiven, wechselseitig zugeordneten Spieler-Marschverbands ist. Harte Kollisionsauflösung bleibt unbeschränkt. Der Test unterscheidet nun Wegstrecke aus dem Bewegungsbefehl und resultierende Gesamtverschiebung einschließlich Kollisionskorrektur.
2. **Rüstungsforschung:** `researchModifiers(...,'rover').hp` ergibt IEEE754-bedingt `1.2000000000000002` statt exakt `1.2`. Test nutzt Toleranz `1e-12`, der Spielwert und seine Berechnung bleiben unverändert.

**Nachlauf auf diesen neuesten Korrekturen steht noch aus.** Insbesondere weil die erste Korrektur die Simulations-Kollisionsroutine betrifft, müssen sowohl `npm test` als auch die WebGL-Browserintegration auf dem neuen Commit nochmals vollständig laufen. Keine automatische Release-Freigabe.

### Wiederholung

```sh
npm run build
node --test tests/reborn-selected-squad-pace.test.mjs tests/webgl-strategic-tech-20261109.test.mjs \
 tests/sandforge-vehicle-building-clearance.test.mjs
npm test
SANDFORGE_TEST_MAX_FAILURES=0 SANDFORGE_BROWSER_CHANNEL=chromium npm run test:webgl-integration
```

## Finale lokale Node- und Chromium-Abnahme auf `36419e1b` (09.11.2026)

**Mac-Protokoll, nach dem echten Formations-Kollisionsfix (`c028006c`) und IEEE754-Testfix (`2f554d0d`):**

| Prüfung | Ergebnis |
| --- | --- |
| `npm run build` | **PASS** |
| Fokustests (Formation, Fahrzeuge, Forschung) | **17/17 PASS**, 0 Fail |
| `npm test` (vollständige Node-Suite) | **1.357 gesamt; 1.356 PASS, 0 FAIL, 1 SKIP** |
| `test:webgl-integration` Node-Untergruppe | **17/17 PASS**, 0 Fail |
| Chromium Playwright (2 Worker, 72 Szenarien) | **72/72 PASS**, 0 Fail |
| Node-Gesamtlauf | 80,1 s |
| Chromium-Lauf | ungefähr 1,3 min |

Der eine Skip ist **`premium legionnaire: actual game atlases, faction distinction and GLB motion metadata`**: die optionalen, lokal installierten Premium-Binärassets wurden nicht in dieses isolierte Review-Verzeichnis kopiert. Kein fehlerhaftes Testergebnis. Ohne die Assets ist dieser einzelne Test nicht validiert.

Die vorherigen 34 Node-Fehler sind damit geschlossen. Besonders wichtig: Die finale Abnahme wurde **nach** der tatsächlichen Anpassung der weichen Fahrzeug-Separation vorgenommen, also nicht nur nach geänderten Assertions. Die WebGL-Testfälle wurden ebenfalls nach der Simulationsänderung erneut vollständig ausgeführt.

**Code-Stand:** `36419e1b4b9fb14f42a8de7e0437f4c9e9a0ea7a` (einschließlich vorangegangener Dokumentation). Nach diesem Commit neu entstehende Dokumentationsänderungen ändern die getestete Game-Logik nicht; für weitere Runtime-Änderungen ist eine neue Abnahme erforderlich.

### Verbleibende Freigabeschritte

- Die **separate Legacy-Canvas-Browser-Suite** (`npm run test:browser:classic`) wurde in diesem Lauf **nicht** ausgeführt.
- GitHub-CI-Status, umfangreiche KI-/Performance-Langzeitsimulation, reale Spiel-/Audiobetrachtung und isoliertes Docker-/Uberspace-Release inkl. Rollback sind nicht durch die grüne Node-/WebGL-Suite ersetzt.
- `main` ist noch der ältere Canvas-Stand; der Code liegt gestapelt auf Draft-PRs. Keine automatische Übernahme nach `main`.

