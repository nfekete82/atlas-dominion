# Einheitensystem / Abschluss am 23. Oktober 2026

**Aktuelle Übernahme nach Nutzerfreigabe:** Die detailliertere Legionär-Figur ist als gemeinsame Grundfigur von Infanterie, Pionier und schwerem Schützen im Spiel aktiv. Sie besitzt 192-Pixel-Zellen, Pivot (96,156), Maßstab 0,5 und 296 Frames je Team. Mündungen sind aus der wirklichen 3D-Waffe registriert. Sieben neue eigene Gebäudetypen ersetzen die bisherigen generierten Gebäudebilder; Basis und Bastion verwenden 64 registrierte Schüsselansichten. [Aktueller Umfang, Quellen und Prüfung](../buildings-3d/README.md). Das Inventar enthält 14 unterschiedliche aktive Einheitenatlanten für 18 Rollen-/Teamkombinationen sowie 15 Gebäudemodelle. Die folgenden Abschnitte dokumentieren den vorherigen Stand mit den einfachen CC0-Figuren; diese Figuren sind archiviert.

Die bisherigen generierten Einzelansichten und Laufatlanten waren kein vollständiges Animationsset: Idle, Treffer, Tod und getrennte Fahrzeugteile fehlten. Der aktive Renderer lud zudem gespiegelte Fahrzeugansichten und ergänzte Bewegungen durch Darstellungsänderungen. Diese Pfade sind durch echte, offline gerenderte Spritefolgen ersetzt. Die alten Dateien bleiben als Archiv erhalten.

## Tatsächlich vorhandene Ressourcen

18 PNG-/JSON-Atlanten: neun Einheitentypen in zwei Fraktionen. Jede Zelle hat 96 × 96 Pixel und einen festen Fußpunkt bei (48, 78). Kamerawinkel, Maßstab und Beleuchtung bleiben beim Export konstant. Schatten sind direkt in den transparenten Frames enthalten.

| Typ | Ansichten | Vorhandene Bewegungsdaten |
| --- | --- | --- |
| Infanterie, Pionier, schwerer Schütze | 8 | Idle 4, Walk 8, Attack 5, Hit 4, Death 10 Samples je Richtung; zusammen 248 Frames je Atlas |
| Spähwagen | 16 | Idle und vier tatsächlich gerenderte Radstellungen |
| Panzer, Artillerie | 16 | Vier Kettenphasen vorwärts, links und rechts; unabhängiger Turm und Rohr |
| Spähheli, Kampfheli | 16 | Vier Stellungen der tatsächlich getrennten Quell-Rotorgeometrie, stehende und bewegte Zustände |
| Bomber | 16 | Starre Richtungsansichten; eine Pose pro Zustand, keine erfundenen beweglichen Teile |

Samples sind nicht automatisch unterschiedliche Posen: Alle acht Laufphasen sind pro Richtung verschieden. Stand-, Schuss- und Trefferclips enthalten teilweise Halteposen. Die tatsächlichen unterschiedlichen Pixelphasen stehen je Richtung als `uniquePhases` in den Atlasmetadaten. [ANIMATION_ASSETS.json](ANIMATION_ASSETS.json) inventarisiert sämtliche Projekt-PNGs, Quellmodelle und aktiven Clips samt SHA-256. Inventarisierte ältere Dateien sind keine zusätzlich aktiven Animationen.

## Herkunft und Lizenz

Alle acht zugrunde liegenden Modelle sind vom jeweiligen Anbieter als **CC0** veröffentlicht:

