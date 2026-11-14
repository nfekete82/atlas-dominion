# Sandforge · Ein gemeinsamer Entwicklungsstand

Stand: 14. November 2026.

## Verbindliche Branches

- `develop` ist der **einzige** fortlaufende, gemeinsam getestete Entwicklungsstand.
- `main` ist die stabile Veröffentlichungsbasis. Ohne Release-Abnahme wird dort nichts direkt geändert.
- Feature-Branches und Pull Requests sind **temporäre Änderungen**, keine eigenständigen Spielversionen. Nach Integration in `develop` werden die überholten PRs geschlossen und alte Branches nach Prüfung archiviert.
- `backup/develop-before-unified-20261114` bewahrt den Stand unmittelbar vor der ersten Zusammenführung der 2026-11-14-MK2-/GLB-Arbeiten auf.

## Lokales Arbeiten

```bash
cd ~/Projects/sandforge-bastion-wars
git fetch origin
git switch develop
git pull --ff-only origin develop
npm ci
PORT=8107 npm run dev
```

Die aktuelle WebGL-Anwendung läuft anschließend unter http://127.0.0.1:8107/.

## Modelle / persönliche Installationen

Die MK2-Feldkommando-GLB ist ein optionales lokales, nicht im Repository
enthaltenes Premium-/User-Asset. Nach dem Klonen lässt sie sich über
`npm run assets:feldkommando-mk2 -- "$HOME/Downloads/Sandforge_Feldkommando_MK2.glb"`
installieren. Ist die Datei nicht vorhanden, läuft Sandforge mit der
beibehaltenen, getesteten Fallback-Grafik weiter. Die Bauvorschau verwendet
denselben Modellpfad wie das fertige Gebäude.

## Prüf- und Integrationsreihenfolge

1. Node/TypeScript-Build und Simulationstests, insbesondere Kasernenproduktion,
   Spielstand laden und Feldkommando-MK2-Fallback.
2. Browser-/HUD-Tests mit der tatsächlichen Spieloberfläche und dem Startmenü.
3. GLB-PBR-Fidelity-Tests inklusive KTX2, Meshopt und A/B-Viewer.
4. Erst danach: getesteten Feature-PR **per Squash-Merge** in `develop` übernehmen.
5. `main` nur für eine gesondert geprüfte Release-Version aktualisieren.

Ältere Draft-PRs bleiben zur Rückverfolgung lesbar, aber bilden keinen
zusätzlichen aktiven Spielstand. Ein bereits integrierter PR wird geschlossen,
nicht erneut gemergt.
