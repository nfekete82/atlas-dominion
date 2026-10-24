# Gesprochene Einheitenbestätigungen

Das Spiel verwendet 47 tatsächlich gesprochene deutsche Funkclips als lokale WAV-Assets. Nach der Beanstandung der bisherigen Preset-Akzente wurden drei fiktive deutsche Stimmen mit lokalem Qwen3-TTS VoiceDesign und Base erstellt. Alle drei wurden vom Eigentümer anhand der Vergleichsproben freigegeben und für sämtliche 47 Clips aktiviert. VoiceDesign wurde als Autorenmodell ergänzt; keine neue npm-/Python-Abhängigkeit und keine TTS-Anfrage im Spiel. Die [Herstellung, Hörabnahme und Lizenzprüfung](audio-review/2026-10-24/README.md) dokumentiert die Ablösung; die alte Bank ist gesichert.

## Stimmen und Inhalt

| Rolle | Stimme und Clips |
| --- | --- |
| Infanterie | Atlas DE A – Infanterie: acht Bewegungsbestätigungen, darunter „Verstanden!“, „Bin unterwegs!“, „Aye, aye, Sir!“ und „Jawohl!“, sowie sechs Angriffssprüche, etwa „Ziel erfasst!“, „Feuer frei!“ und „Jawohl, Kommandant!“. |
| Schwere Infanterie/Fahrzeuge | Atlas DE B – Besatzung: sechs separat eingesprochene Angriffssprüche und vier Besatzungsantworten. Schwere Infanterie verwendet daraus passende Antworten ohne Besatzungs-/Fahrzeugbegriffe. Der tiefere Charakter stammt aus der eigenen Stimme, ohne Pitch-Shift. |
| Sanitäter | Atlas DE C – Unterstützung: „Sanitäter unterwegs!“, „Ich kümmere mich darum!“, „Medizinische Unterstützung!“, „Bin zur Stelle!“. |
| Bauarbeiter | Atlas DE C – Unterstützung: „Auftrag erhalten!“, „Wird erledigt!“, „Reparatur wird durchgeführt!“, „Baustelle wird angefahren!“. Bau-/Reparatursprüche werden nur bei passenden tatsächlichen Aufträgen gewählt. |
| Luftwaffe | Atlas DE A mit etwas engerem Funkband: „Roger!“, „Kurs bestätigt!“, „Wir heben ab!“, „Flugroute bestätigt!“. |
| Transportheli | „Landezone bestätigt!“, „Bereit zur Aufnahme!“, „Truppen werden abgesetzt!“ für Aufnahme und Absetzen. |

Dazu kommen zwei allgemeine Unterstützerantworten und je zwei Stop-/Haltebestätigungen für alle drei Stimmen. Die vollständigen Texte, Dauern und Prüfsummen stehen in `src/assets/reborn/voices/manifest.json`, Herkunft und Erzeugung in der dortigen `ORIGIN.md`.

## Funkklang und Einstellungen

Die Clips wurden mit leichtem Hoch-/Tiefpass, sanfter Kompression, geringer Sättigung und zwei sehr leisen kurzen Funkschalter-Klicks bearbeitet. Sprache bleibt im Vordergrund; dauerhaftes Rauschen und Echo entfallen. Während einer Meldung werden bestehende Effekte und Atmosphäre behutsam auf 55 % abgesenkt. Es gibt keine künstliche extreme Tonhöhenabsenkung.

Unter Sound und Optionen gibt es **Einheiten-Sprachausgabe** und einen eigenen Regler **Stimmenlautstärke**. Beide werden zusammen mit den bestehenden Einstellungen lokal gespeichert; ältere Einstellungen behalten sinnvolle Standardwerte. Master-Lautstärke, Sound-Aus, Stimmen-Aus und Stimmenlautstärke null verhindern neue Wiedergabe und stoppen laufende Sprache. „Funkverbindung testen“ spielt einen echten Sprachclip und funktioniert auch im pausierten Einstellungsdialog.

## Befehle und Begrenzung

