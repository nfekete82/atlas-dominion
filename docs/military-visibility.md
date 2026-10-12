# Militärische Länderübersicht im Echtzeitmodus

Unter den Ländernamen steht die gesamte lebende Truppenstärke: mobile Reserven + stationierte Grenztruppen + überlebende Einheiten in Angriffen, auf See und auf dem Rückweg. Bevölkerung und Truppen sind im Spiel derselbe Pool. Eine Verlegung senkt deshalb die Gesamtstärke nicht; Verluste und Wachstum verändern sie.

Die Farben vergleichen diese Summe mit der Spielersumme: Grün unter 90 %, Gelb von 90 bis einschließlich 110 %, Rot über 110 %. 100 % entspricht dem Spieler. Ohne eigene Truppen werden positive Gegnerstärken als ∞ % angezeigt; zwei leere Armeen gelten als gleich stark. Die separat angezeigte Angriffswirkung bleibt die bestehende Kampfmechanik und ist kein Truppenverhältnis.

Der Tooltip zeigt außerdem mobile und stationierte Truppen, aktive Angriffsfronten, eingesetzte Einheiten inklusive Seewegen, Stadtzahl, durchschnittlichen Ausbau, Geld und Bevölkerungswachstum pro Simulationstick. Noch reisende oder zurückkehrende Flotten zählen zur Gesamtstärke, aber nicht zu den aktiven Fronten. Stadtzahl und durchschnittlicher Ausbau berücksichtigen kontrollierte Hauptstädte und gebaute Städte; Hauptstädte zählen mit Ausbaustufe 0. Ein Tick dauert 0,25 Simulationssekunden.

Die Schrift bleibt beim Zoomen 14 CSS-Pixel groß; Outline, Schatten und dunkler Hintergrund erhalten den Kontrast über Relief. Die Übersicht zeigt höchstens 16 reguläre Labels, bei hohem Zoom mehr. Überlappende Labels werden verschoben oder ausgelassen. Das Land unter dem Mauszeiger erhält Vorrang, auch bei kleinen Territorien. Stadtmarker behalten ihre vorhandene Kollisionsprüfung.

`src/military-view.ts` kapselt die Kennzahlen und relative Stärke unabhängig von Canvas und DOM. Labels und Tooltip verwenden denselben Snapshot. Ein späterer Militäransicht-Toggle kann diesen Snapshot direkt nutzen. Die Summen entstehen beim vorhandenen Kartenupdate aus bereits erfassten Grenztruppen und Gebäuden; es gibt keinen zusätzlichen Scan der Sektoren pro Animationsframe. Formatierte Stärkeangaben werden pro Kartenupdate zwischengespeichert. Geöffnete Tooltips werden bei Kartenupdates ohne Mausbewegung erneuert.

Lokale Prüfung:

```sh
npm test
npm run build
npm --prefix tests/browser test -- cities.spec.mjs military.spec.mjs
```

Die Browserprüfung umfasst Namen und tatsächlich gezeichnete Stärkeangaben, Outline, Schriftgröße bei Zoom 100/150/200/400 %, Labelkollisionen, Tooltipwerte, Gefahrenfarbe, Live-Aktualisierung sowie die bisherigen Stadt-, DPR-, Bedienungs- und Performancetests. Screenshots liegen danach unter `tests/browser/artifacts/screenshots/military-*.png`.
