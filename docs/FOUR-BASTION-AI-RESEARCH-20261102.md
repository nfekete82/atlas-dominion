# Sandforge – Vier-Bastionen-KI / Eröffnungsanalyse (02.11.2026)

## Ausgangslage
Die aktuelle Kampagne mit vier Bastionen ist mapVersion 11 (2×2).
Beide Fraktionen starten mit denselben 950 Credits, einem Legionär,
einem Pionier und einem HQ. Das Spiel hat zwei neutrale Kontrollpunkte.
Die Standard-KI wartet 25 Sekunden vor ihrem ersten regulären Plan und
plant im ersten Schritt einen Einkommensgenerator.

## Kontrollierter Test
4 identische Seeds (2026–2029), jeweils 240 Spielsekunden, gegen den
**geskripteten** bezahlten blauen Wächtergegner, derselbe Simulationskern.
Die Versionen unterscheiden sich ausschließlich in der roten Eröffnung.
Ein Timeout ist keine Niederlage/kein Sieg und der Benchmark ist kein
valider Ersatz für Spiele gegen einen guten Menschen.

| Variante | Erster Angriff, s | Bastionseroberungen | Ø gegnerischer HQ-Schaden | Ø rote Verluste | echte Siege |
|---|---:|---:|---:|---:|---:|
| Classic (unverändert) | 25,0 | 2,0 | 282,2 | 2,0 | 0 |
| Responsive: Planung nach 6s, Kaserne zuerst, sofortiger Angriff | 6,05 | 2,0 | 204,0 | 4,5 | 0 |
| Prepared: Planung nach 6s, Kaserne zuerst, mindestens 2 Kämpfer vor Angriff | 27,4 | 2,0 | 300,0 | 6,25 | 0 |

**Ergebnis:** Weder responsive noch prepared ist unter diesen Bedingungen
nachweisbar besser. Prepared steigert den durchschnittlichen HQ-Schaden
nur um ~18, verliert aber über dreimal so viele Einheiten. Daher **bleibt
Classic im normalen Spiel Default**; beide experimentellen Varianten
werden ausschließlich für weitere A/B-Tests bereitgehalten.

## Schlussfolgerung
Ein früheres Startsignal alleine repariert weder die schlechte
Überlebensfähigkeit noch die Entscheidung, wann ein Angriff aufgegeben
oder mit Verstärkungen fortgesetzt werden soll.

## Nächste hochwirksame Kandidaten (isoliert testen)
1. **Lokale Kräftebewertung:** Angriff erst nach Vergleich von
   tatsächlicher Anti-Infanterie-/Anti-Panzer-DPS, Sicht und Rückzugsweg.
2. **Feuerkonzentration und Kiting:** beschädigte Gegner gemeinsam
   ausschalten; keine verstreuten Einzelziele und keine unnötigen
   Einheitenverluste beim Vormarsch.
3. **Verstärkung und Rally:** Nachschub schickt man in eine geschützte
   Stellung nahe dem laufenden Angriff; bei 4 Bastionen keine drei
   separaten Mini-Angriffsgruppen, wenn der Hauptangriff dadurch verliert.
4. **Ökonomische Taktung:** bezahlte Einheiten, Produktionsleerlauf,
   Credits und die Zeit bis zur zweiten Bastion in den Benchmarks messen.
5. **Härterer Gegner im Benchmark:** aktuell nur geskriptetes Guarded BLUE,
   zusätzlich aggressive und expandierende BLUE-Strategien sowie spätere
   menschliche Siegquoten aus anonymisierten Matchstatistiken messen.

Die KI darf dabei **keine Kenntnis unentdeckter Feinde** erhalten und
keine zusätzlichen Credits, Trefferpunkte oder Schadensboni.
Eine Option „Schwer“ sollte Strategien und Entscheidungen ändern,
nicht heimlich Physik oder Ressourcen.

## Reproduzieren
```bash
npm run build
node scripts/benchmark-four-bastion-opening.mjs --seconds 240 --seeds 2026,2027,2028,2029
```
