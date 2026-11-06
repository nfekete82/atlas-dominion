# Wüsteninfanterie: Export und Prüfung

Beide Fraktionen mit prozeduralen 256px-PBR-Materialien, 246 Bauteilen und 61.088 Dreiecken je Modell. Der Weapon-Socket sitzt an der rechten Hand; beide Griffrahmen steuern die offline gebackene Arm- und Handgelenkausrichtung in allen fünf Clips. Keine zusätzlichen Modelle, Texturdownloads oder Abhängigkeiten.

- [Blau: fünf Clips aus acht Richtungen](team-0.png)
- [Rot: fünf Clips aus acht Richtungen](team-1.png)
- [Griffe und Materialien, Blau](grip-0.png)
- [Griffe und Materialien, Rot](grip-1.png)
- [Messwerte beider exportierter GLBs](audit.json)

Die Mehransichten zeigen jeweils eine repräsentative Phase pro Clip. Die Messung prüft zusätzlich 101 Zeitpunkte pro Clip und Fraktion einschließlich interpolierter Posen: maximale Griffabweichung 0,0000362 m (0,0362 mm), maximale Abweichung zwischen Waffen- und Handgelenkausrichtung 0,000203 rad. Die Browserprüfung kontrolliert außerdem Waffenvertices gegen den Brustpanzerkern, anatomische Ellenbogenwinkel, die erhaltene Todesbewegung, Materialien und Socket-Hierarchie. Die visuellen Ansichten wurden auf Waffen-, Arm- und Handüberschneidungen geprüft.

Reproduktion:

```sh
npm run assets:detailed-infantry
npm test
npm --prefix tests/browser test -- --grep 'model study:|atlas models: approved infantry|infantry: exported'
```

Ergebnis: Build erfolgreich. 433 von 434 Regressionstests unmittelbar bestanden; der HTTP-Test war durch das Socket-Verbot der Sandbox blockiert und bestand separat mit lokaler Serverberechtigung (`node --test tests/http.test.mjs`). Alle vier gezielten Browserprüfungen bestanden: GLB-Galerie, Spritevergleich, tatsächliche Spielregistrierung und vollständige Griffprüfung für beide Fraktionen. Keine offenen Testfehler.

Die sechs Produktionsdateien liegen unter `src/assets/reborn/prototype/infantry-{0,1}.{glb,png,json}`. Die PNGs und JSONs werden vom Spiel direkt verwendet; die 3D-Galerie lädt dieselben GLBs. Der lokale Mündungspunkt und das Metadatenschema bleiben erhalten; die projizierten Schusspositionen folgen der verbesserten Waffe.
