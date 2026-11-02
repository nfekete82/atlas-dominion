# Sandforge: Bastion Wars — GitHub-RTS-KI-Vergleich

Stand: 2026-11-02. Kuratierter Vergleich von acht realen Open-Source-RTS-Projekten. **Kein allgemeines Ranking, kein Benchmark zwischen inkompatiblen Spielen und keine Aussage über sämtliche GitHub-Repositories.** Inspektionsgrundlage Sandforge: Commit `a2996a0c` (Gameplay seit `5988752`, darauf aufbauende Testkorrekturen). Fremdprojekte: veröffentlichte Repository-Quellen, Code und offizielle Dokumentation.

## Befund für unser Spiel

Sandforge besitzt bereits einen umfangreichen deterministischen Director:
- `src/reborn/tactical-ai.ts` (Kampagne, sichtbare Feindinformation, Rekrutierung, Missionen, Angriff, Belagerung, Rückzug, Aufklärung);
- `src/reborn/army-economy.ts` und `director-production.ts` (bezahltes Bauen, Truppenzusammenstellung, zweckgebundene Artilleriereserve);
- `src/reborn/battle-response.ts` (Kraft-/Gegnerbewertung, Front-Retry);
- `src/reborn/battle-squads.ts` (Screening, Flanken, Roster);
- `src/reborn/tactical-search.ts` (bereits vorhandener 24-Sekunden-Lookahead, 3-Sekunden-Schritte, max. 24 eigene Kämpfer; vergleicht assault/flank/siege/regroup);
- `src/reborn/battle-learning.ts` (bounded outcome memory: Taktiken/Bucket-Werte, keine generelle Lern-KI);
- `src/reborn/simulation.ts` (physische 0,05-s-Schritte, pro Einheit verriegeltes `combatTarget`, Distanz- und Rollenboni).
Der Gegner wird unter Nebel nur aus realer Sicht / erlaubten Erinnerungen bewertet. Diese Eigenschaft unbedingt erhalten.

**Gemessener Engpass, nicht bloß Vermutung:** Im 9-Paar-/360-s-A/B gegen `feat/sandforge-ai-limited-siege-screen-20261102` waren beide Versionen in allen Outcomes identisch. In der Baseline entstanden 46 eigene Verluste (43 normale Infanterie, 2 schwere, 1 Sanitäter). Die experimentelle neue Abfangentscheidung wurde **0-mal** ausgelöst. Experiment PR #171 nicht freigeben, weil es den eigentlichen Massenverlust nicht adressiert.
A/B: https://github.com/nfekete82/atlas-dominion/actions/runs/41471784782 (vollständige maschinenlesbare Artefakte im Run).

## Acht externe Referenzen (Implementierung untersucht)

