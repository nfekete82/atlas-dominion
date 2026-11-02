# Sandforge: Einheitenbalance – 02.11.2026

## Methodik
Quellen: `src/reborn/catalog.ts`, `src/reborn/config.ts`, `src/reborn/simulation.ts`,
`src/reborn/battle-response.ts`. Effektiver statischer Schaden = Schaden / Cooldown
mit den tatsächlichen Zieltyp-Multiplikatoren. Das ist **keine echte Siegrate**.
Marschwege, Trefferreihenfolge, Projektilflug, Veteranen, Sicht, taktische Steuerung,
Flächenschaden, Luftbewegung, Reparaturen und Terrain entscheiden zusätzlich.
Reproduzierbarer Bericht: `npm run build && node scripts/audit-unit-balance.mjs`.

## Bestandsaufnahme vor dem Panzer-Patch

| Einheit | Preis | HP | Tempo | Reichweite | Grund-DPS und Rolle |
|---|---:|---:|---:|---:|---|
| Legionär | 100 | 100 | 112 | 175 | 20; günstige Front |
| Sanitäter | 175 | 100 | 105 | 110 | 2,2; 12 HP/s Infanterie-Heilung |
| Pionier | 200 | 110 | 105 | 110 | 2,2; 18 HP/s Fahrzeug-, 12 HP/s Gebäudereparatur |
| Schwere Infanterie | 250 | 420 | 78 | 220 | 104,3 gegen Infanterie, 47 gegen Panzer |
| Humvee | 350 | 295 | 235 | 240 | 19,1 gegen Infanterie, 6,7 gegen Panzer; 4 Passagiere |
| Kampfpanzer | 550 | 850 | 80 | 300 / MG 230 | Rakete 57,4 gegen Fahrzeuge; MG 21,8 gegen Infanterie |
| Raketenwerfer | 600 | 340 | 65 | 680 | 31,6 und 60-Meter-Raketeneinschlag, starker Reichweitenvorteil |
| Transportheli | 600 | 360 | 200 | 200 | 30; 10 Passagiere |
| Bomber | 1.000 | 700 | 125 | 260 | 42,2; standardmäßig Einzeltreffer, keine eigene Bombe mit AoE |
| Geschützturm | 175 | 650 | 0 | 600 | 30; kosteneffiziente stationäre Verteidigung |

### Auffällige Matchups
- **Kampfpanzer gegen schwere Infanterie:** Trotz 2,2-facher Kosten kann im alten
  Stand ein einzelner Schwerer das Duell bei gleicher Feuerdistanz rechnerisch
  knapp gewinnen. Der Turm-MG-Schaden (12 alle 0,55 s) ist die Ursache; die Rakete
  wird gegen Infanterie absichtlich unterdrückt.
- **Schwere Infanterie:** 420 HP plus ~104 DPS gegen andere Infanterie für nur
  250 Credits ist ein herausragendes Preis-Leistungs-Verhältnis. Auch gegen
  Flugzeuge existiert aktuell kein Abschlag für schweren Beschuss.
- **Bomber:** Teuer und im direkten Schlagabtausch gegen schwere Infanterie
  überraschend schwach; für die Rolle fehlen Bombenschaden im Radius und
  eine klarere Luft-Boden-Spezialisierung.
- **Geschützturm:** 600 Reichweite bei 175 Credits macht Vorstöße mit Panzern
  riskant; Artillerie besitzt den beabsichtigten 80-Meter-Reichweitenvorteil.
- **Humvee und Heli:** Kampfwerte sind niedrig im Verhältnis zum Preis, aber
  beide besitzen Transport-/Mobilitätswert. Nicht als reine DPS-Einheiten bewerten.

## Kandidat: Panzer gezielt stärken, Konter erhalten

| Parameter | Vorher | Experiment |
|---|---:|---:|
| Kampfpanzer HP | 850 | 1000 |
| Panzerrakete je Treffer | 135 | 155 |
| Dach-MG je Treffer | 12 | 18 |
| MG-Intervall | 0,55 s | unverändert |
| Gewehrschaden Legionär gegen Panzer | 100 % | 65 % |
| Schwere Infanterie gegen gepanzerte Ziele | 45 % | unverändert |
| Panzerpreis | 550 | unverändert |
| Turm, Raketenwerfer, Humvee, Bomber | – | unverändert |

Ziel: Ein Panzer schlägt einzelne schwere Infanterie im direkten Duell sicher,
ist aber gegen **zwei** schwere Infanteristen und konzentrierten Turmbeschuss
weiterhin gefährdet. Übermacht mit günstigen Gewehren wird abgeschwächt, nicht
vollständig ausgeschlossen. Kein globaler Nerf für schwere Infanterie,
weil das frühe Wirtschaftssystem und KI-Produktionsverhalten davon abhängen.

Die KI-Kampfstärkebewertung benutzt nun den tatsächlichen MG-DPS gegen Infanterie
und die Raketen-DPS gegen gepanzerte Ziele.

## Nächster Schritt vor Freigabe
1. Build, Unit-Tests und reale 1-gegen-1-/2-gegen-1-Gefechte bestehen.
2. Identische Seeds im Arena-Benchmark gegeneinander ausführen (alter Commit
   versus Kandidat), einschließlich schwerer Infanterie und Turmfronten.
3. Auf Siegrate, Timeouts, KI-Strategiewechsel, Auftragsabbrüche,
   Ressourcenverbrauch und Spieltempo prüfen.
4. **Separater Kandidat** für Bomber-AoE und gegebenenfalls Preis/LP der
   schweren Infanterie – nicht alles gleichzeitig verändern.

Dieser Branch ist ein **Balance-Experiment**, keine genehmigte Live-Version.
