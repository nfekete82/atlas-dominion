# ATLAS DOMINION

**v0.7 — STRICT BORDERS & BIGGER EUROPE**

## Neu in v0.7

- **360 × 240 statt 240 × 160 Kartenfelder:** 86.400 Rasterfelder und etwa 2,25-mal so viele eroberbare Landsektoren. Europas geografische Ausdehnung ist unverändert; die Simulation enthält tatsächlich mehr einzelne Gebiete, nicht bloß einen stärkeren Kamera-Zoom. Die Natural-Earth-Landmaske wird feiner abgetastet, nicht mit zusätzlicher Küstengeometrie ergänzt.
- **Nur direkte Grenzangriffe:** Linksklick wirkt ausschließlich auf einen unmittelbar angrenzenden feindlichen oder neutralen Sektor. Klicks weit im gegnerischen Landesinneren werden abgewiesen.
- **Zusammenhängende Front:** Die Offensive erobert nur Landnachbarn, bleibt um ihre eigene Angriffsfront herum und kann nicht quer durchs Land springen. Je größer das eingesetzte Truppenkontingent, desto breiter und schneller kann die lokale Front vorrücken (mit begrenztem Maximum je Tick).
- **Seewege explizit:** SHIFT + Klick auf die andere Anlegestelle einer eingezeichneten Passage startet eine Seelandung mit vier Ticks Anfahrtszeit. Reguläre Landgefechte berücksichtigen keine See-Korridore. Die KI unternimmt noch keine eigenen Landungen.
- **Mehr Bildfläche:** Kompakter Kartenkopf und schmalere Seitenleiste am Desktop. Regionale Truppen, strategische KI und Rekrutierung ohne 9.000er-Cap bleiben erhalten.
- **Grenzindex:** Die Gegner bewerten erreichbare Sektoren anhand eines effizienteren Frontindex, statt alle 86.400 Felder für jeden Angriff neu zu prüfen.

## Start

```bash
cd ~/Projects/atlas-dominion
git switch main
git pull --ff-only origin main
npm test
PORT=8095 npm run dev
```

## Steuerung

| Aktion | Steuerung |
| --- | --- |
| Regulärer Angriff | Linksklick auf direkt angrenzenden Grenzsektor |
| Seelandung | SHIFT + Linksklick auf Anlegestelle am anderen Ende einer See-Passage |
| Armeeeinsatz | Prozentregler / 10, 25, 50, 100 % |
| Karte bewegen | Maus ziehen |
| Zoom | Mausrad oder +/− |
| Pause | Leertaste |

## Technik und Quellen

Landmaske und Länderpolygone basieren auf Natural Earth (Public Domain). Die ursprüngliche Landmaske wird deterministisch zur Laufzeit auf das 360×240-Raster transformiert. `neighbors()` stellt aus Kompatibilitätsgründen weiterhin geografische Land- und See-Konnektivität bereit. Kämpfe nutzen `landNeighbors()`, sodass es keine ungewollten Wassersprünge gibt. Ein expliziter Landebefehl darf einen dokumentierten Seeübergang überwinden. Gameplay und Assets sind eigenständig, keine OpenFront-Assets.

## Historie

- v0.6: Regionale Verteidigung und unbegrenztes Wachstum
- v0.5: Strategische KI und automatische Grenzsicherung
- v0.4: Flüssige Frontwellen
- v0.3: Angriff ohne Hauptstadtpfeile
- v0.2: Truppenkontingente je Angriff
