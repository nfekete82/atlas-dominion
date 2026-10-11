# ATLAS DOMINION

**v0.2 — BORDER ATTACK UPDATE** · Ein eigenständiges Echtzeit-Strategiespiel im Browser.

Steuere DOMINION von Berlin aus: Klicke direkt auf angrenzende Fraktionen und steuere den Truppeneinsatz auf einer echten Europakarte, vergrößere dein Gebiet, erobere Hauptstädte und setze dich gegen zehn autonome Fraktionen durch.

## Schnellstart

Benötigt: **Node.js 20+** und TypeScript (durch `npm install` verfügbar).

```bash
npm install
npm run dev
```

Browser öffnen: **http://localhost:8080** (Standardport). Wenn 8080 und 8081 bereits von anderen Projekten belegt sind: `PORT=8095 npm run dev` und **http://localhost:8095** öffnen. Im bereitgestellten Komplett-ZIP liegt `dist/` bereits bei: dort reicht auch `node scripts/serve.mjs` **ohne npm install**. Kein Account, API-Schlüssel oder externer Kartendienst erforderlich. Für Docker: `docker compose up --build -d` und dieselbe Adresse öffnen.

### Steuerung

- **Klick auf angrenzendes fremdes oder neutrales Territorium**: Sofort eine Offensive mit dem gewählten Truppenanteil starten (Klick irgendwo auf die angrenzende Fraktion genügt).
- **Truppenregler 5–100 %**: Bestimmt die Truppenmenge für den nächsten Klick; Presets **10 / 25 / 50 / MAX**; Hotkeys **T / Y** für −5 / +5 Prozentpunkte.
- **Erneuter Klick**: Zusätzliche Truppen entsenden, solange noch Reserven verfügbar sind.
- **Truppenbadge auf der Karte**: Jede Fraktion zeigt verfügbare Armee und ggf. Truppen im Angriff. Die Ländergrenzen der zugrunde liegenden geografischen Karte sind kein separates Nationen-Wirtschaftssystem.
- **Kein ungewollter Auto-Angriff**: Die Spielerfraktion bewegt sich nur auf Befehl. KI-Fraktionen kämpfen weiterhin automatisch.
- **Ziehen**: Karte verschieben.
- **Mausrad**, `+` / `−`: Zoom; `⌗`: Gesamtansicht.
- **Leertaste**: Pause; **1× / 2× / 4×**: Simulationsgeschwindigkeit.
- **Doktrinen-Tasten 1, 2, 3**: EXPAND (Neutralgebiete), BLITZ (höhere Angriffskraft und -frequenz), DEFENSE (Wirtschaft und Befestigung).
- **♪**: akustisches Feedback; **⛶**: Vollbild.
- **↻ Neues Spiel**: neue Partie beginnen.

**Siegbedingung:** 65 % der Landsektoren Europas kontrollieren oder alle anderen Fraktionen ausschalten. **Niederlage:** keine eigenen Sektoren mehr besitzen.

## In v0.1 enthalten

- Echte Europa-Silhouette mit Ländergrenzen, Inseln und 19.804 Landsektoren, komplett lokal eingebunden.
- 11 Fraktionen mit unterschiedlichen Hauptstädten und Farben; 10 computergesteuerte Gegenspieler.
- Kontinuierliche frontbasierte Expansion, kurze Seeübergänge zu Inseln und Anatolien, Kampf gegen feindliche Garnisonen, Hauptstadtverteidigung.
- Wirtschaft aus kontrollierten Sektoren und eroberten Städten.
- Direktes Grenzangriffssystem mit verbindlichem Prozent-Regler und echten Truppenkontingenten, drei Kampfdoktrinen, Leaderboard, Ereignis-Ticker, Sieg/Niederlage, Pause/Zoom/Vollbild.
- Reproduzierbare Simulation auf Basis eines Seed-RNG; Node-Tests.
- Anpassungsfähige UI und zero-runtime-dependency Rendering mit Canvas 2D.

## Architektur

