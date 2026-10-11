# ATLAS DOMINION

**v1.0.2 — KLEINE SICHTBARE GEBÄUDE**

## Neu in v1.0.2
- **Errichtete Siedlungen, Städte, Kasernen, Festungen und Häfen sind wieder auf der Karte sichtbar** – als kleine, dezente Einzelzeichen direkt auf ihrem tatsächlich bebauten Sektor.
- **Keine großen quadratischen Hintergründe, kein Kreis, keine Plaketten** hinter den Gebäudesymbolen.
- Stabile, ungefähr gleich kleine Bildschirmgröße bei Zoomänderungen; bei weiter Entfernung werden nur eigene Gebäude eingeblendet, bei näherer Ansicht auch fremde.
- Überlappende Symbole werden im Übersichtszoom ausgedünnt; eigene Gebäude erhalten Vorrang.
- Beim Darüberfahren nennt der Tooltip den tatsächlichen Gebäudetyp. Das Rechtsklick-Menü zeigt beim Öffnen eines bebauten Sektors ebenfalls seinen Namen.
- Die Symbolliste wird nur bei Änderungen am Gebiet oder Baufortschritt aktualisiert, nicht bei jedem Animationsbild neu aus den Sektoren erstellt.
- Keine Änderung an Baukosten, Spielsimulation, Kampflogik oder Speicherung.

---

**v1.0.1 — KLARE FRONTAKTIONEN & KONTRASTREICHE KARTE**

## Neu in v1.0.1
- Rückkehr zur kontrastreichen dunkelblauen Karte mit deutlich voneinander unterscheidbaren Fraktionsfarben und präzisen Besitzgrenzen. Der blasse beige Landstil aus v1.0 wurde entfernt.
- Kein permanentes Sektorraster über Besitzflächen. Keine dekorativen Kreisringe an Hauptstädten, keine Sektorquadrat-Hovermarker oder farbigen Verteidigungs-Punkte.
- Keine dauerhaft eingeblendeten Gebäudequadrate. Das Rechtsklick-Baumenü und sämtliche Bauwirkungen bleiben erhalten.
- Seelandungsziele erscheinen nur **während Shift gedrückt ist** als kleine Ankermarkierungen.
- Länderziel beim Hover bleibt als sehr dezente Fläche hervorgehoben. Im eigentlichen Gefecht zeigt nur eine schmale, ruhige Linie die aktive Front.
- Die Eroberungswelle zeigt rasch hintereinander die tatsächlich eroberten Sektoren (190 statt 420 ms Animationsdauer, 24 statt 55 ms pro Tiefenstufe), ohne zusätzliche runde Effekte.
- Die intuitive v1.0-Klicksteuerung bleibt: Klick irgendwo in ein **zusammenhängendes, direkt angrenzendes gegnerisches Land**, Start an der echten Grenze. Neutrale Flächen nur bis 14 Sektoren Klicktiefe. Seeangriffe weiterhin separat.
- Keine Änderung an echten Ressourcen, Baukosten, Eigentumslogik oder Kampfregeln. Animationen verändern niemals die Simulation.

## Visuelle Designrichtung
Eigener dunkler, ruhiger Strategiespiel-Look mit scharfen politischen Besitzflächen und minimaler Kampfinteraktion. Nicht die Benutzeroberfläche von OpenFront kopiert.

---

**v1.0 — HELLE EUROPAKARTE & NATÜRLICHES ANGRIFFS-KLICKEN**

Eigenständiges Echtzeit-Strategiespiel für den Browser, inspiriert vom flächigen Strategie-Kartendesign und dem unmittelbaren Spielgefühl von OpenFront. **Keine OpenFront-Grafiken oder sonstigen Assets wurden kopiert.**

## Neu in v1.0

### Helle politische Karte
- Ruhiges blaues Meer, cremefarbene freie Landsektoren, **pastellfarbene eigene Territorien**.
- Dünne, gut unterscheidbare militärische Besitzgrenzen mit hellen Konturen.
- Ursprüngliche Verwaltungs- und Ländergrenzen sind als subtile Orientierungslinien über der Karte sichtbar. Sie sind bewusst von den **aktuellen Besitzgrenzen** getrennt.
- Das feine, bestehende Raster bleibt für die Simulation erhalten und wird optisch stark zurückgenommen.
- Reduzierter Glow, abgemilderte Eroberungsanimation und deutlich kompakterer Kartenkopf.
- Dark-Sidebar mit Bau-/Rekrutierungssystem bleibt als Kontrast erhalten.

### Klicken auf das Nachbarland statt Grenzquadrate
- **Auf eine beliebige Stelle eines feindlichen Landes klicken**, sofern genau die angeklickte **zusammenhängende Landregion** eine echte Landgrenze zu dir besitzt.
- Die Engine findet über ausschließlich orthogonal angrenzende Sektoren die nächstgelegene eigene Feindfront. Die Kampf-Simulation erobert danach weiterhin **Sektor für Sektor direkt an der Grenze**, nicht im Landesinneren.
- **Keine Teleports** durch dritte Staaten, Wasser, oder von einer feindlichen Insel auf dessen anderswo angrenzendes Festland. Seelandungen nur explizit via Shift+Klick auf markierte See-Passagen.
- Die riesige, zusammenhängende neutrale Landmasse wird weiter auf **14 Sektoren** Klicktoleranz begrenzt. Damit ist nicht ganz Europa durch einen einzigen Klick angriffsberechtigt.
- Beim Hover eines erreichbaren Feindlands wird dessen farbige Fläche leicht hervorgehoben und die tatsächliche Angriffsfront separat markiert. Ein Tooltip sagt klar, ob der Landangriff möglich ist.
- Vorschau wird als eigene Canvas-Ebene gepuffert, um nicht jede Animationsframe erneut alle Sektoren durchzugehen.

## Weiterhin enthalten

- 50 spielbare europäische Länder mit eigenem Hauptstadtstart und KI-Gegnern
- 480×260-Sektoren-Europakarte (Natural Earth, Public Domain)
- Bevölkerung und Rekrutierung, Vorräte, Bauen per Rechtsklick (Siedlung, Stadt, Kaserne, Festung, Hafen)
- Regionale Grenzverteidigung, simulierte Gefechte, Truppeneinsatz pro Angriff

## Spiel starten

```bash
cd ~/Projects/atlas-dominion
git switch main
git pull --ff-only origin main
npm test && PORT=8095 npm run dev
```

Dann http://localhost:8095 öffnen, Land wählen und starten.

## Steuerung

| Aktion | Steuerung |
| --- | --- |
| Nachbarland angreifen | Linksklick irgendwo in eine mit dir durch Land verbundene fremde Region |
| Neutrales Gebiet angreifen | Linksklick innerhalb von 14 Sektoren zur eigenen Front |
| Angriffsmenge | Prozentregler |
| Bauen | Rechtsklick auf eigenes Land |
| Seeangriff | Shift + Klick auf markierte Anlegestelle |
| Karte bewegen / zoomen | Ziehen / Mausrad |
| Pause | Leertaste |

## Tests

`tests/front-target.test.mjs` validiert großflächige Ziele, echte gemeinsame Grenzen, isolierte Inseln, Wasser, Drittstaaten, neutrale Reichweite und Zeilenumbrüche. `tests/map-palette.test.mjs` überprüft die neuen Pastellmischfarben. Der vollständige TypeScript-Build und die Integrationstests werden mit `npm test` auf dem Mac geprüft.

Kartendaten: Natural Earth 110m, Public Domain. Das Projekt ist unabhängig von OpenFront.
