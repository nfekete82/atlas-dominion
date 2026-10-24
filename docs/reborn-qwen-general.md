# Experiment: Qwen-General (Browser/WebGPU)

Dieser Branch baut auf dem synchronisierten Spielstand `f215f1c` auf.
Die vorhandene `TacticalAI` bleibt die Standard-Gegner-KI. Es wird **kein**
Sprachmodell beim normalen Spielstart geladen.

## Aktivierung

Im Spiel **Optionen → Qwen-General (Experiment, großer Download)** einschalten.
Erst dann startet ein dedizierter Browser-Web-Worker, der
`onnx-community/Qwen3-0.6B-ONNX` mit 4-Bit-WebGPU-Inferenz lädt.
Die Modelldateien kommen von Hugging Face, die Transformers.js-Laufzeit in
diesem Prototyp von einem fest versionierten jsDelivr-CDN
(`@huggingface/transformers@3.8.1`). Die Inferenz findet auf dem **Gerät
des Spielers** statt. Für die erste Aktivierung ist Internetzugang nötig;
der Browser kann Downloads zwischenspeichern. Kein privater MLX-Server,
kein OpenAI-Konto, kein API-Key und kein GPU-Server erforderlich.

Der initiale Modelldownload liegt in der Größenordnung mehrerer hundert
Megabyte. Leistungsfähigkeit und Browserunterstützung sind unterschiedlich;
die bloße Existenz eines Web-Workers garantiert keine flüssige GPU-Inferenz.
WebGPU setzt einen sicheren Kontext (HTTPS oder localhost) voraus.
Ohne WebGPU oder bei einem Laufzeitfehler bleibt die klassische KI aktiv.
Der Modus wird nicht automatisch für spätere Besuche eingeschaltet.

## Funktion

- Die taktische KI erstellt weiterhin Zielbewertungen aus ihrem eigenen
  Sichtwissen, dem Nebel des Krieges, ihren Türmen-Erinnerungen und ihren
  Gefahren-/Routenbewertungen.
- Qwen bekommt nur **bis zu vier bereits mögliche, der KI bekannte**
  Sektoren mit kompakten aggregierten Kennzahlen, Credits und Armeestärke.
  Versteckte gegnerische Einheiten/Gebäude werden nicht übertragen.
- Das Modell wählt ausschließlich `{"sectorId": n}`. Ungültige IDs,
  nicht parsebare Antworten und alte Spielstände führen zu keiner Aktion.
- Die taktische KI akzeptiert nur gültige Ziele unter den vier bevorzugten
  Alternativen, die gegenüber der besten Heuristik höchstens 700
  Bewertungspunkte schlechter sind.
- Es wird höchstens alle **30 simulierten Sekunden** geplant, nur während
  Sammeln/Neuformieren; nie während eines laufenden Angriffs oder einer
  Basisverteidigung. Die Simulation wartet nicht auf Qwen.
- Das Sprachmodell steuert **nicht** einzelne Einheiten, Waffen,
  Wegfindung, Produktion oder Ressourcen. Diese Mechaniken bleiben
  deterministisch. Qwen ist in dieser ersten Ausbaustufe **ein
  strategischer Zielwahl-Prototyp**, keine vollständige neue Hybrid-KI.
- Savegames bleiben im bisherigen Format. Vorschläge werden nicht
  gespeichert; nach einem neuen oder geladenen Spiel werden alte
  Worker-Antworten verworfen.

## Webserver

Der vorhandene statische Build wird weiterhin verwendet:

```sh
npm run build
npm run preview
```

`scripts/build.mjs` kopiert den Worker nach
`dist/src/reborn/qwen-general.worker.js`; TypeScript kompiliert
`qwen-general.ts` und `qwen-plan.ts` wie üblich nach `dist/src/reborn/`.
Ein normaler HTTPS-Webserver kann `dist/` bereitstellen.
Der experimentelle Modus braucht auf Endgeräten WebGPU und Zugriff
auf das Versions-CDN und die Modelldateien. Für eine unabhängig
betriebene Produktionsfassung wäre eine geprüfte, selbst gehostete
Laufzeit sinnvoll; dieser Prototyp ist deshalb **nicht vollständig
offline-selbstgehostet**.

## Prüfen

```sh
npm run build
node --test tests/reborn-qwen-plan.test.mjs tests/reborn-tactical-ai.test.mjs
npm run preview
```

Im Browser:
1. Ohne Opt-in laden: im Netzwerk-Tab dürfen keine Modellgewichte
   heruntergeladen werden.
2. Aktivieren: Fortschritt und anschließend `Qwen bereit` prüfen.
3. Mit `/?debug&perf` lang genug spielen und Inferenzphasen mit
   FPS/p95/p99 vergleichen. Auch starke Gefechte prüfen.
4. Qwen bei laufender Partie ausschalten und klassische KI verifizieren.
5. Browser ohne WebGPU prüfen; Modell darf nicht geladen werden.
6. Spielstand laden oder Kampagne neu starten, während Qwen rechnet:
   veralteter Modellvorschlag darf nicht ausgeführt werden.

**Status:** Quellcode per GitHub-Connector implementiert. Es wurde hier
weder ein npm-Build noch eine tatsächliche Browser-WebGPU-Inferenz
ausgeführt. Ein Leistungsgewinn oder intelligentere Entscheidungen
sind ausdrücklich **noch nicht nachgewiesen**.

## Nächster Schritt

Für einen objektiven Vergleich 20–30 identische Kartenseeds mit
klassischer KI und Qwen-General laufen lassen und eroberte Sektoren,
Verluste, validierte Antworten, Inferenzzeiten und Framezeiten messen.
Nur bei echtem Gewinn den Modus weiter ausbauen.
