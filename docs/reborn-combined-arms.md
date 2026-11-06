# Kombinierte Armee, Raketenwerfer und Transportheli

Die vorhandene `TacticalAI` verwendet jetzt eine situationsabhängige Wirtschaftsplanung in `army-economy.ts`. Sie ruft ausschließlich die regulären bezahlten Produktions-, Bau- und Arbeiterbefehle auf. Die KI erhält keine zusätzlichen Credits, Sicht, Einheiten oder Kampfwerte.

## Produktion und Infrastruktur

Alle zehn bestehenden Typen werden berücksichtigt: Infanterie, schwere Infanterie, Sanitäter, Bauarbeiter, Spähwagen, Kampfpanzer, Raketenwerfer (`artillery`), Transportheli (`scout`), Kampfheli und Bomber. Bewertungen hängen von lebenden und vorgemerkten Einheiten, Einkommen, Credits, Verwundeten, erkundeter Karte, beobachteten Gegnern und bekannten militärischen Zielen ab. Es gibt keine feste Produktionsfolge. Teure Wunschkäufe warten nur begrenzte Zeit; akute Basisverteidigung erhöht die Priorität bezahlbarer Kämpfer. Bomber benötigen eine tragfähige Wirtschaft, eine bestehende Armee, Luftunterstützung und bekannte militärische Ziele.

Ein früher Bauarbeiter errichtet echte Baustellen. Kaserne und Fabrik folgen wachsender Frontstärke beziehungsweise beobachteter Verteidigung; das Flugfeld folgt ausreichendem Einkommen oder erkanntem Luftbedarf. Standortsuche prüft Baugebiet, Erkundung, bekannte Gefahr, Platz und den tatsächlichen Arbeiterweg. Unter Beschuss wird kein neuer Wirtschaftsbau erzwungen. Bauarbeiter setzen unterbrochene Baustellen fort, reparieren beschädigte eigene Anlagen und gehören keiner Angriffsgruppe an. Kaserne, Fabrik und Flugfeld sind auch über das Baumenü des Spielers erreichbar.

## Kampfführung

Die bestehende Sammlung, Verlustauswertung, Verteidigung und gefährdungsgewichtete Wegsuche bleiben zuständig. Schwere Infanterie und Panzer bilden die Front. Gemeinsame Marschzugehörigkeit begrenzt das Tempo schneller Begleiter. Raketenwerfer halten beim Vormarsch Abstand zur Front; gegen Türme schießen sie außerhalb deren Reichweite, während die Front zunächst Deckung davor hält. Sanitäter bleiben hinter den Frontrollen und behandeln tatsächlich verwundete Infanterie. Unter 30 % Gesundheit zieht sich Infanterie zu einem sicheren Sammelpunkt zurück und wird bis mindestens 80 % Gesundheit aus neuen Angriffen herausgehalten; ein verfügbarer Sanitäter übernimmt die Behandlung. Stark verwundete Sanitäter unter Beschuss erhalten ebenfalls Rückzugsbefehle.

Transporthelis erkunden unabhängig. Bei ausreichender Front übernimmt ein verfügbarer Spähwagen zusätzliche Erkundung. Bekannte Türme und Verlustgebiete verteuern auch die sicheren Flugrouten. Kampfhelis erhalten Flankenwege; Bomber greifen bekannte militärische Ziele an und warten ohne geeignetes Ziel im sicheren Gebiet. Sichtbare Angriffe auf eigene Produktionsgebäude rufen die verfügbaren Verteidiger zurück. Beobachtete Panzer erhöhen die Priorität schwerer Einheiten und Kampfhelis; Luftangriffe erhöhen die Kampfheli-Priorität. Raketenwerfer und Bomber werden nicht als Flugabwehr behandelt.

Die KI koordiniert weiterhin eine Hauptangriffsgruppe mit Erkundern, Reserve und flankierender Luftunterstützung. Sie plant keine automatischen Luftlandungen und prognostiziert keine vollständigen Gefechte. Die Auswahl bleibt eine begrenzte deterministische Heuristik.

## Neue Einheitenwerte

