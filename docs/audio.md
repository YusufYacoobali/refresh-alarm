# Alarm audio

The 17 source recordings supplied by the user are preserved in `assets/audio`. Their original filenames are recorded in `assets/audio/catalog.json`; this is also the source of the sound picker names. The Islamic section contains the supplied Mishary Alafasy Fajr adhan and the second adhan recording, whose reciter is unspecified.

Run `node scripts/prepare-audio.cjs` to decode locally with Edge and generate the bundled copies in `assets/audio/alarms`, plus the TypeScript catalog, static Metro asset imports, and notification sound configuration. Copies use mono, 22.05 kHz, 16-bit PCM WAV, retain at most the first 29 seconds, and have short edge fades to avoid clicks. A peak limiter reduces clipping without amplifying quiet recordings. Ordinary alarm tones use these clips everywhere. Entries marked `fullPlayback` (both adhans) play the original full MP3 in the app and the Android alarm service; iOS system delivery uses a short WAV excerpt. The picker discloses this distinction and shows the full playback duration.

The notification config plugin copies the WAVs into the iOS main bundle and Android raw resources. The native AlarmKit bridge checks the selected resource exists and uses `AlertConfiguration.AlertSound.named`. Android's Refresh alarm service loops the chosen resource on the alarm audio stream; its notification channel is silent to avoid overlapping players. The Refresh config plugin additionally copies full adhan MP3s into Android raw resources. Snoozing uses the same selected sound. Device default remains available.

On iOS, opening a real alarm transfers audio from the system alert to Expo Audio to avoid overlapping playback. On Android the native service keeps ownership of playback across ringing and mission screens, including when the app is backgrounded, and completion/snooze stop it explicitly. Sound previews use Expo Audio and stop on leaving the picker or backgrounding. Browser playback catches autoplay rejection and offers a Play alarm sound action; a browser is still only a preview, not reliable background scheduling.

Legacy placeholder IDs resolve to actual sounds: morning/night → Lo-fi, forest → Rooster, ocean → Wake Up, rain → Short Ring, chimes → Digital Beep. Existing saved alarms remain readable; edit/save an existing native alarm to register its new sound.

## Imported sounds

Open Alarm sounds → Custom → Import audio. The system file picker accepts audio files up to 50 MB. Refresh checks the recording can be decoded, saves it locally, selects it, and offers preview playback. When editing an alarm, tap Use this sound and save the alarm.

Native imports are copied into the app's documents directory, so alarms do not depend on temporary file-picker access. Android's alarm service plays the full imported file on the alarm stream. On iOS, the native bridge creates a PCM WAV excerpt of up to 29 seconds in Library/Sounds for AlarmKit and notification alerts; in-app playback uses the full recording. The browser stores recordings in IndexedDB and sound metadata alongside saved alarms. Browser storage is local to that browser and origin, and can be removed by clearing site data.

Native builds must be rebuilt. Validate selected sounds on locked iOS 26+ devices and Android, including imported files, snooze, foreground handoff, background playback during missions, interruption, and cleanup. Windows browser tests cannot establish native audio delivery or Swift compilation. Source filenames preserve provenance; no license claims have been inferred from filenames.
