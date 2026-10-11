# ATLAS DOMINION

**v0.8 — EUROPA MIT 50 SPIELBAREN LÄNDERN**

## Was ist neu?

- **Länderauswahl vor Spielbeginn** mit Suchfeld für Ländernamen oder Hauptstadt. Mit jedem Neustart kann ein anderes Land gewählt werden.
- **50 eigene Fraktionen:** 50 spielbare Staaten inklusive Island, Andorra, Liechtenstein, Malta, Monaco, San Marino, Vatikanstadt, Zypern, Kosovo, Armenien, Georgien und Aserbaidschan. Jedes Land beginnt bei seiner eigenen Hauptstadt. Die 49 übrigen Fraktionen werden durch KI gesteuert.
- **Eigene Hauptstädte reserviert:** Kleinstaaten erhalten auch bei dicht beieinanderliegenden Hauptstädten (etwa Rom/Vatikanstadt) einen eigenen Landsektor. Alle starten mit 400 mobilen Truppen und Hauptstadtverteidigung.
- **Mehr Europa:** 480×260 Kartenraster, Natural-Earth-110m-Geometrie einschließlich Island und der Kaukasusregion. Die ursprünglichen 360×240 Sektoren und Europagrenzen werden dadurch ersetzt; es ist eine echte neue Kartenbasis, kein Kamera-Zoom.
- **Unveränderte Kampfmechanik:** nahe der Grenze klicken, automatischer Grenz-Snap nur über verbundene Landsektoren, keine Land-Teleports, Seeüberquerungen nur mit Shift+Klick auf sichtbare Anlegestellen, automatische regionale Verteidigung, dynamischer Rekrutennachschub.
- **Kamerastart an der eigenen Hauptstadt**, dynamischer Ländername im HUD und weniger überlagerte Stadtbezeichnungen in der großen Europaübersicht.

Die europäische Abgrenzung ist bewusst weit gefasst: Für die Spielauswahl berücksichtigen wir auch die Türkei sowie Staaten des Südkaukasus. Die 50 Startländer sind **keine formelle diplomatische Anerkennungsliste**. Kasachstan ist nicht auswählbar, weil seine Hauptstadt Astana weit außerhalb des dargestellten Kartenausschnitts liegt. Natural Earth vereinfacht historische und aktuelle Grenzlinien; bei winzigen Staaten ist der eigene Startsektor eine spielerische Approximation.

## Spielstart auf dem Mac

```bash
cd ~/Projects/atlas-dominion
git switch main
git pull --ff-only origin main
npm test
PORT=8095 npm run dev
```

Im Browser erscheint der Startbildschirm. Suche z. B. nach **Deutschland / Berlin**, **Portugal / Lissabon** oder **Island / Reykjavík** und klicke das Land an. Die Simulation startet erst nach der Auswahl.

## Steuerung

| Aktion | Steuerung |
|---|---|
| Land wählen | Länderkarte im Startbildschirm anklicken |
| Angreifen | Auf Feindgebiet nahe der gemeinsamen Grenze klicken (max. 14 verbundene Landsektoren) |
| Seeüberfahrt | Shift+Klick auf markierten Hafen |
| Truppenmenge | Prozentregler |
| Zoom / Verschieben | Mausrad / Ziehen |
| Spiel neu starten | „NEUES SPIEL“ und anderes Land auswählen |

## Technische Grundlagen

Das Datenmodul `src/data/countries.ts` definiert 50 Hauptstädte mit Geo-Koordinaten. `src/data/europe.ts` enthält eine vorberechnete öffentliche Natural-Earth-110m-Landmaske und die geografischen Umrisse. Bei Spielstart reserviert die Engine zuerst alle einzigartigen Hauptstadtzellen und erst danach die benachbarten Startgebiete.

Kartendaten: [Natural Earth](https://www.naturalearthdata.com/), Public Domain / CC0, heruntergeladen aus `nvkelso/natural-earth-vector`. Die aufgezeichneten Hauptstadtkoordinaten sind gerundet. Ein paar Mikroinseln – insbesondere Malta – sind in der 110m-Geometrie zu klein und als separate bespielbare Sektoren ergänzt.

## Historie

- v0.7: Größere Karte, direkte Angriffe und tolerant erkannte Grenzabschnitte
- v0.6: Regional stationierte Truppen und kein 9.000er-Limit
- v0.5: Chancenbasierte KI
- v0.4: Eroberungswellen
