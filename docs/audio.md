# Alarm audio

The 17 source recordings supplied by the user are preserved in `assets/audio`. Their original filenames are recorded in `assets/audio/catalog.json`; this is also the source of the sound picker names. The Islamic section contains the supplied Mishary Alafasy Fajr adhan and the second adhan recording, whose reciter is unspecified.

Run `node scripts/prepare-audio.cjs` to decode locally with Edge and generate copies in `assets/audio/alarms` and `assets/audio/prepared`, the TypeScript catalog, Metro asset imports, and notification configuration. Copies use mono, 22.05 kHz, 16-bit PCM WAV with short edge fades. Ordinary tones use excerpts of up to 29 seconds. Both adhans use the complete prepared WAV in the app and Android service; iOS system delivery uses a 29-second excerpt from the same trimmed start. The picker shows the prepared duration.

The Alafasy recording has 19.40 seconds of leading silence/near-silence removed; the other adhan has 8.88 seconds removed. Detection requires three consecutive 20 ms windows above -50 dBFS and retains 80 ms of pre-roll to protect the first consonant. Only the opening is removed; pauses within the recitation remain. Original MP3 files are untouched. This is onset trimming, not denoising the recitation. `node --test scripts/audio-onset.test.cjs` verifies that full playback and excerpts begin within 0.2 seconds and retain their expected lengths. Full prepared WAVs add about 20 MB before packaging compression.

The notification config plugin copies excerpts into the iOS bundle and Android raw resources. AlarmKit uses `AlertConfiguration.AlertSound.named`. Android loops the resource on the alarm audio stream; its notification channel is silent to avoid overlapping players. The Refresh plugin copies full prepared adhan WAVs into Android raw resources and removes obsolete MP3 resources to avoid duplicate names. Existing Android registrations resolve the same resource names after a rebuild. Snoozing uses the same selected sound. Device default remains available.

On iOS, opening a real alarm transfers audio from the system alert to Expo Audio to avoid overlapping playback. On Android the native service keeps ownership of playback across ringing and mission screens, including when the app is backgrounded, and completion/snooze stop it explicitly. Sound previews use Expo Audio and stop on leaving the picker or backgrounding. Browser playback catches autoplay rejection and offers a Play alarm sound action; a browser is still only a preview, not reliable background scheduling.

Legacy placeholder IDs resolve to actual sounds: morning/night → Lo-fi, forest → Rooster, ocean → Wake Up, rain → Short Ring, chimes → Digital Beep. Existing saved alarms remain readable; edit/save an existing native alarm to register its new sound.

## iOS system alarm volume

The scheduler passes the saved volume to AlarmKit's native bridge. Because [AlarmKit sound configuration](https://developer.apple.com/documentation/activitykit/alertconfiguration/alertsound) exposes a named sound rather than per-alarm gain, `DaybreakAlarmSound` creates a PCM WAV in Library/Sounds with gain applied to every sample before scheduling. A 40% selection scales the original samples by 0.4, including the very first sample on the Apple alarm screen. iOS still controls the device's overall alert output level; this is relative gain, not an absolute loudness setting. Bundled and imported sounds use the same processing, including snoozes and mission backups. Device default with reduced volume uses Digital Beep, matching the foreground fallback; unspecified/100% volume preserves the original system tone. Gradual volume remains an in-app playback feature.

Prepared sounds are cached by source content and gain, and atomically published after the WAV header is finalized. Copies stay available for scheduled alarms and never overwrite another alarm's audio. An old native bridge rejects reduced-volume saves rather than silently ignoring the setting. Install a rebuilt iOS client, then edit/save existing alarms to replace their previous system registrations.

JavaScript bridge regression: `node --test scripts/ios-alarm.test.cjs`. On macOS, run the actual native PCM checks:

```sh
swiftc modules/daybreak-alarm-kit/ios/DaybreakAlarmSound.swift scripts/ios-alarm-volume/main.swift -o /tmp/refresh-alarm-volume-test
/tmp/refresh-alarm-volume-test
```

These check stereo sample gain from the first frame, distinct volume copies, cache reuse, unchanged source audio, and invalid/missing input. On a physical iPhone, compare the same tone at 100%, 40%, and 10% with the same device alert volume, Refresh terminated, and the phone locked. Repeat after changing a saved alarm, with two alarms sharing a tone at different volumes, with an import, and with snooze/mission backup. Verify foreground handoff separately; a browser cannot establish Apple system audio delivery.

## Imported sounds

Open Alarm sounds → Custom → Import audio. The system file picker accepts audio files up to 50 MB. Refresh checks the recording can be decoded, saves it locally, selects it, and offers preview playback. When editing an alarm, tap Use this sound and save the alarm.

Native imports are copied into the app's documents directory, so alarms do not depend on temporary file-picker access. Android's alarm service plays the full imported file on the alarm stream. On iOS, the native bridge creates a PCM WAV excerpt of up to 29 seconds in Library/Sounds for AlarmKit and notification alerts; in-app playback uses the full recording. The browser stores recordings in IndexedDB and sound metadata alongside saved alarms. Browser storage is local to that browser and origin, and can be removed by clearing site data.

Native builds must be rebuilt. Validate selected sounds on locked iOS 26+ devices and Android, including imported files, snooze, foreground handoff, background playback during missions, interruption, and cleanup. Windows browser tests cannot establish native audio delivery or Swift compilation. Source filenames preserve provenance; no license claims have been inferred from filenames.