```text
src/
  data/europe.ts       Lokal generierte Geo-Daten, Raster und Länderpolygone
  engine/game.ts       Deterministische Simulation; keinerlei Browser-Abhängigkeit
  render/map.ts        Canvas-Renderer, Kamera, Eingaben, gecachte Terrain-/Front-Layer
  main.ts              UI-Controller, HUD, Spieltakt und Spielbefehle
  style.css            UI-Design und responsive Layout
scripts/
  generate_map.py      Optional: Karten-Generator aus Natural Earth
  build.mjs            Statisches Deployment in dist/
  serve.mjs            Minimaler lokaler HTTP-Server
  ...
tests/game.test.mjs   Reproduzierbarkeit, Fraktionen, Topologie, Kampf
```

Design-Prinzip: **Game State → Simulation → Rendering**. Kein Browser- oder Netzwerkzugriff aus dem Simulationskern. Damit lässt sich in v0.4 eine serverautorisierte Multiplayer-Simulation aufsetzen, ohne Spielregeln neu zu erfinden.

**Rendering-Entscheidung:** Für v0.1 verwenden wir Canvas 2D, um eine vollständig lauffähige, lokal testbare Version ohne externe Abhängigkeiten zu liefern. Die Renderer-Schnittstelle bleibt austauschbar; ein Upgrade auf PixiJS/WebGL ist für v0.2 vorgesehen, sobald wir die Belastung mit großen Schlachten profilieren.

**Limitierungen v0.2:** Solo gegen KI; keine WebSocket-Lobbys, Wirtschaftsbauwerke, Diplomatie oder Persistenz. Kurzüberfahrten erfolgen in v0.1 ohne Flotten. Die Hauptstadt-Markierungen sind Sonderziele, keine umfassenden städtischen Simulationsmodelle. Neutralgebiete, Territorialkämpfe und kompakte KI-Angriffsziele sind bewusst vereinfachte Regeln.

## Upgrade von v0.1 auf v0.2 (bestehenden Git-Ordner beibehalten)

Das separate `atlas-dominion-v0.2-update.zip` enthält nur Quellcode, Doku und Tests; **keine `.git`-Daten, kein `package.json` und keine lokalen Port-Einstellungen**. Lade das Archiv in `~/Downloads`, dann:

```bash
cd ~/Projects/atlas-dominion
unzip -o ~/Downloads/atlas-dominion-v0.2-update.zip -d ~/Projects
npm test
PORT=8095 npm run dev
```

Wenn du auf GitHub veröffentlichen möchtest: `git add README.md docs index.html src tests && git commit -m "feat: v0.2 direct border attacks and troop badges" && git push`, sofern `origin` bereits existiert. Andernfalls zunächst `gh repo create atlas-dominion --private --source . --remote origin --push` ausführen.

## Entwicklung

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

Mit `?debug` in der URL wird ein kleines lokales QA-Interface `window.__atlas` aktiviert. Produktionsmodus ohne `?debug` bietet es nicht an.

## Roadmap

- **0.2** PixiJS-Renderer, GPU-Profiling, Fronteffekte, Soundscape, dynamischer Nebel.
- **0.3** Eigenständige Armeeverbände, Ressourcen, Städte, Forschung, Diplomatie.
- **0.4** Serverautorisiertes Multiplayer via WebSocket, Lobbys, Reconnect und Replays.

## Kartendaten / Rechtliches

Europa-Kartendaten basieren auf **Natural Earth** (public domain, [naturalearthdata.com](https://www.naturalearthdata.com/)). Die Geometrie wurde für die Darstellung geklippt und vereinfacht. Keine OpenFront-Assets, kein OpenFront-Code und keine OpenFront-Abhängigkeit wurden übernommen.

Für das eigene Spiel ist noch keine Open-Source-Lizenz festgelegt; das Repository kann daher zunächst privat angelegt werden.

## GitHub: neues privates Repository anlegen

Im entpackten Projektordner mit installiertem GitHub CLI (`gh auth login` falls erforderlich):

```bash
gh repo create atlas-dominion --private --source . --remote origin --push
```

Im Archiv liegt bereits ein initialer Git-Commit auf `main`. Nach dem Import ist GitHub Actions CI aktiv.