- Quaternius: [Toon Shooter Game Kit](https://quaternius.com/packs/toonshootergamekit.html), drei Figuren mit echten Skelettclips. Verwendet: `Idle`, `Run_Gun`, `Idle_Shoot`, `HitReact`, `Death`.
- Quaternius: [Animated Tanks](https://quaternius.com/packs/animatedtanks.html), zwei Modelle mit echten Kettenclips und getrennten Turm-/Rohrmeshes.
- Quaternius: [Ultimate Space Kit](https://quaternius.com/packs/ultimatespacekit.html), Rover mit getrennten Radmeshes und Bomber.
- kazuma: [Helicopter auf Poly Pizza](https://poly.pizza/m/EQJ2MECUbx), reale Rotorflächen aus einer getrennten Geometrieinsel des Quellmodells.

Quellen, Downloads und Hashes: [manifest.json](../../tools/animation-sources/manifest.json). Originale und mitgelieferter Quaternius-Lizenzhinweis liegen unter `tools/animation-sources/`. Beim Export werden Materialfarben an die Sand-/Fraktionspalette angepasst. Die Bilder sind gerenderte 3D-Animationen für ein Canvas-2D-Spiel, keine generierten Bildfolgen. Three.js 0.180.0 (MIT) ist nur ein Entwicklungswerkzeug und wird nicht ins Spiel geladen.

## Laufzeit

`SpriteAnimator` wählt Zustand, Richtung und Frame aus Metadaten. Treffer unterbrechen Schüsse, Todesfolgen sind terminal, einmalige Treffer-/Schussfolgen laufen vor der Rückkehr zu Idle/Walk aus. Laufphasen verwenden tatsächlich zurückgelegte Strecke statt Bildrate. Die acht Richtungen werden ausgewählt, nicht durch flache Rotation oder Spiegelung hergestellt. Pivot und Maßstab ändern sich nicht je Pose. Die Originalclips enthalten echte Arm-, Bein- und Waffenbewegung.

Fahrzeuge haben begrenzte Rumpfdrehgeschwindigkeit und sanftes Anfahren/Bremsen bei Marschbefehlen. Türme folgen unabhängig dem Ziel; nur das separate Rohr erhält kurzen Rücklauf. Kettenbewegung beim Lenken nutzt die vorhandenen Links-/Rechtsclips. Staub beim Anfahren und Lenken, Mündungsfeuer, Einschläge und Explosionen verwenden einen auf 240 Partikel begrenzten Pool. Die gespeicherte Option „Partikel“ schaltet diese Effekte ab, ohne die Spriteanimationen abzuschalten.

Canvas 2D zeichnet native gerenderte Pixel ohne Bildglättung. Präsentationszustände verändern weder Kampfereignisse noch Befehlsfolgen, Wirtschaft oder Simulationszufall. Speicherstände behalten Version 2; die optionalen Fahrzeugfelder werden geprüft, ältere Stände ohne sie bleiben ladbar. Die Korrektur des Fahrzeug-Wegpunktabstands verhindert, dass langsames Anfahren am engen Basis-Ausgang eine blockierte Ecke schneidet.

## Konkrete Grenzen

- Die CC0-Modelle sind bewusst einfachere Low-Poly-Modelle. Ihre Animationen sind vollständig nachvollziehbar; ihre Materialdetails erreichen nicht die realistische Gebäudegrafik der Bildvorlage. Hochdetaillierte, zur Vorlage passende Figuren mit denselben vollständigen Clips fehlen weiterhin.
- Spähheli und Kampfheli verwenden dasselbe lizenzierte Hubschraubermodell in unterschiedlicher Größe. Ein eigenständiges bewaffnetes Kampfheli-Modell fehlt.
- Unabhängige Türme und Rohre existieren nur für Panzer und Artillerie. Rover und Luftfahrzeuge besitzen keine passenden zusätzlichen Waffenlayer.
- Fahrzeuge besitzen keine separaten Treffer-, Zerfalls- oder Absturzclips. Treffer werden durch Einschlagpartikel dargestellt; Bodentruppen hinterlassen einen statischen dunklen Wrackframe, Fluggeräte verschwinden mit einer Explosion. Das sind keine behaupteten animierten Zerstörungsframes.
- Es gibt keine neue Gameplaymechanik. Notstopps und Kampfunterbrechungen behalten die bestehende unmittelbare Reaktion; Beschleunigung betrifft Marschbewegung.

## Reproduzieren und ansehen

```sh
npm ci
npm ci --prefix tests/browser
npm run assets:animations       # benötigt lokalen Chrome; alle 18 Atlanten
npm run assets:animation-audit
npm run build
node --test tests/reborn-animation.test.mjs tests/reborn.test.mjs
npm --prefix tests/browser test -- --grep 'animation laboratory'
```

Einzelne Modelle lassen sich etwa mit `npm run assets:animations -- tank artillery` exportieren. Alle Dateien sind lokal vorhanden; zur Spielzeit gibt es keinen Modelldownload.

**[Animationslabor](http://127.0.0.1:8095/animation-lab.html):** dieselbe Präsentationsklasse wie im Spiel; gleichzeitig Idle, acht Laufrichtungen, Feuerwechsel, Fahrzeugkurve, unabhängiger Turm/Rohrrücklauf und Treffer/Tod. Pause und Partikelschalter sind bedienbar. Die Szene ist eine lokale Darstellungskontrolle, kein neuer Spielmodus.

37 gezielte Node-Prüfungen und sieben ausgewählte Chrome-Prüfungen bestanden: Zustandsfolgen, Weg-/Bildratenbindung, echte Frameunterschiede, Partikelbudget, Beschleunigung, Save-Kompatibilität, Basis-Ausgang, Kampagne, verborgene Gegner, geerdete Posen, komplette Fahrzeugproduktion und das Labor. Visuell geprüfte Browseraufnahmen: [Laufphasen](animation-lab-walk.png), [Treffer](animation-lab-hit.png), [Tod](animation-lab-death.png), [Browservideo](animation-lab.webm). Die breite Archivtestsuite wurde für diesen fokussierten Auftrag nicht erneut ausgeführt.
