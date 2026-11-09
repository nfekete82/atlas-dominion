<div align="center">

<img src="https://raw.githubusercontent.com/nfekete82/sandforge/chore/sandforge-project-identity-20261109/src/assets/reborn/sandforge-logo-transparent.webp" alt="Sandforge: Bastion Wars" width="520">

# SANDFORGE: BASTION WARS

**Taktisches Echtzeit-Strategiespiel in einer dynamischen 3D-Wüstenwelt.**

*Basenbau · Bastionen erobern · Forschung · Fahrzeuge · Luftunterstützung · strategische Raketen*

</div>

## Projektstatus

**Sandforge: Bastion Wars** ist der neue Projekt- und Spielname des früheren *Atlas Dominion*. Die aktuelle Entwicklung nutzt **Three.js/WebGL** für die 3D-Kampagnen. Das Repository wurde bereits in **`nfekete82/sandforge`** umbenannt.

> **Wichtig:** Der hier angezeigte `main`-Branch enthält noch einen **älteren Canvas-Entwicklungsstand**. Die aktuelle 3D-Version samt neuem HUD, Pioniersteuerung, Forschung, Gebäuden und Audio liegt in separaten Entwicklungsbranches. Die 3D-Änderungen sind noch nicht in `main` integriert und nicht produktiv freigegeben.

| Bereich | Aktueller Entwicklungszweig |
| --- | --- |
| WebGL-3D, Basenbau, KI und Kampagnen | [3D-Entwicklungsstand](https://github.com/nfekete82/sandforge/tree/chore/sandforge-project-identity-20261109) |
| Pionier, durchgehendes HUD, Tarngebäude, Audio | [PR #265](https://github.com/nfekete82/sandforge/pull/265) |
| Projektname, Dokumentation, Tests und Kompatibilität | [PR #266](https://github.com/nfekete82/sandforge/pull/266) |
| Älterer Canvas-Stand | `main` (dieser Branch) |

## Das Spiel

Im aktuellen 3D-Entwicklungsstand baust du mit Pionieren ein Hauptquartier und weitere Produktionsgebäude, rekrutierst Infanterie, Panzer und Luftfahrzeuge und sicherst strategische Bastionen. Die gegnerische KI expandiert, verteidigt Schlüsselpositionen und organisiert Gegenangriffe.

- **3D-Wüstenkarten:** prozedurale Dünen, Felswüsten, Oasen und zerstörte Gebäude; konfigurierbare Bastionenzahl und Karten-Seed.
- **Basenbau und Produktion:** HQ, Kaserne, Fabrik, Flugfeld, Geschütztürme und weitere Anlagen; echte Bau- und Produktionszeiten.
- **Forschung:** neun Technologien mit individuellen Vorteilen und Fortschrittsanzeigen.
- **Strategische Waffen:** Langstrecken-Raketensilo mit Ladezeit und Zielauswahl; Raketenabwehr ist derzeit bewusst deaktiviert.
- **Taktik und Steuerung:** Auswahl mehrerer Einheiten, Formationen, Rechtsklick-Befehle, Fog of War und Bildschirmbreiten-HUD.
- **Lokaler Spielbetrieb:** KI, Spielstände, Audio und Three.js-Rendering ohne permanenten Cloud-Dienst.

Diese Features beziehen sich auf den **3D-Entwicklungsbranch**, nicht auf den historischen `main`-Snapshot.

## Aktuelle 3D-Version lokal starten

```bash
git clone --branch chore/sandforge-project-identity-20261109 \
  https://github.com/nfekete82/sandforge.git

cd sandforge
npm ci
PORT=8106 npm run dev
```

Danach im Browser **http://127.0.0.1:8106/** öffnen. Die alte Canvas-Version ist im 3D-Build unter `/classic.html` erreichbar.

Für eine bereits bestehende lokale Installation bitte **kein zweites Projekt über den vorhandenen Ordner kopieren**. Der Live-Container auf Port `8095` und vorhandene Spielstände sollen unverändert bleiben. Isolierte Vorschau:

```bash
docker compose -p sandforge-rc2-preview \
  -f compose.rc2-preview.yaml up --build -d
# http://127.0.0.1:8106/
```

## Entwicklung und Tests

```bash
npm ci
npm ci --prefix tests/browser
npm run build
node --test tests/sandforge-project-identity-20261109.test.mjs
SANDFORGE_BROWSER_CHANNEL=chromium npm run test:webgl-integration
```

Die **17 gezielten Projekt-/Pionier-/Audiotests** liefen am 09.11.2026 lokal erfolgreich. Beim ersten umfassenderen Lauf war eine alte visuelle Größen-Assertion nicht mehr aktuell; sie wurde auf dem Entwicklungsbranch korrigiert. Der erneute vollständige Browserlauf steht noch aus. Ein grüner Build allein ist keine Produktionsfreigabe.

**Stack:** TypeScript, JavaScript, Three.js/WebGL, Node.js, CSS, HTML, Playwright, Docker.

## Dokumentation

- [Aktuelle Entwicklungsdokumentation und Spielregeln](https://github.com/nfekete82/sandforge/blob/chore/sandforge-project-identity-20261109/README.md)
- [Sichere Projektumbenennung und Migration](https://github.com/nfekete82/sandforge/blob/chore/sandforge-project-identity-20261109/docs/SANDFORGE-RENAME.md)
- [WebGL-RC2-Prüfplan](https://github.com/nfekete82/sandforge/blob/chore/sandforge-project-identity-20261109/docs/releases/webgl-rc2-20261106.md)

**Kompatibilität:** Bestehende IndexedDB-Spielstände, interne Savegame-Kennungen und historische Asset-Pfade werden nicht allein wegen der Umbenennung verändert. Der frühere Projektname bleibt bei älteren Dateien, Git-Commits und archivierten Dokumenten nachvollziehbar.

---

<sub>Sandforge: Bastion Wars · Entwicklungsstand vom 09. November 2026 · Keine automatische Veröffentlichung oder Änderung des produktiven Docker-Containers.</sub>