| Einheit | Werte und Verhalten |
| --- | --- |
| Schwere Infanterie | 250 Credits, 420 LP, 120 Schaden in drei tatsächlichen Treffern je 1,15 s gegen Infanterie. Gegen Fahrzeuge, Flugzeuge und Gebäude beträgt eine Salve 54 Schaden. Ein realer Test gegen vier gleichzeitig angreifende Schützen besteht für beide Fraktionen mit mehr als halber Gesundheit. |
| Raketenwerfer | 600 Credits, 340 LP, 680 Reichweite und 830 Sicht; der Turm hat 600/750. Ein sichtbares Raketengeschoss fliegt mit 400 Welteinheiten/s zum Zielpunkt und verursacht erst beim Einschlag bis zu 120 Schaden, mit kleinem abfallendem Flächenschaden bis Radius 60. Ausschließlich Bodenziele. Neues Kettenfahrzeug mit zwölf Raketenrohren und registrierter Mündung für beide Fraktionen. |
| Transportheli | 600 Credits, 360 LP, Geschwindigkeit 200, Sicht 780, zehn Infanterieplätze. Maschinengewehr mit 18 Schaden in drei Treffern je 0,6 s zur Selbstverteidigung oder auf direkten Angriffsbefehl. Neues Transportmodell mit zwei Rotoren, Kabine und MGs für beide Fraktionen. |

## Transport bedienen

Infanteristen auswählen und den eigenen Transportheli rechts anklicken. Alternativ den Heli auswählen und mit dem Einsteigen-Kommando oder Rechtsklick auf eigene Infanterie nahe Soldaten aufnehmen. Normale und schwere Infanterie, Sanitäter und Bauarbeiter belegen jeweils einen Platz. Fahrzeuge und andere Flugzeuge können nicht einsteigen.

Der Heli sucht einen freien Landeplatz, landet sichtbar, nimmt Soldaten nacheinander auf und startet wieder. Für das Ausladen den Heli auswählen, das Ausladen-Kommando anklicken und einen Landeplatz wählen. Er fliegt dorthin, landet, setzt die echten Einheiten auf freien begehbaren Boden und startet wieder. Stop unterbricht das Einsteigen; ein neuer Bewegungsbefehl wird nach dem Abheben ausgeführt. Ist ein Zugang blockiert, beendet der Heli nach begrenzter Wartezeit den Vorgang. Bereits aufgenommene Soldaten bleiben an Bord.

Passagiere behalten ID, Gesundheit und ihren einen Kapazitätsplatz. Während des Transports kämpfen sie nicht und sind aus Sicht-, Kollisions-, Auswahl- und Einnahmeabfragen entfernt. Die bestehende Einnahmeregel des Helikopters selbst bleibt gültig. Bei Zerstörung des Helis gehen die Passagiere verloren.

## Spielstände und Prüfung

Version-2-Spielstände behalten ihren bisherigen Umschlag. Optionale Felder speichern Wirtschaftsziele, Erholungsgruppe, fliegende Raketen, Passagiere, Landephase und anschließende Befehle. Alte Kartenstände 0/1 und neue 16-Sektoren-Karten bleiben lesbar. Vorhandene schwere Infanterie und Spähhelis erhalten ihre neue Maximalgesundheit unter Erhalt ihres bisherigen Gesundheitsanteils; `rosterVersion` verhindert eine zweite Umrechnung. Pause hält Landung, Transport, Geschosse und KI-Zeiten an.

Gezielte Prüfung:

```sh
npm run build
node --test tests/reborn-combined-arms.test.mjs tests/reborn-tactical-ai.test.mjs
npm --prefix tests/browser test -- --grep 'combined arms:|tactical AI:|polish:|overhaul: real group|real worker placement'
```

Die deterministischen Langzeittests beobachten tatsächlich bezahlte Produktion, Arbeiterbau und Heilung sowie die vollständige Creditbilanz auf alten und neuen Karten. Eigene Szenarien prüfen Türmbekämpfung, Luftabwehr und strategische Bomberproduktion. Die Browserfälle verwenden echte Auswahl, Kontextbefehle, Ein-/Ausladen, Speichern während des Sinkflugs und sichtbare Raketen. Screenshots liegen unter `tests/browser/artifacts/reborn/combined-*.png`. Es wurden keine zusätzlichen Abhängigkeiten installiert, keine Stashes verändert und keine Commits oder Pushes ausgeführt.

Abschließender Prüfstand: Build erfolgreich, **140/140** gezielte Simulations-, KI-, Karten-, Animations- und Unterstützungsprüfungen bestanden, einschließlich 16 neuer Prüfungen für diese Erweiterung. **9/9** Browserfälle bestanden. `git diff --check` ohne Befund. Die KI berücksichtigt sichtbare Transporthelis, ohne Typen oder Stärke ihrer verborgenen Passagiere auszulesen.
