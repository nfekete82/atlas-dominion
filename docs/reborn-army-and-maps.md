# Reborn – echte Gegnerarmee und wählbare Kartengrößen (Experiment)

Die bisherige Qwen3-0.6B-Erweiterung wählt lediglich unter bis zu vier
Strategiezielen. Sie baut keine Gebäude und steuert keine Einheiten. Diese
Iteration stärkt deshalb vor allem die **klassische, deterministische Gegner-KI**,
die auch ohne WebGPU oder Modell-Download funktioniert.

## Neues Spiel

Beim normalen Seitenaufruf und über **Neue Kampagne** öffnet sich die
Kartenauswahl:

| Auswahl | Karte | Bastionen gesamt | Kartenausdehnung |
|---|---|---:|---:|
| Klein | Version 3, 2×2 | 4 | 2.200 |
| Mittel | Version 4, 4×2 | 8 | 3.000 |
| Groß | Version 5, 4×3 | 12 | 3.762 |

Alle drei neuen Kartenversionen werden deterministisch aus dem Seed erzeugt.
Ein neuer Spielstart beginnt mit **950 Credits pro Fraktion** (gleiches
Budget für Spieler und Gegner); dadurch kommen Produktionsgebäude und
Fahrzeuge schneller ins Spiel.

Die bisherigen Kartenversionen 0/1 (30 Bastionen) und 2 (16 Bastionen)
bleiben für bestehende Spielstände und Regressionen erhalten. Ihr
Startbudget von 500 Credits bleibt unverändert.

Direkter Testaufruf `/?debug&map=small`, `/?debug&map=medium` oder
`/?debug&map=large`. `/?debug&legacy` bleibt der alte Kartenfixture.

## Baugrenzen

**Pro Fraktion ein Gebäude je Typ:** eine Kaserne, eine Fahrzeugfabrik
und ein Flugfeld. Das gilt bereits ab Baubeginn, nicht erst nach der
Fertigstellung. Ein zerstörtes Gebäude darf neu gebaut werden. Andere
Gebäudetypen sind nicht Teil dieser neuen Einzelgrenze. Bereits
existierende ältere Spielstände mit mehr als einem Produktionsgebäude
bleiben ladbar, aber weitere Duplikate können nicht gebaut werden.

## Gegner-KI

- Die rote KI priorisiert nach dem Kasernenbau früher eine **Fabrik**,
  anschließend bei ausreichender Lage das **Flugfeld**. Beides wird
  mit eigenen Bauarbeitern und echten Credits gebaut.
- Die Produktionspolitik bevorzugt stärker Panzer, Spähwagen,
  Raketenwerfer und Kampfhelikopter. Nur vorhandene, fertiggestellte
  Gebäude und reguläre Warteschlangen produzieren Einheiten.
- Spähwagen werden auf den neuen Karten nicht mehr dauerhaft aus der
  Kampfgruppe für Aufklärung abgezogen. Panzer, Artillerie und schwere
  Infanterie erhalten in den neuen Angriffsgruppen Priorität.
- Das Zeitlimit für einen länger dauernden Frontangriff wurde auf
  den neuen Karten gelockert; Nachschubbefehle werden seltener
  unnötig zurückgesetzt.
- Kennt die KI durch eigene Sicht oder Erinnerung eine feindliche
  Kaserne, Fabrik oder ein Flugfeld im angegriffenen Sektor,
  kann sie diese als **konkretes Angriffsziel** wählen.
- Bei ausreichend großer Armee und verfügbaren schnellen Fahrzeugen
  kann eine kleine **zweite Gruppe** gegen eine schwach verteidigte
  angrenzende Bastion vorrücken.
- Ab fortgeschrittener Frontlage kann ein echter Transportheli
  freie eigene Infanterie aufnehmen und zu einem bereits
  **eingenommenen** vorgeschobenen Sektor bringen. Die vorhandenen
  Lande- und Ladebewegungen werden verwendet; nichts teleportiert.

Qwen bleibt optional, ohne Einfluss auf die direkte Einheitensteuerung,
Bauentscheidungen oder diese Grundregeln. Gegnerische Informationen
werden weiterhin nicht aus verdecktem Spielerzustand gelesen.

## Prüfungen

```sh
npm run build
node --test tests/reborn-map-ai.test.mjs tests/reborn-control-retreat.test.mjs
npm --prefix tests/browser test -- --grep 'campaign: new game prompts'
```

Die Simulationstests prüfen 4/8/12 Bastionen, Versionsspeicherung,
alte Spielstände, Baulimits, Fahrzeugfabrik/Fahrzeuge und echte
Aufnahmebefehle für den Lufttransport. Der Browsertest prüft
den Auswahl-Dialog.

**Hinweis:** Diese Implementierung wurde direkt über den
GitHub-Connector geschrieben. Hier wurden **noch keine lokalen
TypeScript-/Node-/Browser-Tests ausgeführt** und es liegt noch
kein A/B-Nachweis einer verbesserten KI-Siegquote vor.
Die neue KI ist damit eine Testversion, keine
bereits nachgewiesene starke RTS-KI.
