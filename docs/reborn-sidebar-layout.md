# Sidebar neben dem Spielfeld

`#app` verwendet zwei CSS-Grid-Spalten: links `#game-viewport`, rechts `#sidebar`. Der Canvas liegt ausschließlich im linken Bereich. Die rechte Spalte enthält Spielmenü, Radar, Katalog, Produktion, Warteschlange und Infotexte. Sie nimmt echten Layoutplatz ein und besitzt einen eigenen Scrollbereich. Die vorhandenen Farben, transparenten Panel-Flächen, Tabs, Symbole und responsiven Sidebar-Breiten bleiben erhalten.

Die bisherigen Status- und Auswahlfenster gehören zum linken Spielbereich. Ihre Breite wird innerhalb dieses Bereichs berechnet; die Sidebar-Breite wird dort nicht erneut abgezogen. Bei schmalem Spielfeld passt sich die obere Ressourcenanzeige an. Bei geringer Fensterhöhe kann die rechte Spalte intern scrollen; der Katalog behält zusätzlich seinen eigenen Scrollbereich. Die Seite selbst scrollt nicht.

## Rendern und Kamera

`Renderer.resize()` misst das tatsächliche Canvas-Rechteck statt einer Fensterbreite. Ein `ResizeObserver` reagiert auch auf Layoutänderungen ohne Fenster-Resize. Der bestehende Fenster-Resize bleibt für Größen- und Pixeldichteänderungen zuständig. Identische Größen lösen keine erneute Canvas-Allokation aus.

Renderbreite und -höhe sind lokale CSS-Pixel. Der Bitmap-Puffer verwendet die bisherige Pixeldichte bis maximal 2×; seine tatsächliche gerundete Größe bestimmt die Zeichenmatrix. Dadurch stimmen auch gebrochene Grid-Breiten und Retina-Pixel mit der sichtbaren Fläche überein.

Kameragrenzen, World-to-Screen, Screen-to-World, Mauszoom und der Sichtausschnitt auf der Minikarte verwenden diese gemessenen Abmessungen. Die Hauptquartier-Zentrierung benötigt keinen separaten Sidebar-Ausgleich mehr. Die Weltgröße bleibt unverändert. Am maximalen rechten Kamerastand entspricht die rechte Canvas-Kante weiterhin der echten rechten Weltgrenze.

## Eingabe

Mauspositionen werden aus dem tatsächlichen Canvas-Rechteck in lokale Renderkoordinaten umgerechnet. Randscrollen reagiert nur auf Positionen innerhalb des Spielfelds. Die Sidebar ist kein Nachfahre des Canvas und kann keine Kartenklicks oder Mausrad-Zoomereignisse an ihn weiterreichen.

Eine per Pointer-Capture über die Sidebar gezogene Auswahl wird an der sichtbaren Canvas-Kante begrenzt. Ein außerhalb des Canvas beendeter Bau-/Befehlsklick löst keinen Weltauftrag aus. Normale Klicks, Rechtsklicks, Bauplatzierung, Gebäudeauswahl und Sammelpunkte bleiben bis zur rechten sichtbaren Kartenkante benutzbar.

## Dateien und Prüfung

Implementierung: `index.html`, `src/reborn/style.css`, `src/reborn/renderer.ts`, `src/reborn/input.ts`. Browserkonfiguration um `tests/browser/reborn-layout.spec.mjs` erweitert. Im bestehenden HUD-Test wurde die veraltete Erwartung von neun Einheiten auf die vorhandenen zehn Einheiten korrigiert.

```sh
npm run build
npm --prefix tests/browser test -- --grep 'layout:|reborn: minimap drag|reborn: readable translucent HUD|real worker placement|combined arms:|radio: local speech'
```

Die fünf neuen Browserfälle prüfen Desktop-, Tablet- und Handygrößen, Layout-Resize ohne Fensterereignis, gebrochene Breiten, Retina, Auswahl und Rechtsklick am Rand, Ziehauswahl, unterbundene HUD-Durchklicks, Bauen, Gebäudeauswahl, Sammelpunkte, echtes Randscrollen bis zur Weltgrenze, Minikarten-Navigation, Hauptquartier-Zentrierung und Mauszoom. Bestehende Bedien-, HUD-, Bau-, Transport- und Sprachprüfungen laufen im selben fokussierten Durchgang. Die Tests verändern ausschließlich ihre isolierten Testszenen; Grafikassets und Simulationsregeln werden durch den Layout-Fix nicht geändert.

Vorschau: `tests/browser/artifacts/reborn/separate-sidebar-desktop.png` zeigt die getrennte Sidebar mit einer sichtbaren Einheit nahe der rechten Spielfeldkante.

Prüfstand: `npm run build` erfolgreich, **11/11** fokussierte Browserfälle bestanden, `git diff --check` ohne Befund. Vorhandene lokale Änderungen und Stashes wurden erhalten; keine Commits oder Pushes ausgeführt.
