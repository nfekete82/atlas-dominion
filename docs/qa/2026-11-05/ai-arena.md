# Sandforge – KI-Testarena

**Status:** vollständig · **Gefechte:** 8/8

Derselbe Seed und dieselbe Karte werden für Baseline und Director verwendet. Der BLUE-Gegner ist ein festes, budgetgebundenes Verteidigungsskript; dies ist kein menschlicher Gegner und keine vollständige Selbstspiel-KI.

## Ergebnisse

| Modus | Gefechte | Siege | Niederlagen | Zeitlimits | Siege / alle | Ø Score | Ø HQ-Schaden |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline | 4 | 0 | 0 | 4 | 0 % | 593 | 154.417 |
| director | 4 | 0 | 0 | 4 | 0 % | 1306 | 416.917 |

## Erste Artillerie: Produktionskette

| Karte | Seed | Fabrik fertig (s) | Artillerie bezahlt (s) | Artillerie fertig (s) | Fabrik→Bestellung (s) | Bestellung→Einheit (s) | Artillerie in Queue am Ende |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 11 | 2026 | 113 | 192.75 | 210.75 | 79.75 | 18 | 0 |
| 12 | 2026 | 247.2 | 247.65 | 265.65 | 0.45 | 18 | 1 |
| 13 | 2026 | 144.35 | 192.75 | 210.75 | 48.4 | 18 | 0 |
| 14 | 2026 | 145.45 | 201.9 | 219.9 | 56.45 | 18 | 0 |

– bedeutet: nicht innerhalb des Simulationsfensters beobachtet. Ein bezahlter Auftrag ist keine fertige Einheit.


## Paarvergleich Director minus Baseline

**Vergleichbare Paare:** 4 · **Abweichende Startwelten:** 0

- Zusätzliche Siege: 0
- Ø Score-Differenz: 713
- Ø HQ-Schaden-Differenz: 262.5
- Ø Eroberungen-Differenz: 2
- Ø eigene Verluste-Differenz: -1

## Häufigste Warnsignale des Directors

Warnsignale sind **beobachtete Auffälligkeiten, keine nachgewiesenen Ursachen**. Mehrere Signale können im selben Gefecht auftreten. Zeitlimits sind keine Niederlagen.

**Bewertete Niederlagen/Zeitlimits:** 4

| Auffälligkeit | Betroffene Gefechte | Nächster Prüfpunkt |
|---|---:|---|
| Häufige Missionsabbrüche | 2 | Schwellen für Rückzug, Verstärkung und Missionswechsel anhand der Timeline untersuchen. |
| Gegnerisches HQ gesehen, aber nicht beschädigt | 1 | Belagerungsplanung, verfügbare Artillerie und Zielpriorisierung prüfen. |

## Nächste Schritte

1. Die drei häufigsten Warnsignale im JSON mit ihren Map-/Seed-Beispielen reproduzieren.
2. Für jeden echten Fehler einen gezielten Regressionstest schreiben und die KI korrigieren.
3. Dieselbe Arena mit identischen Seeds erneut ausführen und die Berichte paarweise vergleichen.

Hinweis: Die Siegquote verwendet **alle** Gefechte als Nenner; Zeitlimits werden separat ausgewiesen. Ein Vergleich zwischen verschiedenen Code-Versionen setzt identische spielbare Startwelten voraus.
