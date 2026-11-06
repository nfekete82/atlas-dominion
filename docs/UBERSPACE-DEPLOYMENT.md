# Sandforge auf Uberspace 8

Dieses Deployment ist ausschließlich für **nf@janus.uberspace.de**, **https://nf.uber.space/** und `/var/www/virtual/nf/html` konfiguriert. Andere Uberspace-Accounts und die globale SSH-Konfiguration werden nicht verwendet oder verändert.

## Veröffentlichen aus VS Code oder Codex

Im Projektterminal:

```sh
npm run deploy:uberspace:dry-run
npm run deploy:uberspace
npm run deploy:uberspace:check
```

Vor dem echten Deployment müssen die gewünschten Änderungen committed sein. Der Commit wird im geschützten Versionsmanifest festgehalten. Ein Dry-Run ist auch mit uncommitteten Änderungen möglich; er baut und testet lokal, verändert aber keine Serverdateien oder Zugangsdaten. Er vergleicht den aktiven Stand sowie die Datei-/Zeitstempelübersicht vor und nach `rsync --dry-run`.

VS Code: **Terminal → Run Task** und `Sandforge: Uberspace deploy`, `dry-run`, `check` oder `rollback`. Es gibt keinen Hintergrund-Sync und keinen automatischen Upload beim Speichern. Für Codex reicht künftig: **„Deploye die aktuelle Sandforge-Version auf Uberspace mit npm run deploy:uberspace.“** Bei lokalen Änderungen zunächst einen nachvollziehbaren Commit erstellen lassen.

Lokale Voraussetzungen: Node ≥20 mit npm/TypeScript aus `npm ci`, Python ≥3.9, SSH, rsync und Playwright aus `npm --prefix tests/browser ci`. Der Browserkanal ist standardmäßig das lokal installierte Chrome; alternativ `ATLAS_BROWSER_CHANNEL=chromium` mit installiertem Playwright-Chromium. Auf Uberspace werden keine Node-Pakete, Docker-Container, neuen Ports oder permanenten Hintergrunddienste eingerichtet.

## SSH und bestehender Server

Jeder Zugriff verwendet ausdrücklich:

```sh
ssh -F /dev/null -i ~/.ssh/id_ed25519 \
  -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes \
  nf@janus.uberspace.de
```

Die bereits vertraute Hostkennung in `known_hosts` bleibt Voraussetzung; das Skript akzeptiert keine ungeprüften neuen Hostschlüssel. Der private Key wird ausschließlich von SSH verwendet und niemals eingelesen, kopiert oder hochgeladen.

Bei der ersten Einrichtung waren nur die Uberspace-Standarddatei `html/nocontent.html`, die Domain `nf.uber.space` und das Standardbackend `* / APACHE` vorhanden. Die Standardseite wurde vor Änderungen nach `/var/www/virtual/nf/.sandforge/backups/initial-20261030T102221Z/html` gesichert; Backendkonfiguration und die ursprüngliche Schutzdatei wurden ebenfalls gesichert. Die vorhandene Domainverknüpfung `nf.uber.space → html` wurde beibehalten.

