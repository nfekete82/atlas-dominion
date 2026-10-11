# ATLAS DOMINION

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
