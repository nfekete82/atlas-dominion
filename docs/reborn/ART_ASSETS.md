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

## Infanterie / vorherige Fassung, nicht mehr geladen

Ergebnis: `src/assets/reborn/infantry-walk.png`, 1536 × 1024, RGBA, 8 Spalten × 4 Reihen. Referenz ist der aus `infantry.png` erzeugte erste Richtungsatlas. Das PNG besitzt echte Transparenz, auch wenn Bildbetrachter die unsichtbaren RGB-Hintergrundwerte grau/braun anzeigen können. Diese Fassung wurde durch den unten dokumentierten Laufzyklus ersetzt. Die damalige ergänzende Gelenkbewegung wurde entfernt.

Finaler Korrekturprompt:

> Edit target: the attached 8-column 4-row infantry atlas. Preserve the exact regular grid, identical beige and blue armored rifleman, 1536x1024 image size and four row directions. CRITICAL FIX 1: remove every single background pixel and all floor shadows; ALL SPACE AROUND EVERY SPRITE MUST BE TRUE ALPHA TRANSPARENCY, no gray, brown, gradient, backdrop, ground or shadow. Clean sharp alpha edges. CRITICAL FIX 2: each row must be a real eight-frame walk loop, not the same walking pose. Keep torso, helmet and weapon positions very stable; animate the legs clearly. In EVERY ROW: column 1 LEFT LEG FORWARD RIGHT LEG BACK, column 2 left foot planted and right knee passing, column 3 legs parallel beneath body, column 4 RIGHT LEG FORWARD LEFT LEG BACK, column 5 right foot planted and left knee passing, column 6 legs parallel beneath body, column 7 LEFT LEG FORWARD RIGHT LEG BACK, column 8 returning to first pose. Legs alternate as an actual walking gait. No duplicated eight identical poses. Eight columns, four rows. Row directions and character appearance unchanged. Entire sheet transparent. Each sprite isolated inside its original equal-sized cell with stable foot baseline. No labels or grid lines.

Fraktionsfarben werden zur Laufzeit aus den blauen Materialpixeln abgeleitet. Es werden keine nachträglichen Bodenschatten hinzugefügt.


## Infanterie / überarbeiteter Laufzyklus

Ergebnis: `src/assets/reborn/infantry-walk-v2.png`, 1254 × 1254, RGBA, 4 Spalten × 4 Richtungsreihen. Eingebautes Imagegen-Werkzeug, kein CLI/API-Fallback. Die vorherige Fassung bleibt erhalten, wird aber nicht mehr geladen. Der Renderer zeichnet ganze Posen und richtet Helm und Bodenposition je Pose aus; die zusätzlichen Beinrotationen wurden entfernt. Die vier Phasen ersetzen die vorherige Folge sehr ähnlicher Bilder. Das ist ein begrenzter Sprite-Laufzyklus, keine vollständige Skelettanimation.

Generierungsprompt:

> Use case: stylized-concept. Asset type: production RTS infantry walk animation sprite atlas. Reference image is character identity/material reference only. Create ONE transparent PNG sheet, exactly FOUR columns and FOUR rows, equal-sized cells, no gutters or text. 16 full-body sprites of the SAME beige-and-blue armored rifle soldier. Fixed orthographic camera looking down 35 degrees, identical proportions and helmet height, identical centered pelvis and ground baseline in all cells. Rows are four directions: row 1 facing right EAST in profile; row 2 facing lower right SOUTHEAST; row 3 facing down SOUTH toward camera; row 4 facing up NORTH away from camera. CRITICAL: the four columns are DIFFERENT stages of a physically correct WALK CYCLE, not repeated poses: column1 LEFT BOOT far FORWARD heel on ground, RIGHT BOOT far BACK toe on ground; column2 LEFT LEG straight planted under pelvis, RIGHT KNEE bent swinging past it; column3 RIGHT BOOT far FORWARD heel on ground, LEFT BOOT far BACK toe on ground; column4 RIGHT LEG straight planted under pelvis, LEFT KNEE bent swinging past it. Legs alternate visibly. Boots must change position substantially between columns; no identical poses. Soldier holds rifle firmly with both hands at chest, aimed in facing direction; upper body stable, very slight vertical gait. Walk rather than sprint. Match supplied character's blue visor, backpack, tan plates, dark blue undersuit, blue rifle energy strip. Crisp rendered game art, clear silhouettes. Every character complete and separate within its cell with transparent padding. True alpha transparency including between legs. No floor, no ground, NO SHADOWS, no glow outside character, no labels.

Finaler Korrekturprompt:

> Use case: precise-object-edit. Edit target: supplied transparent 4x4 soldier animation sheet. Fix ONLY the LOWER BODY WALK POSES in columns THREE and FOUR of rows ONE, TWO and THREE. Keep all upper bodies, helmets, rifles, armor identity, camera, sprite locations, sizes and the entire fourth row exactly unchanged. The problem is columns 1 and 3 currently repeat the same leading leg; they must show OPPOSITE legs. In column3 switch which leg leads: the leg that was forward in column1 is now behind the torso; the other leg is forward. In column4 switch the supporting and swinging leg relative to column2. This is a left-right alternating walking sequence. In the third row facing viewer, column3 MUST show the boot on the VIEWER'S RIGHT extended toward the viewer and the boot on the VIEWER'S LEFT behind, with that left knee lifted. Column4 also leads with the other leg from column2. On rows1&2 the armor surfaces should make the alternating lead leg obvious. Do not mirror entire sprites or change rifle side. Keep all feet within cells. Exactly 4 columns x4 rows on same square sheet. Preserve genuinely transparent background, no shadows, no text.

## Sandstein / feine Materialdetails

Ergebnis: `src/assets/reborn/sandstone-detail.png`, 1254 × 1254, RGB. Eingebautes Imagegen-Werkzeug. Der Renderer verwendet nur die hochfrequenten Helligkeitsdetails dieses Materials auf Felsflächen, während Beleuchtung, Umrisse und Hindernispositionen aus der Landschaft stammen. Ein begrenzter Schärfepass stärkt die Fels- und Schattenkanten. Die Materialtextur ersetzt keine vollständige höher aufgelöste Landschaft.

Finaler Prompt:

> Use case: stylized-concept. Asset type: seamless sandstone rock surface detail texture for a top-down desert RTS, a material map rather than an environment picture. Fill the entire square image edge to edge with crisp fine weathered golden tan sandstone. Flat orthographic close-up of vertical rock face surface, no perspective recession. Intricate thin angular fissures, tiny chipped mineral facets, very fine horizontal sediment layers, subtle natural warm ochre color variation. Small scale detailed hard-edged stone texture, not large boulders and not gravel. Lighting neutral and even so game renderer can apply its own lighting. Seamless repeating edges, similar overall color and detail density across the whole image. Game-ready painted-realistic 3D material, sharp and dry, matching beige bronze sci-fi desert strategy art. No ground, no landscape, no mountains, no objects, no cast shadows, no vignette, no depth of field, no text, no watermark.
