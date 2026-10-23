# Sandtextur, ruhigeres HUD und Gegenwehr

Die zweite Bildvorlage bestimmt den überarbeiteten Look: fein strukturierter Sand mit flachen Windrippen und kleinen Steinen, dunkle ruhige Menüflächen, dünne Rahmen und eine klare blaue Markierung des gewählten Tabs. Die gebürstete Metalltextur, mehrfache Innenrahmen und zusätzliche Schatten an den Katalogbildern entfallen. Auswahl bleibt kompakt links unten; Ressourcen, Radar, Katalog und sämtliche bisherigen Aktionen bleiben bedienbar. Die Produktionszeit steht neben dem Fortschrittsbalken, die Warteschlange darüber.

Der Sprite-Animator gab Treffern bisher Vorrang vor gleichzeitigem Feuer. Dadurch konnten echte Schüsse stattfinden, während der Soldat lediglich zurückzuckte. Nun gewinnt der Schuss: Er beginnt auch während einer Trefferpose sofort und läuft trotz weiterer Treffer vollständig ab. Wiederholte Treffer starten auch eine laufende Trefferpose nicht immer neu. Tod behält die höchste Priorität. Die tatsächlichen Waffenabstände, Schaden, Zielbindung und Bewegungsaufträge werden durch diese reine Präsentationsänderung nicht geändert.

## Bilddatei und Herkunft

- Workspace-Datei: [sand-ripples-v2.png](../../src/assets/reborn/sand-ripples-v2.png), 1254 × 1254 Pixel.
- Erstellung: integriertes `image_gen`-Werkzeug, Modus **Generate**, kein CLI/API-Fallback.
- Die beiden Nutzerbilder dienen als Stilreferenz; die neue Datei ist eine eigenständige Bodentextur.
- Der Renderer verwendet die Textur in feiner Bodenskalierung, mischt nur die Kanten mit versetzten Innenbereichen und verschiebt die wiederholbare Fläche deterministisch mit dem Kartenseed. Das verhindert harte Kachelnähte und gespiegelte Lichtrichtungen. Die Textur wird einmal pro Kartenaufbau eingebacken und bleibt nach Speichern/Laden pixelgleich.
- Dargestellte Sandrippen und kleine Steinchen sind begehbarer Untergrund; Felsen und ihre bisherigen Navigationsmasken bleiben unverändert.

Vollständiger verwendeter Prompt:

> Use case: stylized-concept. Asset type: production terrain texture for a classic 2D isometric desert RTS, not a screenshot. Generate one square seamless tile of warm golden desert sand, overhead orthographic ground surface only, no horizon. High quality softly stylized 3D-rendered/painted texture, matching sand-colored ceramic sci-fi units with dark bronze details. Fine believable wind-swept sand ripples in flowing irregular bands, gently undulating small dunes with subtle lit ridges, patches of compact smooth sand, sparse tiny ochre pebbles and fine granular microdetail. Broad areas of restful sand between ripple patches. Sun from upper left; shallow relief, soft warm highlights and restrained brown shade, no strong cast shadows. Dominant sand palette around RGB 222,180,113 with lighter pale gold ridges. Details should remain fine relative to a 45-pixel-tall soldier when a 1024-pixel image covers 1024 ground pixels. Seamless repeat in both axes, uniform mean brightness across edges, no vignette, no central focal point. Avoid cliffs, mountains, large rocks, pits, vegetation, footprints, tracks, buildings, units, grids, borders, labels, text, UI. The texture must not imply impassable gameplay obstacles.

## Prüfung

Build, Asset-Inventar, 45 gezielte Node-Prüfungen und alle 24 Chrome-Fälle gegen die aktualisierte Docker-Version auf Port 8095 bestanden. Der zusätzliche Gefechtsfall zeigt einen schweren Schützen unter dem gleichzeitigen Feuer zweier Gegner: Alle vier Schüsse erscheinen als Attack-Animation, einschließlich des ersten gleichzeitigen Treffers; der Abstand bleibt unverändert 1,3 Sekunden. Weitere Prüfungen erfassen Texturdetails, Produktionsanzeige, kompakte Bedienelemente, Speichern/Laden der identischen Karte und die vorhandenen Kampagnen- und Animationsabläufe.

Visuell im Browser geprüft: [Boden und HUD](sand-hud-v2.png), [Pausenmenü](simple-menu-v2.png), [Gegenwehr unter Beschuss](return-fire-v2.png).
