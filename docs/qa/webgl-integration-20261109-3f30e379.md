# Sandforge: Bastion Wars – WebGL-Integrationsabnahme

**Datum:** 09.11.2026 (lokaler Mac-Test, vom Projekteigentümer ausgeführt)  
**Repository:** `nfekete82/sandforge`  
**Getesteter Commit:** `3f30e379cdf864a53fde96fce97a7d4790fdc7d6`  
**Entwicklungsbranch:** `chore/sandforge-project-identity-20261109`  
**Geltungsbereich:** aktueller WebGL-3D-Stand, gestapelt auf den Entwicklungs-PRs bis #265

## Verifiziert

| Schritt | Ergebnis |
| --- | --- |
| `npm run build` (TypeScript + WebGL-Bundle) | **PASS** |
| Node-WebGL-Integrationssuite | **17 / 17 PASS**, 0 fehlgeschlagen |
| Playwright Chromium, 2 Worker, vollständiger Lauf | **72 / 72 PASS**, 0 fehlgeschlagen |
| Integrierter Lauf | ungefähr 1,4 Minuten Browserphase |

Die erfolgreiche Browserphase wurde am 09.11.2026 im Terminal nach `SANDFORGE_TEST_MAX_FAILURES=0 SANDFORGE_BROWSER_CHANNEL=chromium npm run test:webgl-integration` protokolliert. Der vorherige vollständige Lauf hatte 68/72 bestanden; die vier verbleibenden Punkte waren drei veraltete Erwartungen zur zusammengefassten Produktionsanzeige und eine veraltete Aufhellungs-Erwartung des provisorischen Gebäude-Platzhalters. Die neue Produzenten-Anzeige beseitigt zudem ein doppeltes Trennzeichen.

### Abgedeckte Bereiche (Auswahl)

- Spielstart, HQ-Bau, Speicher- und Wiederladezustände, Pionier-Folgeaufträge, Gebäudefortschritt, R-Orientierung.
- Einheitenauswahl, Rechtsklick-Befehle, Bastionen, Sammelpunkte, Kollision, Formation und Bewegungseffekte.
- Vollbreites HUD, Produktions- und Forschungsanzeigen, Gebäude-Kacheln und freigeschaltete Einheiten.
- Kamera, Wüstenkarte mit schwarzem Außenbereich, Fog of War, Minimap und Vorschau-Modus.
- 3D-Modelle und Materialien, PBR-Gebäudeaufhellung, Gesundheitsanzeigen, Waffen-/Turmrotation.
- Audiosteuerung, Freigabe nach Nutzerinteraktion, Pausenoberfläche und Bedienung.

## Nicht durch diesen Lauf nachgewiesen

- Das gesamte `npm test`-Portfolio, die vollständige separate klassische Canvas-Browsersuite und alle KI-/Performance-/Langzeitbelastungstests.
- Produktive Uberspace-Bereitstellung, echte Laufzeit und Performance auf weiteren Endgeräten sowie manuelle visuelle/akustische Spielabnahme.
- GitHub-CI: für den getesteten Branch-Commit ist in der verbundenen GitHub-Abfrage kein Workflow-Lauf gefunden worden.

Der Test bestätigt **den obigen Quellcode-Commit**, nicht automatisch spätere Quellcodeänderungen oder den derzeitigen `main`-Branch.

## Git-Integration und Freigabegrenzen

`main` enthält noch einen älteren Canvas-Stand. Die WebGL-Entwicklung liegt auf einer **langen gestapelten Kette offener Draft-PRs**; #266 baut auf #265 auf, #265 auf #264 und #264 auf #263. Der Vergleich des getesteten Zweiges mit `main` zeigt derzeit eine starke Divergenz mit sehr vielen älteren Commits. Deshalb wird allein aufgrund dieses erfolgreichen Integrationstests **kein automatischer Merge in `main` und kein Live-Deployment** ausgelöst.

Vor der produktiven Integration: gesamten Stack konsolidieren, `npm test`, klassisches Browser-Regressionsset und relevante KI-/Performance-Tests in isoliertem Worktree prüfen; anschließend kontrollierte Deployment-/Rollback-Prüfung durchführen.

## Wiederholen

```sh
npm ci
npm ci --prefix tests/browser
SANDFORGE_TEST_MAX_FAILURES=0 SANDFORGE_BROWSER_CHANNEL=chromium npm run test:webgl-integration

# Weitergehende Integrationsfreigabe
npm test
npm run test:browser:classic
```

Der bestehende produktive Container auf Loopback-Port `8095`, Uberspace und Spielstanddaten bleiben von dieser Dokumentation unberührt.
