# Sichere Veröffentlichung von Atlas Dominion Reborn

**Vorbereitet, nicht ausgeführt.** Lokaler Branch: `feat/atlas-dominion-reborn`; `package.json` und Lockdatei: 1.8.0. Am 24.10.2026 lieferten lokale Tags, `git ls-remote --tags origin` und die GitHub-Releases-API keine Tags/Releases. Daher ist kein bestehendes Versionsschema belegt. Vorgeschlagen: **v1.9.0**, weil neue Funktionen bei erhaltenem Spielstandformat hinzukommen.

Die folgenden Befehle sind für den Eigentümer nach der Prüfung bestimmt. Der Agent hat weder gestaged noch committet, getaggt, gepusht oder veröffentlicht. Kein Stash, Reset, Force-Push oder automatischer Merge ist nötig.

## Vor dem Commit

Die Stimmen A/B/C wurden unter [audio-review](../audio-review/2026-10-24/index.html) anhand der Vergleichsproben vom Eigentümer freigegeben. Alle 47 Clips sind aktiviert; Herkunft, Tests und Release-Unterlagen wurden angepasst und die Radio-Prüfungen gezielt erneut bestanden. Modell-/Assetrechte stehen in [THIRD_PARTY_NOTICES](../../THIRD_PARTY_NOTICES.md).

Nach inhaltlicher Freigabe Version setzen und die zur Veröffentlichung vorgesehenen Dateien prüfen:

```sh
git status --short
git diff --stat
git diff --check
npm version 1.9.0 --no-git-tag-version --ignore-scripts
git diff -- package.json package-lock.json
```

Die [Dateiliste](review-files-2026-10-24.txt) enthält den geänderten und neuen nichtignorierten Arbeitsumfang dieses Durchgangs, einschließlich der vorgefundenen Features und Belegbilder. Sie dient zur Einzelprüfung, nicht zur Annahme, jede Datei sei automatisch freigegeben. Ergänzungen seit diesem Bericht und die beiden Versionsdateien mitprüfen. Nur nach Prüfung diese konkrete Liste stagen:

```sh
git add --pathspec-from-file=docs/releases/review-files-2026-10-24.txt
git add -- package.json package-lock.json
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
```

Vor dem Commit den tatsächlichen Staging-Inhalt ansehen (`git diff --cached`, bei Binärdateien Asset-/Hörvergleich). `.env`, Schlüssel, `backups/audio/`, Modellgewichte, `dist/`, `node_modules/` und `tests/browser/artifacts/` gehören nicht in den Commit. Falls nicht alle aufgelisteten Änderungen übernommen werden sollen, einzelne Pfade statt der gesamten Liste stagen. Vorhandene fremde Staging-Inhalte ebenfalls separat prüfen.

## Featurebranch und Pull Request

Erst nach positiver Prüfung des vollständigen Staging-Inhalts:

```sh
git commit -m 'feat: prepare Atlas Dominion Reborn 1.9.0'
git push -u origin feat/atlas-dominion-reborn
gh pr create --base main --head feat/atlas-dominion-reborn \
  --title 'Atlas Dominion Reborn 1.9.0' \
  --body-file docs/releases/v1.9.0-de.md
```

Die Release Notes beschreiben bereits die aktivierte und freigegebene Sprachbank. Wenn schon ein PR existiert, diesen aktualisieren, keinen zweiten erzeugen. Auf GitHub beide CI-Jobs und den tatsächlichen Diff prüfen. Main wird erst nach bewusster PR-Abnahme über GitHub gemergt; der lokale Featurebranch wird nicht blind über einen möglicherweise älteren Mainstand geschrieben.

## Tag und GitHub-Entwurf

Nach dem geprüften Merge dessen SHA über die PR-URL ermitteln. Die Shellvariable `atlas_release_commit` muss genau diesen geprüften Merge-/Squashcommit enthalten; nicht ungeprüft das aktuelle Feature-HEAD oder einen alten Mainstand taggen.

```sh
git fetch origin main --tags
# PR-Nummer einsetzen; dieser Leseaufruf liefert den tatsächlichen Mergecommit:
# gh pr view 123 --json state,mergeCommit,url
# Die ausgegebene SHA nach dem folgenden Kommentar einsetzen:
# atlas_release_commit='GEPRUEFTE_MERGECOMMIT_SHA'
: "${atlas_release_commit:?Zuerst die geprüfte Merge-SHA setzen}"
git show --stat "$atlas_release_commit"
git merge-base --is-ancestor "$atlas_release_commit" origin/main
git show "${atlas_release_commit}:package.json"
git tag --list v1.9.0
git ls-remote --tags origin refs/tags/v1.9.0
```

Nur fortfahren, wenn die Variable gesetzt ist, der Commit zum abgenommenen PR gehört, in `origin/main` enthalten ist, seine Paketversion 1.9.0 lautet und der Tag lokal sowie remote noch nicht existiert. Die Prüfungen einzeln auswerten; bei Fehlern stoppen. Bereits vorhandene Tags nicht verschieben.

```sh
git tag -a v1.9.0 "$atlas_release_commit" -m 'Atlas Dominion Reborn 1.9.0'
git push origin refs/tags/v1.9.0
gh release create v1.9.0 --verify-tag --draft \
  --title 'Atlas Dominion Reborn 1.9.0' \
  --notes-file docs/releases/v1.9.0-de.md
```

Der letzte Befehl erstellt bewusst einen prüfbaren GitHub-Entwurf. Erst nach Kontrolle von Tag, Versionsnummer, Audioaussage und Release Notes im GitHub-Dialog veröffentlichen. GitHub stellt dann den getaggten Quellstand bereit. Kein pauschales `git push --tags`, kein Force-Push.

## Optionales Browserpaket

Ein Build-Archiv ist nicht zum Quellcommit hinzuzufügen. Auf einem sauberen Checkout des freigegebenen Tags erstellen:

```sh
npm ci
npm run build
cp THIRD_PARTY_NOTICES.md dist/THIRD_PARTY_NOTICES.md
mkdir -p release-artifacts
ditto -c -k --keepParent dist release-artifacts/atlas-dominion-v1.9.0.zip
shasum -a 256 release-artifacts/atlas-dominion-v1.9.0.zip
```

`ditto` gilt für den lokalen Mac. Das Archiv enthält das statische Spiel und die bestehende Three.js-Lizenz; Gewichte, Autoren-/Hörvergleichsdateien, Backups und Abhängigkeiten bleiben draußen. Ein solcher Build wird über einen lokalen oder gehosteten HTTP-Server gestartet, nicht durch direktes Öffnen der Spiel-HTML. Nur das kontrollierte Archiv gegebenenfalls manuell an den GitHub-Entwurf anhängen. Diese Anleitung hat noch kein Archiv oder Release erzeugt.
