# Reborn / Art-Überarbeitung

Erzeugt mit dem eingebauten Imagegen-Werkzeug; kein CLI/API-Fallback. Die ursprünglichen Grafiken bleiben erhalten. Die Bastion unter `src/assets/reborn/bastion.png` ist eine erzeugte Nachbildung im passenden Stil. Die Original-PNG `7bd9cd32-256a-45dd-bd71-a69bfce73178.png` des Nutzers war wegen der macOS-Downloadsperre nicht lesbar. Sie kann später direkt die Nachbildung unter demselben Projektpfad ersetzen.

## Bastion

Ergebnis: `src/assets/reborn/bastion.png`, 1254 × 1254, RGBA. Die Spielgrafik ist eine Nachbildung, keine unveränderte Kopie der Nutzervorlage. Ihre blauen Lichtpixel werden zur Laufzeit für gegnerische und neutrale Besitzer umgefärbt.

Prompt:

> Use case: precise-object-edit. Asset type: transparent RTS control-point sprite. The last attached image is the user's chosen bastion relay. Reproduce that exact single object with its original isometric camera, beige and bronze circular mechanical foundation, tall central mast and smaller side mast, circular dish and vivid blue/cyan illuminated vertical tubes and foundation ring. Preserve its design, proportions, all material colors, upper-left lighting and fine details. Isolate the existing bastion as a clean PNG with genuinely transparent background, tight padding and entire object intact. No floor, no cast shadow, no floating oval, no additional objects, no text, no grid, no backdrop. This is for integration as the original-looking bastion asset in an existing game.

## Terrain

Ergebnis: `src/assets/reborn/desert-fine.png`. Referenz: `src/assets/reborn/desert.png`. Tatsächliche Ausgabe: 1254 × 1254, RGB. Die im Prompt erbetene höhere Pixelzahl wurde vom Werkzeug nicht geliefert; der Renderer ergänzt deshalb eine Materialdarstellung mit feiner Körnung in Weltauflösung, während das Gelände seine Konturen behält.

Finaler Prompt:

> Use case: precise-object-edit. Asset type: production terrain image for a polished classic isometric 2D RTS. Edit the provided desert landscape. Output a SQUARE HIGH RESOLUTION 3840x3840 map. Preserve exactly the map's camera, overhead oblique lighting, every cliff and hill silhouette and its location and the open traversable corridors; geometry must align with the source for collision mapping. Change ground material scale dramatically: the sand, gravel and cracked earth must be FIVE TIMES FINER relative to these cliffs. Replace the huge cracked-earth polygon plates with very fine hairline microcracks and compact smooth dusty sand, tiny grains and pinhead gravel. No large cobbles or visible chunky ground texture. Rich but subtle finely resolved ochre sand, warm stone cliffs, very restrained detail density, crisp premium RTS terrain readable under tiny infantry and a detailed beige headquarters. Maintain the existing cliff colors and coherent upper-left sunlight. No new cliffs, no structures, no units, no markings, no grid, no UI, no text, no repeated tiles. Keep landform geometry; only refine soil surface resolution and scale.

## Infanterie

Ergebnis: `src/assets/reborn/infantry-walk.png`, 1536 × 1024, RGBA, 8 Spalten × 4 Reihen. Referenz ist der aus `infantry.png` erzeugte erste Richtungsatlas. Das PNG besitzt echte Transparenz, auch wenn Bildbetrachter die unsichtbaren RGB-Hintergrundwerte grau/braun anzeigen können. Die Browserprüfung zählt transparente und deckende Pixel. Kontinuierliche Gelenkbewegung im Renderer ergänzt die nicht durchgehend gleichmäßigen generierten Schrittposen.

Finaler Korrekturprompt:

> Edit target: the attached 8-column 4-row infantry atlas. Preserve the exact regular grid, identical beige and blue armored rifleman, 1536x1024 image size and four row directions. CRITICAL FIX 1: remove every single background pixel and all floor shadows; ALL SPACE AROUND EVERY SPRITE MUST BE TRUE ALPHA TRANSPARENCY, no gray, brown, gradient, backdrop, ground or shadow. Clean sharp alpha edges. CRITICAL FIX 2: each row must be a real eight-frame walk loop, not the same walking pose. Keep torso, helmet and weapon positions very stable; animate the legs clearly. In EVERY ROW: column 1 LEFT LEG FORWARD RIGHT LEG BACK, column 2 left foot planted and right knee passing, column 3 legs parallel beneath body, column 4 RIGHT LEG FORWARD LEFT LEG BACK, column 5 right foot planted and left knee passing, column 6 legs parallel beneath body, column 7 LEFT LEG FORWARD RIGHT LEG BACK, column 8 returning to first pose. Legs alternate as an actual walking gait. No duplicated eight identical poses. Eight columns, four rows. Row directions and character appearance unchanged. Entire sheet transparent. Each sprite isolated inside its original equal-sized cell with stable foot baseline. No labels or grid lines.

Fraktionsfarben werden zur Laufzeit aus den blauen Materialpixeln abgeleitet. Es werden keine nachträglichen Bodenschatten hinzugefügt.
