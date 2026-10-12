# Stadtmarker: Implementierung und QA am 12. Oktober 2026

## Ergebnis

- Hintergrundfreie, als Canvas-Vektorpfad gezeichnete Skyline: 30 × 30 CSS-Pixel inklusive Kontur und Badge, unabhängig von Auflösung und Kartenzoom.
- Bronze für Level 0–2, Silber für 3–4, Gold für 5. Level 0 ohne Badge; Level 1–5 mit 13-Pixel-Badge und 10-Pixel-Schrift.
- Rechteckige Kollisionsprüfung mit räumlichem Hash und 3 Pixel Abstand. Eigene Städte und die Stadt unter dem Mauszeiger haben Vorrang vor anderen Städten.
- Frontpartikel, tatsächliche Kampf- und Armeezähler, Länderbeschriftungen, Hauptstadtnamen, Überschrift, Zoomregler und untere Bedienleiste erhalten reservierte Flächen. Länderbeschriftungen nutzen gemessene Textbreiten und weichen Städten nach Möglichkeit aus.
- Gemeinsame sichtbare Grenzen für Rendering und Hit-Test: Rechtsklick und Hover funktionieren auch auf dem Badge außerhalb der darunterliegenden kleinen Kartenkachel.
- Canvas verwendet die tatsächliche Gerätepixeldichte, auch DPR 3; DPR-Wechsel werden erkannt. Fensteränderungen erhalten Kartenzoom und den Weltpunkt in der Bildschirmmitte.
- Tooltip wird anhand seiner tatsächlichen Größe im Kartenausschnitt positioniert und hält Abstand zum angesteuerten Stadtsymbol.
- Savegame-Version 1 bleibt unverändert. Städtebau, Upgrade-Kosten, KI-Planung und Kampfformeln wurden bei dieser Überarbeitung nicht verändert.

## Tatsächlich ausgeführte Prüfungen

`npm test`: **140 Tests bestanden**, 0 Fehler, 0 übersprungen. Enthält Wirtschaft, sämtliche sechs Stadtlevel, bezahlte Upgrades, Besitzprüfung, Maximalstufe, KI-Stadtabstände, langfristige Simulation, Frontkämpfe, Kartenabdeckung, HTTP-Auslieferung und deterministisches Speichern/Laden.

`npm run test:browser`: **33 Browserfälle**, bestehend aus 24 visuellen Matrixfällen und 9 zusätzlichen Funktions-/Renderingprüfungen. Screenshots wurden mit Playwright im echten lokalen Headless-Chrome aufgenommen und anschließend vom Entwicklungsagenten mit dem Bildbetrachter geöffnet und beurteilt. Die Übersichtsbögen enthalten alle 24 Matrixaufnahmen; gesonderte Ausschnittbögen zeigen die sechs Stadtstufen aus jeder Aufnahme.

| Viewport (CSS-Pixel) | Kartenzoom | DPR | Aufnahmen |
| --- | --- | --- | --- |
| 1440 × 900 | 100 %, 150 %, 200 %, 400 % (Maximum) | 1 und 2 | 8 |
| 1920 × 1080 | 100 %, 150 %, 200 %, 400 % (Maximum) | 1 und 2 | 8 |
| 2560 × 1440 | 100 %, 150 %, 200 %, 400 % (Maximum) | 1 und 2 | 8 |
| 768 × 1024 | 180 % Startfokus | 3 | 1 Zusatzaufnahme |

Zusätzliche Browserprüfungen:

1. Rechtsklick baut eine Stadt. Fünf echte UI-Upgrades verändern sofort die Marker-Pixel, ohne Simulationstick. Der sechste Ausbau ist gesperrt. Ein anschließender Browser-Reload erhält den vollständigen Savegame-Inhalt.
2. Nativer `contextmenu`-MouseEvent ohne Pointer-Geste und sekundärer `pointerup`-Fallback öffnen jeweils das Baumenü. Der normale Maus-Rechtsklick wird separat über Playwrights echte Maussteuerung geprüft.
3. Hover auf dem Gold-Badge zeigt Stufe 5/5. Tooltip bleibt innerhalb der Karte und außerhalb des angesteuerten Markers.
4. Fensterwechsel 1440 → 1920 erhält Zoom und Kameramittelpunkt. Mausradzoom und Ziehen verändern die Kamera korrekt.
5. DPR 3 rendert den Canvas mit nativer Pixelzahl; Städte bleiben bei Tablet-Abmessungen sichtbar.
6. Dicht benachbarte Städte überlappen nicht.
7. Echter Linksklick startet einen anhaltenden Spielerangriff. Reale Kampfereignisse, laufende Armee und sichtbarer Frontkontakt sind vorhanden; Städte schneiden keine Frontpartikel. Zwei um 120 ms versetzte Screenshots zeigen die Animation und die blauen/roten Zähler.
8. 1.500 synthetisch platzierte Städte prüfen Begrenzung und Laufzeit des Renderings.
9. Tatsächlich gerasterte Pixel aller sechs Stufen bleiben bei DPR 1, 2 und 3 innerhalb der 30-Pixel-Fläche. Level 0 zeichnet keine Zahl; 1–5 zeichnen genau ihr Level.

Die Kartenbilder verwenden bewusst kontrolliertes, vergrößertes Spielergebiet und Städte der Level 0–5. Sie belegen die Darstellung, nicht eine natürlich entstandene KI-Partie. Die natürliche KI-Verteilung wird separat durch die bestehende Simulation mit 850 Ticks geprüft; deren Mindestabstand beträgt zehn Sektoren. Während der Matrixaufnahmen ist die Simulation pausiert, damit Animationen den Vergleich nicht verfälschen.

## Visuelle Beurteilung und Iteration

