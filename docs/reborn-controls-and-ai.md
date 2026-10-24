# Steuerung und Standard-KI: Rückzug unter Beschuss

## Befehlspriorität

Ein unmittelbarer **Bewegen**-Befehl wird in der Simulation vor Zielsuche
und automatischem Schuss abgearbeitet. Das gilt insbesondere für die
fliegenden Einheiten: Transportheli, Kampfheli und Bomber, aber auch für
Bodeneinheiten. Bisher konnte der automatische Beschuss eines Gegners in
Waffenreichweite einen gültigen Marschbefehl in jedem Tick blockieren.
Der neue Code beendet die laufende Salve und löst die Zielbindung,
bevor er den eigentlichen Bewegungsbefehl verarbeitet.

- **Rechtsklick auf freien Boden:** normal bewegen. Ein sichtbarer Gegner
  direkt unter dem Mauszeiger wird weiterhin standardmäßig angegriffen.
- **M, dann Linksklick:** streng bewegen bzw. zurückziehen, selbst
  wenn das Ziel in der Nähe einer feindlichen Einheit liegt.
- **Alt/Option + Rechtsklick:** sofortiger Bewegungsbefehl auch direkt
  auf einen feindlich besetzten Punkt.
- **A, dann Linksklick:** Angriffsbewegung, die weiter automatisch feuert.
- **S:** stoppen/Position halten.

Ein bereits laufender Transportlande- oder Startvorgang darf sauber
abgeschlossen werden. Ein neuer Bewegungsbefehl wird für danach
gespeichert; bei laufender normaler Flug-/Kampfbewegung gilt er sofort.
Die Kommandos werden weiterhin über die vorhandene `Simulation.command`-
API validiert und respektieren die Maximalgröße der Befehlswarteschlange.

## Standard-KI

- Bekannte gegnerische Raketenwerfer und wichtige Lufteinheiten nahe
  der Basis werden vor etwas näheren, weniger gefährlichen Soldaten
  zur Verteidigung priorisiert.
- Rote Kampfeinheiten fokussieren im **neuen** Zielentscheid bevorzugt
  bekannte, tatsächlich erreichbare feindliche Raketenwerfer und Sanitäter.
  Aktuelle Zielbindungen, explizite Angriffsaufträge und Sichtregeln
  bleiben vorrangig. Blaue Einheiten behalten ihre bisherige
  Zielauswahl bei.
- Besitzt die rote Armee einen verfügbaren Raketenwerfer, werden
  bekannte Geschütztürme bei der Sektorwahl weniger stark abgestraft.
  Sie bleiben riskante Hindernisse, gelten aber nicht mehr nahezu
  grundsätzlich als zu vermeiden. Artillerie, Formationen und
  Ressourcen werden weiterhin über bestehende Mechaniken gesteuert.

Die KI verwendet nur Informationen aus der bereits etablierten
Sicht-/Erinnerungslogik. Es gibt keine Gratis-Einheiten, Schadensboni
oder versteckte gegnerische Informationen.

## Prüfen

```sh
npm run build
node --test tests/reborn-control-retreat.test.mjs tests/reborn-combined-arms.test.mjs tests/reborn-tactical-ai.test.mjs
npm --prefix tests/browser test -- --grep 'control: selected helicopter'
```

Manuell zusätzlich Transportheli während des Beschusses auswählen und
mit `M` bzw. Alt+Rechtsklick wegschicken, sowie Angriffsbefehle mit `A`
und den regulären `S`-Stopbefehl ausprobieren.

**Validierungsstand:** GitHub-Änderungen und Regressionstests sind
eingereicht. Die Tests wurden hier nicht ausgeführt, und eine
verbesserte KI-Siegquote ist noch nicht per A/B-Benchmark belegt.
