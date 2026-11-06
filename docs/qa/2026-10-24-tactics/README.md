# Taktische Pause, aktivere KI und Wüstenoptik

Stand: 24.10.2026. Vorhandene lokale Änderungen bleiben erhalten; keine Stashes, Commits oder Pushes verändert.

## Pause

Die taktische Pause liegt jetzt über dem gesamten Bildschirm, mit großer mittiger Überschrift, klarer Leertasten-Anweisung und einem Fortsetzen-Knopf. Das Schlachtfeld samt Sidebar wird mit 7 px unscharf dargestellt; die Pausenanzeige selbst bleibt scharf. Der Hintergrund ist währenddessen nicht bedienbar. Leertaste und Fortsetzen setzen das Spiel fort. Ein beim Test gefundener Escape-Fehler wurde ebenfalls korrigiert: Das Öffnen des Menüs wird nicht mehr durch die Standardaktion desselben Escape-Tastendrucks sofort rückgängig gemacht. Menüdialoge erhalten keine doppelte Pausenunschärfe.

[Vorschau der Pause](tactical-pause.png)

## KI

Die KI war im untersuchten Stand nicht vollständig ausgefallen. Sie eroberte neutrale Gebiete, während neu produzierte Einheiten oft an der Heimatbasis blieben. Die vier frühen Soldaten zogen allein weiter. Die Marschbremse verglich zudem direkte Zielentfernungen, auch wenn Teile der Gruppe auf unterschiedlichen Seiten eines Felsens liefen. Dadurch entstanden sichtbare Stillstände trotz vorhandener Wege. Die Zielbewertung begünstigte lange Rundgänge durch entfernte neutrale Sektoren.

Korrekturen:

- Regulär bezahlte Verstärkungen marschieren zur aktiven Gruppe und treten ihr erst in Frontnähe bei. Die bestehende Front wartet nicht auf weit entfernte Rekruten. Eine Heimatwache bleibt zurück; die Kampfgruppe ist weiterhin auf zehn Kämpfer begrenzt.
- Sammel- und Rückzugsbewegungen verwenden keine starre Marschkohorte. Bereite Einheiten am Sammelpunkt erhalten Vorrang vor noch weit entfernten Truppen.
- Die Fortschrittsbremse greift auf gemeinsam geradem Weg. Sie friert die Spitze nicht mehr ein, solange andere Mitglieder um eine Geländebiegung laufen. Gemeinsames Grundtempo und normale Zusammenhaltsgrenzen auf offenem Boden bleiben erhalten.
- Ab vier eigenen Sektoren richtet sich die Expansion stärker zur gegnerischen Front aus. Die Bewertung verwendet die bereits in der Strategie verwendeten Sektorbesitzer. Unbekannte gegnerische Einheiten oder Gebäude liefern weiterhin keine Gefahren- oder Stärkedaten. Bekannte Turmstellungen und Verluste bleiben Gründe für Flanken, Verstärkung und Rückzug.

Reproduzierbarer Vergleich: normale Kampagne, keine Spielerbefehle, keine Zusatzressourcen, feste Schritte von 0,1 s, jeweils dieselben Seeds. Die rote KI kauft und baut regulär; der unbewegte blaue Spieler bleibt als messbarer Gegner vorhanden. Zeiten sind **simulierte Spielsekunden**, keine Lade- oder Echtzeiten.

| Seed | Erster roter Schuss vorher | Nachher | Erstes erobertes blaues Startgebiet nachher |
|---|---:|---:|---:|
| 2026 | 330,2 s | 274,9 s | 156,8 s |
| 42 | 331,5 s | 217,8 s | 189,6 s |

Rohdaten: [vorher](pressure-before.json), [nachher](pressure-after.json). Der Vorher-Lauf verwendet die zu Beginn dieser Arbeit gesicherten Simulations-/KI-Quellen in einem separaten temporären Modulverzeichnis; der lokale Projektstand wurde dafür nicht zurückgesetzt. Wiederholung des aktuellen Stands: `npm run build && node scripts/benchmark-reborn-pressure.mjs after`. `ATLAS_SIM_MODULE` erlaubt eine separat gesicherte Referenzimplementierung.