Die Vorher-Bilder stammen aus dem unveränderten lokalen Docker-Build vom Ausgangscommit `7ba3fff`. Dort waren Gebäude etwa 17 Pixel klein und bei 100 % Kartenzoom ausgeblendet.

Nach der ersten Vergrößerung zeigte die Bildprüfung, dass die großzügig reservierte Länderbeschriftung Silber- und Goldstädte unnötig versteckte. Gemessene Textbreiten und Ausweichpositionen beheben dies. Die finalen Ausschnittbögen zeigen alle sechs Stufen in allen 24 Kombinationen. Bronze bleibt durch die dunkle Kontur auch auf goldfarbenem Spielergebiet erkennbar. Die Retina-Aufnahmen zeigen klare Fensterausschnitte und Badge-Zahlen. DPR-1-Ausschnitte werden im Prüfblatt zweifach vergrößert und zeigen die erwartete geringere physische Auflösung.

Der echte Kampf wurde zusätzlich geöffnet und anhand zweier aufeinanderfolgender Bilder geprüft: bewegte blaue/rote Frontpartikel und beide Zahlenanzeigen bleiben sichtbar. Eine Stadt unmittelbar am Gefecht wird währenddessen zugunsten der Front zurückgenommen. Tooltip- und Tablet-Aufnahmen wurden ebenfalls geöffnet und visuell geprüft.

## Screenshots

| Situation | Vorher | Nachher |
| --- | --- | --- |
| 1440 × 900, 100 %, DPR 2 | [Vorher](before-1440-100-dpr2.jpg) | [Nachher](after-1440-100-dpr2.jpg) |
| 1440 × 900, 200 %, DPR 2 | [Vorher](before-1440-200-dpr2.jpg) | [Nachher](after-1440-200-dpr2.jpg) |

- [Alle Karten, DPR 1](audit-maps-dpr1.jpg), [alle Karten, DPR 2](audit-maps-dpr2.jpg).
- [Alle Marker, DPR 1](audit-markers-dpr1.jpg), [alle Marker, DPR 2](audit-markers-dpr2.jpg). Markerausschnitte werden zweifach in CSS-Maßen gezeigt.
- [Kampffront](battle.jpg), [120 ms später](battle-next-frame.jpg).
- [Tooltip](tooltip.jpg), [Tablet mit DPR 3](tablet-dpr3.jpg).

Die einzelnen vollständigen Matrixaufnahmen mit Layout-Metadaten liegen lokal unter `tests/browser/artifacts/screenshots/`. Der HTML-Bericht liegt unter `tests/browser/artifacts/report/index.html`. CI archiviert Screenshots, Traces und Berichte 14 Tage lang. `node tests/browser/visual-audit.mjs` erzeugt die Prüfblätter erneut aus den zuletzt aufgenommenen Matrixbildern.

## Performance

Gemessen in lokalem Headless-Chrome bei 1920 × 1080, DPR 1, Kartenzoom 200 %, pausierter Simulation und 1.500 synthetischen Städten: 49 sichtbare Marker nach Culling/Kollision, mediane Bildzeit ungefähr 16,7 ms und 95. Perzentil ungefähr 16,8 ms. Der separat gemessene Marker-Durchlauf benötigt median etwa 0,2 ms, im 95. Perzentil etwa 0,4 ms. Hardware- und Browserabhängigkeit gelten; dies ist kein FPS-Versprechen für andere Geräte oder eine gleichzeitige umfangreiche Kampfsimulation.

## Geänderte Dateien

- `src/render/building-markers.ts`: Skyline, Größen, Badge und räumliche Kollisionsprüfung.
- `src/render/map.ts`: Bildschirmkoordinaten, Renderingreihenfolge, reservierte UI-Flächen, Beschriftungsplatzierung, Trefferflächen, DPR und Kameraerhalt.
- `src/main.ts`, `src/style.css`: Tooltipposition und bestehender optionaler Debugzugang für reproduzierbare Browserprüfungen.
- `tests/building-markers.test.mjs`, `tests/savegame.test.mjs`: Geometrie-, Kollisions-, Tier- und Savegame-Regressionsprüfungen.
- `tests/browser/cities.spec.mjs`, `playwright.config.mjs`, `package.json`, `package-lock.json`, `.gitignore`, `visual-audit.mjs`: eigenständig installierbare Browserprüfungen und Bildübersichten.
- `package.json`, `.github/workflows/ci.yml`: Browser-Testbefehl und zusätzlicher Chromium-CI-Job.
- `.dockerignore`: Testartefakte und lokale Abhängigkeiten aus dem Docker-Buildkontext ausgeschlossen.
- `README.md` und dieses QA-Verzeichnis: Bedienung, Prüfnachweise und Bilder.

Die bereits vor Arbeitsbeginn vorhandene unversionierte `package-lock.json` im Projektstamm wurde bytegenau erhalten und nicht in den Commit aufgenommen.

## Grenzen

Eng stehende Städte werden gezielt ausgedünnt, statt sich zu überdecken. Bei maximalem Zoom können unmittelbar benachbarte Spielerbauten weiterhin nicht alle gleichzeitig dargestellt werden. Ihre echten Standorte und Savegames bleiben erhalten; die Kacheln bleiben über das Baumenü erreichbar. Fronten und andere priorisierte UI-Flächen können nahe Städte vorübergehend ausblenden.

DPR 2 und 3 wurden im Browser emuliert und anhand nativer Canvas-Pixelmaße sowie Rasterbilder geprüft. Eine physische Sichtprüfung an einem separaten Retina-Gerät sowie Safari- und Firefox-Tests wurden nicht durchgeführt. Außerhalb dieser Grenzen sind keine offenen Fehler aus dem geprüften Auftrag bekannt.