`Input` meldet genau ein `PlayerOrder`-Ereignis nach einer erfolgreichen Spieleraktion. Die Bestätigung enthält einen tatsächlich beteiligten eigenen lebenden Sprecher. Unterstützeraufträge, Baustellen, Ein-/Ausladen und Stop/Halten verwenden ebenfalls diesen Ablauf. Gruppen erzeugen eine gemeinsame Meldung. Die Simulation und ihre KI rufen den Sprachkanal nicht auf; automatische Schüsse, Behandlung und Produktion erzeugen keine Einheiten-Sprachbestätigungen. Die bisherigen kleinen Auswahl-/Produktionssignale bleiben UI-Effekte.

Der globale Sprachkanal spielt höchstens einen Clip. Gleiche Clip-ID und gleicher Text werden nicht direkt hintereinander gewählt. Normale Meldungen warten mindestens 0,95 Sekunden zwischen Starts und unterbrechen keine noch laufende Meldung. Wichtige Angriffs-, Absetz- und Haltebefehle können eine Meldung niedrigerer Priorität nach frühestens 0,18 Sekunden ersetzen. Verdrängte oder unterdrückte Meldungen werden verworfen; es gibt keine Befehlswarteschlange.

Die Dateien werden während des normalen Ladens asynchron vorgeladen und nach der ersten Benutzerinteraktion einmalig dekodiert. Ein Befehl startet bei bereitem Kanal synchron im erfolgreichen Eingabeablauf. Während des ersten Audio-Unlocks wird höchstens die letzte frische Bestätigung für maximal 350 ms gehalten. Pause, Stummschaltung oder Szenenwechsel löschen auch diese Bestätigung. Die Simulation wartet nie auf Audio oder Decodierung.

Pause stoppt laufende Einheitenmeldungen. Das explizite Hörbeispiel darf im Audio-Dialog laufen und endet beim Schließen des Dialogs. Laden, Neustart und Szenenwechsel stoppen alte Quellen; ein Neustart verwendet den bereits dekodierten festen Clipbestand erneut. Unsichtbare Dokumente schalten auch laufende Vorschauen und Atmosphäre ab. Beendete oder gestoppte Quellen trennen sämtliche Audioknoten.

## Prüfung und Grenzen

```sh
npm run build
node --test tests/reborn-radio.test.mjs tests/reborn-polish.test.mjs
npm --prefix tests/browser test -- --grep 'radio:|polish: live rifle|polish: real dual'
```

Die fokussierten Prüfungen decken alle WAV-Dateien, Prüfsummen, PCM-Format, Pegel, passende Rollen, Varianten, Priorität und Sprachbegrenzung ab. Browserfälle verwenden reale Mausbefehle, den echten Audiographen, Gruppen, Angriff, alle zehn Typen, Heilung, Reparatur, Bau, Transport, ungültige Aufträge, autonome Befehle, Optionen, Pause und Neustart. Vorhandene Kampf-/Audioeffekte werden mitgeprüft.

Die Stimmen sind synthetisch erzeugt. Das positive Hörurteil zu A/B/C stammt vom Eigentümer anhand der Vergleichsproben. Die lokale Spracherkennungsprüfung erkennt die Wörter aller 47 neuen Meldungen vollständig, mit Abweichungen nur bei Großschreibung und Interpunktion. Das ersetzt keine individuelle menschliche Prüfung jedes Clips. Schnelle unterdrückte Befehle erhalten absichtlich keine spätere Bestätigung. Nach einer sehr frühen Eingabe kann die erste Bestätigung entfallen, wenn das Audio-Initialisieren länger als 350 ms dauert. Die vorhandenen Systemstimmen und TTS-Modelle werden durch diese Änderung nicht verändert.

Prüfstand: Build erfolgreich; **12/12** fokussierte Node-Prüfungen und **5/5** Browserfälle bestanden. Alle **47/47** Sprachclips wurden im Browser erfolgreich dekodiert; der echte Audiograph liefert beim Abspielen ein messbares Sprachsignal. `git diff --check` ohne Befund. Vorhandene lokale Änderungen wurden erhalten; keine Stashes verändert, keine Commits oder Pushes ausgeführt.