Die zwei Seeds belegen die Korrekturen, decken aber keine beliebige Spielsituation ab. Die KI bleibt durch Geld, Produktion, eigene Sicht und physisch erreichbare Wege begrenzt. Ihr Verhalten wurde hier auf Wunsch geändert; identische Vorher-/Nachher-Spielzustände aus dem früheren Performance-Auftrag sind deshalb kein Ziel dieses Änderungsschritts. Speichern/Laden und Fortsetzung bleiben innerhalb des neuen Stands deterministisch.

## Geschützturm

Beide Fraktionen haben überarbeitete Keramikpanzerung, gebürstete warme Metallfassungen, eingelassene Fraktionsfarben, verwitterten Lack, abgestufte Rauheit, Kühlrippen und Wartungsdetails. Die Palette passt zu Bastion und Feldkommando. Der bestehende drehbare Kopf, beide Mündungen und die 64 registrierten Ansichten bleiben erhalten. Der Turm bleibt 72 Welteinheiten breit; Reichweite, Schaden und Drehgeschwindigkeit ändern sich nicht. Hauptquartier und Bastion werden nicht neu exportiert.

Quelle: `scripts/animation/turret-finish.js`, eingebunden in `atlas-buildings.js`. Wiederholung: `node scripts/export-atlas-buildings.mjs turret`, danach `npm run build`. Materialarbeit passiert beim Export; das Spiel verwendet weiterhin die gebackenen Canvas-Sprites.

[Vorschau beider Turmvarianten neben Bastion und Hauptbasis](turret-in-game.png)

## Felsen

Die künstlich wirkenden blauen Kristalle werden nicht mehr gezeichnet. Die Felsen tragen eine neue natürliche Sandsteintextur, pro Seitenfläche projizierte Sedimentschichten, wärmere Beleuchtung, verwitterte Deckflächen, weichere Bodenkontakte und Geröll. Die Oberflächen werden einmal in den bestehenden Terrain-Cache gebacken. Es entstehen keine neuen Felsentexturen pro Frame.

Karten-Seed, Geländeumrisse, Klippen-Sichtblockaden und Navigation bleiben erhalten. Auch das alte Kristallfeld bleibt als nicht gezeichnetes Metadatum bestehen, damit gespeicherte Seeds dieselbe Welt erzeugen.

[Vorschau der Felsen](sandstone.png) · [Neue Textur](../../../src/assets/reborn/sandstone-strata-v1.png) · [Erzeugung und vollständiger Prompt](sandstone-source.md)

## Validierung

- `npm run build` und `git diff --check` bestanden.
- 92 fokussierte Node-Tests bestanden: KI-Verstärkung, reale Kampagnenangriffe, Geländeumwege, gebündelte Waffen, Material-/GLB-Integrität, alle Turmrichtungen, unveränderte Gebäude, 100 Kampagnenkarten, Heilung/Reparatur, Transport, Produktionswirtschaft und deterministisches Laden.
- 20 unterschiedliche Browserfälle bestanden, einschließlich eines gezielten Nachlaufs nach der Escape-Korrektur: Pause auf Desktop/Tablet/Telefon, Stillstand der Simulation, beide Fortsetzen-Wege, Wechsel zum Menü, fehlende Kristallpixel, unveränderte Kartendaten, beide Turmvarianten, Sidebar-/Retina-Eingabe, Funk, Kampfsalven, Formationen, echter Turmbau und gelernte KI-Verlustreaktionen.
- Spielansichten wurden zusätzlich im Browser aufgenommen und visuell geprüft.

Es gab keinen vollständigen neuen Performance-Vergleich über alle acht Szenarien; Material- und Felsendetails sind vorab gebacken. Die im vorherigen Performance-Bericht dokumentierten Restspitzen werden mit diesem Optik-/KI-Auftrag nicht als beseitigt behauptet.
