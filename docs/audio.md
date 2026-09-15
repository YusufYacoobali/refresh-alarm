# Alarm audio

The 17 source recordings supplied by the user are preserved in `assets/audio`. Their original filenames are recorded in `assets/audio/catalog.json`; this is also the source of the sound picker names. The Islamic section contains the supplied Mishary Alafasy Fajr adhan and the second adhan recording, whose reciter is unspecified.

Run `node scripts/prepare-audio.cjs` to decode locally with Edge and generate the bundled copies in `assets/audio/alarms`, plus the TypeScript catalog, static Metro asset imports, and notification sound configuration. Copies use mono, 22.05 kHz, 16-bit PCM WAV, retain at most the first 29 seconds, and have short edge fades to avoid clicks. A peak limiter reduces clipping without amplifying quiet recordings. Ordinary alarm tones use these clips everywhere. Entries marked `fullPlayback` (both adhans) play the original full MP3 in the app and use a short WAV excerpt for system delivery. The picker discloses this distinction and shows the full playback duration.

The existing notification config plugin copies the WAVs into the iOS main bundle and Android raw resources. The native AlarmKit bridge checks the selected resource exists and uses `AlertConfiguration.AlertSound.named`. Android uses a separate versioned notification channel per sound because channel sound settings are immutable once created. Snoozing uses the same selected sound. Device default remains available.

Opening a real alarm transfers its audio from the system alert to the app to avoid overlapping playback. Expo Audio loops it through missions, supports background playback/lock-screen controls, and stops on route exit (completion or snooze). Sound previews stop on leaving the picker or backgrounding. Browser playback catches autoplay rejection and offers a Play alarm sound action; a browser is still only a preview, not reliable background scheduling.

Legacy placeholder IDs resolve to actual sounds: morning/night → Lo-fi, forest → Rooster, ocean → Wake Up, rain → Short Ring, chimes → Digital Beep. Existing saved alarms remain readable; edit/save an existing native alarm to register its new sound.

Native builds must be rebuilt. Validate selected sounds on locked iOS 26+ devices and Android, including snooze, foreground handoff, background playback during missions, interruption, and cleanup. Windows browser tests cannot establish native audio delivery or Swift compilation. Source filenames preserve provenance; no license claims have been inferred from filenames.