| Projekt | Tatsächliche Technik / Quellstelle | Realer Transfer | Vorbehalt |
|---|---|---|---|
| [OpenRA](https://github.com/OpenRA/OpenRA) | [Squad-FSM](https://github.com/OpenRA/OpenRA/blob/bleed/OpenRA.Mods.Common/Traits/BotModules/Squads/States/GroundStates.cs), [AttackOrFleeFuzzy](https://github.com/OpenRA/OpenRA/blob/bleed/OpenRA.Mods.Common/Traits/BotModules/Squads/AttackOrFleeFuzzy.cs), getrennte Baumanager und SquadManager | Zustandsübergänge ohne Befehls-Flattern, lokale Rückzugsentscheidung anhand Kampfkraft | GPL-3.0, keine Codeübernahme ohne Lizenzprüfung |
| [0 A.D. / Petra](https://github.com/0ad/0ad) | [attackPlan.js](https://github.com/0ad/0ad/blob/master/binaries/data/mods/public/simulation/ai/petra/attackPlan.js): vorbereiten, sammeln, loslaufen, auf erlittenen Angriff reagieren, Route korrigieren, Abort und geordneter Rückweg; [defenseManager.js](https://github.com/0ad/0ad/blob/master/binaries/data/mods/public/simulation/ai/petra/defenseManager.js) | Marsch-Watchdog nach Schwerpunkt, sinnvolle Attack-/Abort-Telemetrie, Gruppierung nach Bedrohungsclustern | GitHub-Mirror ist **seit 2024 archiviert**; aktuelle Quelle bei Wildfire Games Gitea |
| [Sharpy-SC2](https://github.com/DrInfy/sharpy-sc2) | [default_micro_methods.py](https://github.com/DrInfy/sharpy-sc2/blob/develop/sharpy/combat/default_micro_methods.py) mit tatsächlicher Focus-Fire-Auswahl; [group_combat_manager.py](https://github.com/DrInfy/sharpy-sc2/blob/develop/sharpy/combat/group_combat_manager.py) gruppiert Kampftrupps und verwaltet Regroup-Schwellen | Zielverteilung, Einheiten-/Gruppen-Micro, anti-overkill | MIT |
| [Sharky](https://github.com/sharknice/Sharky) | [IndividualMicroController.cs](https://github.com/sharknice/Sharky/blob/master/Sharky/MicroControllers/IndividualMicroController.cs): viele geordnete Micro-Schritte, gruppieren, Spezialfähigkeit, Zielwahl, Schaden vermeiden | Saubere Aufteilung nach Unit-Rolle und Command-Priorität; Anti-Order-Spam | Kein verifizierter Lizenzmarker in GitHub-API: nur Ideen übernehmen |
| [CommandCenter](https://github.com/davechurchill/commandcenter) | Eigener Worker-/Building-/Map-Manager, Memory letzter Feindsichtungen, Build Orders, Squad Manager. README räumt ein, dass Combat-Simulation **nicht** implementiert war | Architektur vergleichen; Sandforge verfügt bereits über vieles davon | MIT, älterer Stand; nicht mit Spielstärke gleichsetzen |
| [UAlbertaBot](https://github.com/davechurchill/ualbertabot) | SparCraft als abstrahierte schnelle Gefechtssimulation, Build-Order-Suche und Kampfevaluation | Simulation-Kalibrierung; preiswerte Was-wäre-wenn-Kämpfe | MIT; alte Engine, nicht direkt kopierbar |
| [MicroRTS](https://github.com/Farama-Foundation/MicroRTS) | [PGSAI.java](https://github.com/Farama-Foundation/MicroRTS/blob/master/src/ai/portfolio/portfoliogreedysearch/PGSAI.java) kombiniert Skripte pro Einheit und wertet Simulations-Rollouts aus; dazu MCTS und HTN | Bestehendes `tactical-search.ts` als **kleines Portfolio** ausbauen, nicht komplettes MCTS pro Simulations-Tick | GPL-3.0; Projekt seit 2025 als deprecated markiert |
| [Beyond All Reason](https://github.com/beyond-all-reason/Beyond-All-Reason) | Großmaßstäbliche RTS-Umgebung mit eigenen Lua-/Skirmish-KIs, Rollen und Ökonomie | Inspiration für Skalierung 4–16 Bastionen und wechselnde Fronten | Spiel und KI-Code separat prüfen; keine pauschalen Lizenz-/Qualitätsaussagen |

Mehr Quellen: https://docs.openra.net/en/playtest/traits/ ; https://github.com/oxwhirl/smac/blob/master/docs/smac.md

## Prioritäten mit Umsetzungsvorschlag

### P0 — Erst die Todesursachen messen (klein, sehr hohe Priorität)
**Warum:** Bisher zählen wir Tote je Einheitentyp, aber nicht, *warum* 43 Infanteristen sterben. Ohne Auslöserinstrumentierung testen wir weiterhin KIs mit 0 tatsächlich ausgelösten Entscheidungen.
- Im **Benchmark-Beobachter** bzw. in read-only instrumentierter Simulation messen: letzte tatsächlich erlittene Trefferquelle, eigene Rolle, Angriffsmission/Phase, Abstand/feindliche Waffenreichweite zum Todeszeitpunkt, zuletzt gesetzter Befehl, Schaden während Annäherung vs. Feuergefecht, übermäßige Gruppenkonzentration.
- Dazu `microDecisionsEvaluated`, `microOrdersIssued`, `targetsChanged`, `overkillPrevented` pro Gefecht, damit ein wirkungsloser Feature-Zweig sofort sichtbar wird.
- **Wichtig:** Die Offline-Benchmark-Auswertung darf Schadensquellen vollständig erfassen; die KI-Live-Eingaben dürfen trotzdem keine verborgenen Feinde/HP sehen. Tests mit gespiegelten unsichtbaren Gegnerwelten.

### P1 — Zielzuteilung und Overkill vermeiden (mittel, größte direkt belegbare Lücke)
**Quelle:** Sharpy-Focus-Fire, SMAC-Micro-Grundlagen.
- Gruppiere Einheiten in einem tatsächlichen Gefechtscluster. Halte für sichtbare, tatsächlich angreifbare Feindziele eine kurzlebige *reservierte, prognostizierte* Schuss-Schadensmenge. Wähle pro eigener Einheit eine geeignete Zielpriorität aus (Threat gegen eigenes Kernteam, Reichweite, kann angreifen, erwartete Treffer, Rest-HP, bereits zugewiesener Schaden).
- **Nicht** jede Einheit auf einen einzigen Gegner überfokussieren; keine tödliche Rakete doppelt einplanen. Bereits gestartete Geschosse erst bei realem Schaden/Verlust berechnen; keine garantierte Schadenswirkung bei missfähigen Flugkörpern.
- Bestehende manuell gesetzte Spielerbefehle nicht überschreiben; robuste minimale Lock-Zeit und Befehlscooldown gegen Target-Flattern.
- A/B-Diagnose: tatsächliche Zielumlenkungen >0, Schaden pro Credit, eigene Infanterieverluste, gewonnene Gefechte, Kosten pro Tick.

### P2 — Infanterie-Positionierung anhand beobachtbarer Feuerzonen (mittel)
**Quelle:** OpenRA, Sharpy und das [StarCraft-Micro-Testbed SMAC](https://github.com/oxwhirl/smac).
- In einem lokalen Kampfradius sichere Feuerpositionen bewerten: eigene Waffenreichweite, Gegner-Reichweitenüberschuss, bekannte Turmbereiche, Kollisions- und Weggefahr. Panzer und schwere Infanterie bilden Front; leichte Infanterie bleibt beim Vorrücken zunächst hinter gepanzerten Einheiten.
- Kein unendlicher Rückzug oder Eiertanz: hysteretische Zustände `approach / shoot / reposition / disengage`, min. Wechselintervall, Stuck-Watchdog; Munitions-/Cooldown-Timing nur anhand realer lokaler Informationen.
- Test: gleiche HP/Kosten/Sichtwelt, weniger frühe Todesfälle vor erstem abgegebenen Schuss, keine schlechtere HQ-Schadensleistung, keine extra Wegfindungsblockade.

### P3 — Begrenzte Portfolio-Auswahl und Selbstkalibrierung (mittel bis groß)
**Quelle:** MicroRTS PGSAI und SparCraft.
- **Nicht neu erfinden:** `tactical-search.ts` evaluiert bereits drei Aktionen über einen 24-s-Horizont. Erweiterung zuerst um `hold-and-fire`, `armored-front`, `staggered-approach`; dabei nur 3–5 Kandidaten je relevantem Kontakt berechnen, nicht jeden Tick.
- Prognose vs. tatsächliche Gefechtsergebnisse messen (Brier/MAE), nach Armeekomposition und Gegnerart gruppieren; gewonnene Credits/Sektoren/Verluste als reale Reward-Komponenten.
- Kein neuronales LLM im 20-Hz-Kampf-Loop; für deterministische JS/TS-RTS sind lokale Micro-Regeln besser kontrollierbar. Offline RL ist eine spätere Forschungsoption, falls genug Trainingsdaten und wiederholbare Szenarien vorhanden sind.

### P4 — Angriffs-Watchdog/Ownership (mittel)
**Quelle:** Petra-Angriffspläne / Sharky Task-Claims.
- Gruppen-Schwerpunkt alle ca. 2–3 Sekunden, Wegpunktfortschritt, tatsächlicher Schaden, unbekannte Blockade und Ankunft per Kampfkontakt protokollieren. Nach begrenzter Stagnation eines von: Repath, leicht versetzter Rally-Punkt, erzwungener Kampfhalt, Mission abbrechen.
- Pro Einheit deterministischer Order-Owner und Priorität: unmittelbare Verteidigung > zwingende Flucht > laufender Kampf > reguläre Mission > Produktion; Reihenfolge nicht ohne Grund in jedem Macro-Puls überschreiben.

## Akzeptanz-Gates für Gameplay-Features

1. Zuerst reproduzierbare **kleine taktische Szenarien** (5 vs. 5, Geschütz, Panzer/Infanterie, Rauch/Fog, Hindernisse), zusätzlich alle bestehenden Node-/Browsertests.
2. Mindestens neun identische längere A/B-Paare als *Smoke-Test*, danach mehr Seeds/Karten/Strategien für belastbare Aussage. Jede Versuchsreihe mit identischen Startwelt-Hashes, real bezahlter Produktion, identischem Gegner und expliziten Triggerzählern. `0 Triggers` ist **kein Wirksamkeitsbeweis**, sondern ein Hinweis auf schlechte Szenarioabdeckung.
3. Explizit prüfen: Siege, mittlerer HQ-Schaden, Sektoreroberungen, Infanterieverluste, insgesamt verlorene Credits, p95 Tickzeit, neue Stalls. Ein Sieg gegen neun Seeds ist ein interessanter Hinweis, keine allgemeine Aussage über stärkere KI.
4. Jeweils nur **eine** Gameplay-Regel pro PR und A/B-Experiment. Keine Durchmischung von Testbereinigung, Fog, Mikro-Optimierung und Wirtschaft. Unbewiesene Kandidaten nicht lokal oder auf Uberspace ausrollen.

## Lizenz-/Wartungshinweis

*Ideen und Algorithmen vergleichen* ist nicht gleich *Dateien kopieren*. OpenRA und MicroRTS führen GPL-3.0, Sharpy und CommandCenter MIT. Das historische 0-A.D.-GitHub-Mirror ist archiviert und verweist auf Gitea; Lizenz der konkreten Datei gesondert prüfen. Bei Sharky ergab die GitHub-API keinen verifizierten Lizenzmarker. **Deshalb Konzepte in eigenem TypeScript neu implementieren und fremde geschützte Dateien nicht direkt übernehmen**, bis Kompatibilität und Verpflichtungen geklärt sind.
