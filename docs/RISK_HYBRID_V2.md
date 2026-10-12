# Atlas Dominion 2.0 — Risiko-Hybrid (spielbarer Prototyp)

Ein neuer, unabhängiger Rundenmodus. Der bisherige Echtzeitmodus und dessen Spielstand bleiben erhalten.

## Start

```sh
npm test
npm run test:browser
docker compose up -d --build
```

Im Browser: **http://localhost:8095/risk.html**, oder über **🎲 RISIKO 2.0** in der bestehenden Navigation.

## Spielregeln im aktuellen Prototyp

- Spielerland: **Deutschland**; alle anderen 49 Nationen werden von der KI gesteuert.
- Geografische Provinzen werden deterministisch aus der vorhandenen Europa-Landmaske erzeugt. Die Provinzgrenzen sind zunächst **technisch generiert**, keine historischen Verwaltungsgrenzen. Für Inseln entstehen eigenständige Provinzen.
- **Verstärken:** eigene Provinz anklicken und Reserveeinheiten platzieren.
- **Städte entwickeln:** Stadt durch Zahlung von Gold um eine Stufe erhöhen; maximal Level 5.
- **Angreifen:** eigene Ausgangsprovinz und anschließend angrenzendes Feind- oder Neutralgebiet wählen, dann würfeln oder schnell kämpfen. Angreifer bis zu 3 Würfel, Verteidiger bis zu 2. Gleichstand gewinnt der Verteidiger.
- **Verschieben:** benachbarte, eigene Provinzen auswählen und Truppen verlagern. Eine Einheit muss in der Ausgangsprovinz bleiben.
- **Runde beenden:** 49 KI-Fraktionen absolvieren eigene Zugphasen mit denselben bezahlten Verstärkungen, Stadt-Upgrades und Würfelkämpfen. Erst anschließend beginnt die nächste Spielerrunde.
- Das Bevölkerungs-/Truppenmodell des Echtzeitmodus wird **nicht** in den neuen Modus übernommen; der Risiko-Modus verwendet kleine, ganze Armeestärken je Provinz.
- Eigene Spielstände liegen getrennt im Browser unter `atlas-dominion-risk-v1` (JSON).

## Architektur

- `src/engine/turn-game.ts`: eigenständige Spielregeln, Provinzerzeugung, Würfel und Savegames.
- `src/engine/turn-ai.ts`: deterministische KI, ausschließlich mit öffentlichen Spielkommandos.
- `src/render/turn-map.ts`: interaktive Provinzkarte, Topografie, Provinzgrenzen, Truppenmarkierungen.
- `src/risk-main.ts`: Bedienung, Rundenfluss, Spielstand und Kampfprotokoll.
- `risk.html` / `src/risk-style.css`: eigenständige Benutzeroberfläche.

## Geplante nächste Ausbaustufen

- Freie Nationenauswahl und verständliche Provinznamen statt laufender Nummern.
- Hochwertige und historisch/geografisch sinnvolle Provinzgrenzen statt rein rasterbasierter Aufteilung.
- Seewege, Häfen und rundenbasierte Invasionen im Risiko-Modus (aktuell **nur Landnachbarschaften**).
- Sichtbare 3D-/2D-Würfelanimation und getrennte Kampfansicht.
- Diplomatie, bessere Zielprioritäten, Balancing und Siegbedingungen.
- Tiefer gehende Savegame-Prüfungen und vollständige Browser-Gameplay-Szenarien.

Diese Version ist absichtlich ein **Prototyp** und bleibt bis zur weiteren QA als Draft-PR offen.