Uberspace 8 muss für `/` **Apache** nutzen: Ein STATIC- oder PORT-Backend würde `.htaccess` umgehen. Deshalb bricht jede Prüfung bei abweichenden Backends, zusätzlichen Nebenrouten oder unerwarteten Domain-/DocumentRoot-Verknüpfungen ab. Sie ändert solche Konfigurationen niemals stillschweigend. Offizielle Grundlagen: [Backends](https://u8manual.uberspace.de/web_backends/), [DocumentRoot und Rechte](https://u8manual.uberspace.de/web_documentroot/), [HTTP-Stack](https://u8manual.uberspace.de/background_http/).

## Authentifizierung

Anmeldename: **nobby**. Das persönlich im Terminal gesetzte Passwort liegt ausschließlich als bcrypt-Hash in `/var/www/virtual/nf/.htpasswd`, außerhalb des DocumentRoots. Der Account-Stamm hat Modus 0750; die Passwortdatei hat Eigentümerzugriff und eine explizite Lese-ACL für die Webservergruppe `www`, keinen Zugriff für sonstige Benutzer. Die aktive Schutzdatei bleibt dauerhaft `/var/www/virtual/nf/html/.htaccess`.

Passwort ändern beziehungsweise weitere Benutzer hinzufügen, ohne vorhandene zu löschen:

```sh
ssh -tt -F /dev/null -i ~/.ssh/id_ed25519 \
  -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes \
  nf@janus.uberspace.de \
  'flock -x /var/www/virtual/nf/.sandforge/auth.lock sh -c "umask 077; htpasswd -B -C 12 /var/www/virtual/nf/.htpasswd freund && chmod 600 /var/www/virtual/nf/.htpasswd && setfacl -m g:www:r /var/www/virtual/nf/.htpasswd"'
```

`freund` durch den gewünschten Benutzernamen ersetzen; für das eigene Passwort `nobby` verwenden. **Kein `-c`**, weil dies die vorhandene Benutzerdatei überschreiben würde. Das Passwort wird verdeckt im interaktiven Terminal abgefragt. Keine Passwörter in Befehlsargumente, Git, `.env`, Chat oder Logdateien schreiben.

Automatische HTTPS-/Browserprüfungen müssen das persönliche Passwort nicht kennen. Sie legen über SSH kurzzeitig einen zufälligen `__sandforge_check_…`-Benutzer mit kryptografisch zufälligem Einmalpasswort an. Dieses Passwort verbleibt ausschließlich im Prozessspeicher; es wird weder als Befehlsargument noch als Datei oder Trace gespeichert. `finally` entfernt den Testbenutzer wieder und erhält alle normalen Benutzer. Änderungen an der Benutzerdatei erfolgen atomar unter einer Sperre. Der reguläre `check` führt solche kurzzeitigen Auth-Prüfungen durch; der **Dry-Run tut dies ausdrücklich nicht**.

HTTP leitet vor der Anmeldung auf HTTPS um. Ohne Anmeldung liefern Spielseite und direkte JS-/CSS-/JSON-/GLB-/Bild-/Audiorouten 401. Versteckte Dateien, interne Symlinkpfade, Entwicklungsseiten und Debug-Queries liefern auch mit Anmeldung keine Inhalte. Verzeichnisauflistung ist deaktiviert. Der Guard und die Passwortdatei sind nie Teil eines Release-Uploads und werden durch Deployments/Rollbacks nicht überschrieben.

## Produktionspaket und Browserbetrieb

Das Spiel benötigt keinen Spielserver, keine API und keine WebSockets. Die vorhandene Simulation, Tactical AI, Karten, Animationen, Geräusche, Kampagnenstatistiken und Spielstände laufen im Browser. Der normale Spielstart erzeugt keine Anfragen an externe Dienste.

`npm run build` bleibt der vorhandene lokale Build. Anschließend erzeugt `scripts/uberspace/package.mjs` ein separates Produktionspaket:

- transitive ES-Modulabhängigkeiten des tatsächlichen Spieleinstiegs einschließlich des optionalen Module-Workers;
- Hauptseite, beide Stylesheets, Marken-Skript und vollständige Sandforge-Bild-, Sprite-, GLB-, JSON- und WAV-Assets;
- Herkunftshinweise und ein Manifest mit Release-ID, Git-Commit, Dateigrößen und SHA-256-Werten;
- keine `node_modules`, Git-Dateien, TS-Quellen, Source-Maps, Typdeklarationen, alten Legacy-Spiele, Modell-/Animations-Entwicklungsseiten oder Secrets;
- im Produktionspaket deaktivierte Debug-Abfragen und kein erreichbares `window.__reborn`.

Die Quelldateien und der gewohnte lokale Debug-/Buildbetrieb werden dafür nicht verändert. Das vollständige Modellpaket ist groß; der Browser lädt im normalen Spiel die daraus gerenderten Atlanten und nicht sämtliche GLB-Master. Inkrementelle Updates verwenden Prüfsummen und `--link-dest`, um unveränderte Assets nicht erneut zu übertragen oder separat auf dem Server abzulegen.

Die experimentelle, explizit aktivierte WebGPU-Qwen-Beratung behält ihre vorhandenen externen Abhängigkeiten: Transformers.js 3.8.1 von jsDelivr und `onnx-community/Qwen3-0.6B-ONNX` von Hugging Face einschließlich benötigter Laufzeit-/WASM-Dateien. Diese Downloads benötigen einen geeigneten WebGPU-Browser und HTTPS; die normale Tactical AI läuft unabhängig davon weiter. Es werden keine lokalen Docker-/localhost-Backends benötigt. Der optionale große Modelldownload wird nicht als Bestandteil jedes Deploymenttests erzwungen. Der eigene Worker und sein MIME-Typ werden geprüft.

Spielstände bleiben in IndexedDB, Einstellungen/Statistikarchive im jeweiligen Browserprofil auf **diesem HTTPS-Origin**. Sie sind weder Online-Spielstände noch an Basic-Auth-Benutzernamen gebunden. Lokale `localhost`-Spielstände werden nicht automatisch auf den anderen Origin übertragen. Versionswechsel und Rollbacks auf derselben Domain erhalten den Browserspeicher.

## Release-Struktur und Update-Sicherheit

```text
/var/www/virtual/nf/
├── .htpasswd                      # bcrypt + gezielte Webserver-Lese-ACL
├── .sandforge/
│   ├── backups/                   # ursprüngliche Dateien/Schutzkonfiguration
│   ├── releases/<release-id>/      # geprüfte, vollständige Produktionsdateien
│   ├── state.json                 # aktueller/vorheriger Stand, begrenzte Historie
│   └── lease.json                 # Sperre gegen parallele Deployments
└── html/
    ├── .htaccess                   # fester Auth-/Routing-/Header-Guard
    ├── .current → ../.sandforge/releases/<release-id>
    └── .releases → ../.sandforge/releases
```

Alle veröffentlichten Dateiziele liegen unter `/var/www/virtual/nf`, nicht unter `/home`; das entspricht den Uberspace-8-Zugriffsregeln. Auf diesem Account wurden Unix-Rechte/ACLs und die tatsächlichen Apache-Zugriffe geprüft; `restorecon`/`chcon` sind hier nicht vorhanden und werden nicht pauschal aufgerufen.

Ablauf von `deploy:uberspace`:

1. Sauberen Git-Stand prüfen, bestehenden Produktions-Build erstellen, kuratierte Spiel-/Save-/Art-/Audio-/Deploy-Tests und sieben Python-Rollback-/Sicherheitsprüfungen ausführen.
2. Produktionspaket auf fehlende Module, Metadatenressourcen, unversionierte Assetpfade, Entwickler-URLs, Dateitypen und vollständige Sprecher-/Modellpakete prüfen. Echter lokaler Browserlauf des Produktionspakets mit Anmeldung, Hauptmenü, Spielstart, HQ-Bedienung, Simulation/KI, Statistiken und IndexedDB.
3. SSH, genaues Ziel, Apache, Dokumentwurzel, unveränderten Guard, bcrypt-Anmeldung und anonymen HTTPS-Schutz prüfen. Erst danach eine zeitlich begrenzte Deploy-Sperre erwerben.
4. Neues, eindeutig verwaltetes Release-Verzeichnis anlegen; `rsync` inkrementell hineinkopieren. **Kein `rsync --delete`** und kein Löschen alter Releases. Aktive Spieldateien bleiben währenddessen unangetastet.
5. Auf dem Server jede Datei anhand ihres Inhalts hashen; Größe, Vollständigkeit, Manifest und unerwünschte Dateien/Symlinks prüfen. Den Schutz und authentifizierten Zugriff auf das Staging-Release prüfen, bevor `/` umgeschaltet wird.
6. `.current` atomar auf das geprüfte Release umschalten. Alle Produktionsdateien per authentifiziertem HTTPS-HEAD prüfen, wichtige tatsächlich geladene Inhalte zusätzlich per GET/Hash bestätigen, anonymen Schutz erneut prüfen und den echten Browserlauf auf der tatsächlichen HTTPS-Domain ausführen.
7. Erst danach den Erfolg und das vorherige Release in `state.json` festhalten. Bei Fehlern nach Aktivierung den vorherigen Zeiger/Zustand wiederherstellen; Dateien und Schutz bleiben erhalten. Auch ein verlorener Aktivierungs-SSH-Response wird durch Prüfung des tatsächlichen Zeigers berücksichtigt. SIGINT/SIGTERM beenden aktive Prüfungen/Uploads und lassen die reguläre Aufräum-/Rollbackbehandlung laufen.

Ein kompletter Verbindungs-/Serverausfall kann eine sofortige Fernwiederherstellung verhindern; das vorherige Release bleibt gespeichert. Der Terminalbefehl meldet dann einen Fehler und keinen verifizierten Erfolg. Eine harte Prozessbeendigung oder ein Netzwerkabbruch kann eine Deploy-Sperre bis zum Ablauf ihrer einstündigen Lease hinterlassen; eine laufende fremde Sperre wird nicht einfach gelöscht.

Caching: HTML und Spielressourcen verwenden `Cache-Control: private, no-store`. Zusätzlich zeigen **alle** Modul-, Worker-, Stylesheet- und Assetpfade auf `/releases/<release-id>/…`. Relative Modulimporte bleiben innerhalb dieses Präfixes. Ein bereits geöffnetes Spiel lädt deshalb auch nach einer Umschaltung ausschließlich Dateien seiner eigenen erhaltenen Version. Ein neu geladenes `/` bekommt die neue Version. Der Origin und der IndexedDB-Speicher bleiben gleich.

## Status und Rollback

```sh
npm run deploy:uberspace:check
npm run deploy:uberspace:rollback
# Gezieltes erhaltenes Release:
npm run deploy:uberspace:rollback -- v-...-...-...
```

Der Statusbefehl prüft die tatsächliche Domain, nicht nur einen erfolgreichen Upload. Die Prüfung umfasst TLS, HTTP→HTTPS, 401 ohne Anmeldung, 200 mit temporärer Anmeldung, Online-Version, Hauptseite und sämtliche im Manifest enthaltenen Produktionsdateien. Er gibt keine Passwörter aus.

Ein Rollback benötigt ein vorheriges erfolgreiches Release; vor dem allerersten Deployment gab es nur die gesicherte Standardseite. Rollbacks prüfen das erhaltene Paket, schalten atomar zurück und testen die HTTPS-Inhalte erneut. Das zuvor aktive Release bleibt dabei für ein mögliches Vorwärtswechseln erhalten. Es gibt keine automatische aggressive Release-Löschung.

## Prüfprotokolle

Die Ausgaben des jeweiligen Laufs und der authentifizierte Spiel-Screenshot liegen lokal im ignorierten Verzeichnis `release-artifacts/uberspace/<release-id>/`. `online-result.json` enthält nur Release-/Commit-/Testinformationen, keine Zugangsdaten. Browsertraces, HAR-Dateien und Videos mit Anmeldeinformationen werden nicht erzeugt. Es werden keine zusätzlichen ausführlichen Server-Zugriffslogs eingeschaltet.

Das erste tatsächlich veröffentlichte, einschließlich Update und Rollback geprüfte Deployment ist im [Live-Prüfprotokoll vom 30.10.2026](qa/uberspace-20261030/RESULTS.md) mit Screenshot und maschinenlesbarem Ergebnis dokumentiert.
