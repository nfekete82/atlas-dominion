# ATLAS DOMINION

**v0.6 — REGIONAL FRONTLINES & SCALABLE ECONOMY** · Ein eigenständiges Echtzeit-Strategiespiel im Browser.

Steuere DOMINION von Berlin aus: Klicke direkt auf angrenzende Fraktionen und steuere den Truppeneinsatz auf einer echten Europakarte, vergrößere dein Gebiet, erobere Hauptstädte und setze dich gegen zehn autonome Fraktionen durch.

## Schnellstart

Benötigt: **Node.js 20+** und TypeScript (durch `npm install` verfügbar).

```bash
npm install
npm run dev
```

Browser öffnen: **http://localhost:8080** (Standardport). Wenn 8080 und 8081 bereits von anderen Projekten belegt sind: `PORT=8095 npm run dev` und **http://localhost:8095** öffnen. Im bereitgestellten Komplett-ZIP liegt `dist/` bereits bei: dort reicht auch `node scripts/serve.mjs` **ohne npm install**. Kein Account, API-Schlüssel oder externer Kartendienst erforderlich. Für Docker: `docker compose up --build -d` und dieselbe Adresse öffnen.

### Frontwellen v0.4

- Übergänge eroberter Gebiete werden über rund 420 ms weich animiert.
- Zusammenhängende Eroberungen starten leicht zeitversetzt an der alten Front; kein Richtungspfeil und keine Marschlinie.
- Farbige Grenzen werden als zusammenhängende Linien mit weichen Abschlüssen gezeichnet; die Simulation bleibt unangetastet.
- Animation wird beim Neustart vollständig zurückgesetzt.

### Verteidigung und KI in v0.5

- **Automatische Verteidigung:** Angegriffene Sektoren werden durch tatsächlich verfügbare Truppen des Verteidigers verstärkt. Diese Soldaten werden vom Reservekontingent abgezogen. All-in-Offensiven haben dadurch ein höheres Risiko.
- **DEFENSE-Doktrin:** Verstärkt die Abwehrwirkung pro eingesetztem Verteidiger. Städte behalten stärkere Grundgarnisonen.
- **Risikobewusste KI:** Bewertet eigene und gegnerische Reserven, Einkommen, Garnisonen, Hauptstädte und eigene gefährdete Grenzen. Greift starke Gegner nur bei klarer Überlegenheit an. Neutralgebiete bieten eine risikoarme Alternative. Kann auch abwarten.
- **Grenzsicherungsanzeige:** Der eigene Status zeigt bedrohte Grenzsektoren und kumulativ zur Verteidigung eingesetzte Truppen.
- **Deterministische Logik:** Verteidigung und Angriffsentscheidung sind Bestandteil derselben Simulation und können reproduziert werden.

### Regionale Grenztruppen und Wachstum in v0.6

- Die feste **9.000er-Truppengrenze** wurde vollständig entfernt, auch bei zurückkehrenden Angriffstruppen.
- Das Rekruteneinkommen steigt mit mehr Sektoren und Städten sowie einem moderaten Größenvorteil: `(2.5 + 0.12 * Sektoren + 3.8 * Städte) * (1 + 1.35 * sqrt(Sektoren / 19804))`. Die Spielerdoktrinen modifizieren diesen Wert weiterhin.
- Mobile Reserve und regionale Grenztruppen sind getrennte Bestände: `troops` sind sofort zum Angriff einsetzbare freie Soldaten; `frontline[index]` sind bereits stationierte Verteidiger an diesem Grenzsektor.
- Nur tatsächlich **bedrohte Grenzsektoren** werden automatisch verstärkt. Nach Rückzug der Bedrohung kehren Überlebende zur Reserve zurück.
- Grenzstärken unterscheiden sich regional. Garnisonen, stationierte Truppen, Hauptstadtstatus und begrenzte Notfallhilfe entscheiden über Abwehrkraft. Die KI bewertet diese lokale Stärke und das Risiko ihres Angriffs.
- Auf der Karte zeigen farbige Frontpunkte starke bzw. schwache Positionen; ab höherer Zoomstufe erscheinen lokale Truppenzahlen. Die Truppenanzeige im Haupt-HUD zeigt mobile + stationierte Einheiten; der Angriffsregler verwendet weiterhin nur mobile Truppen.
- Fronttruppen sind **keine kostenlos generierten Soldaten**. Stationierung zieht die Soldaten von der mobilen Reserve ab; bei Eroberung der Stellung gehen verbleibende Verteidiger verloren.

### Steuerung

- **Klick auf gegnerische oder neutrale Grenzregion**: Sofort eine lokale Offensive starten. Klickst du weiter im Landesinneren, rastet der Angriff auf den nächstgelegenen erreichbaren Grenzabschnitt ein. Keine Richtungspfeile oder Marschlinien von Berlin.
- **Truppenregler 5–100 %**: Bestimmt die Truppenmenge für den nächsten Klick; Presets **10 / 25 / 50 / MAX**; Hotkeys **T / Y** für −5 / +5 Prozentpunkte.
- **Erneuter Klick**: Zusätzliche Truppen entsenden, solange noch Reserven verfügbar sind.
- **Leuchtende Kampffront**: Nur der tatsächlich umkämpfte Grenzabschnitt pulsiert und zeigt die dort eingesetzte Truppenstärke – keine Pfeile. 
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
