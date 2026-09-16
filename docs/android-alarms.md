# Android alarm delivery

Refresh uses a local Kotlin Expo module, not notification timers, for Android alarms. Build a new native app after these changes (`npx expo prebuild --platform android` then `npx expo run:android`). For a standalone local build, use `npx expo run:android --variant release` with your signing configuration.

If a Windows release build fails with `Metaspace`, run from `android/` with a larger Gradle memory limit (the ARM64 APK runs independently of Metro):

```powershell
.\gradlew.bat :app:assembleRelease '-Dorg.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1536m' -PreactNativeArchitectures=arm64-v8a --max-workers=2
```

- `AlarmManager.setAlarmClock` schedules one-off, weekly, and fixed snooze alarms. Registration IDs remain separate from alarm IDs for safe edit/rollback behavior.
- The receiver starts a foreground media-playback service. It loops the selected audio with `USAGE_ALARM`, vibrates, and posts an ongoing alarm notification with a full-screen activity intent.
- The activity applies lock-screen flags before creation, resume, and new-intent delivery. The service also refreshes an existing activity before posting the notification so a stopped task is eligible to appear while locked. The alarm notification requests immediate foreground-service visibility. Startup routes directly to the active alarm, and an occurrence ID prevents polling from reopening a mission already in progress.
- The service owns sound across screen transitions. Duplicate service starts do not restart audio, and replayed commands cannot resurrect a dismissed alarm. Completion/snooze remove the foreground notification and release audio, vibration, and the wake lock.
- Each alarm has a **Silent during missions** setting. The mission screen also offers a sound toggle. On Android, silence pauses alarm sound and repeating vibration while missions are visible; backgrounding/locking restores ringing. Native visibility checks reject late mute requests after backgrounding, and a renewable 30-second lease restores ringing if JavaScript stalls. Older alarms keep their existing audible behavior.
- Full-screen access, exact-alarm access, and ringing-channel notification importance have Settings rows and are checked before saving. A disabled/lowered channel can prevent full-screen display even when the other permissions are allowed. Android may show a heads-up notification while the phone is unlocked; tapping it opens the wake-up screen.
- Schedules are persisted natively and restored after boot, package replacement, clock/time-zone changes, and exact-alarm access restoration. Repeating alarms schedule their next occurrence when fired. Expired fixed alarms are not replayed after reboot.
- Existing future notification registrations migrate on launch/resume when access is granted. An already-snoozed legacy alarm is left intact until it completes; its repeating parent migrates on a subsequent resume.
- Both adhans are bundled in full for Android service playback. Ordinary tones loop their prepared WAV clips. Missing audio falls back to the device alarm tone. Alarm volume and the user's Do Not Disturb rules still apply.

## Device verification

Validation on 2026-09-16: app/native Kotlin compilation, merged manifest checks, four JVM timing tests, 11 TypeScript utility tests, four config-plugin lifecycle/idempotence tests, TypeScript checking, and six targeted browser flow tests passed on Windows. The browser tests cover silent mission transitions, saved preferences, completion failure/retry, snooze, audio cleanup, and small-screen shake layout. No physical Android device was connected; the installed emulator could not start because its system image is missing. The lock-screen and background checks below still require a phone with the new native build.

1. Install the new native build and allow notifications, Alarms & reminders, and Lock-screen alarms. With each permission denied, verify the app explains what is missing when saving.
2. Schedule a two-minute test, lock the phone, and swipe Refresh from recents. Confirm the display wakes, the selected sound loops, and the alarm screen appears over the lock screen. An Android force-stop intentionally prevents future app delivery until the app is opened again.
3. Complete math, memory, and shake missions with Silent during missions both off and on. Toggle sound during a mission, advance to another mission, then lock/background the phone. Confirm silence persists between missions, ringing resumes in the background, and completion stops sound/vibration and removes the notification. Rapidly tap dismiss/snooze and confirm a single action; a failed completion save should offer retry without repeating missions.
4. Test Snooze Off and 5-minute snooze. Verify only the intended snoozed alarm rings and its sound matches.
5. Test a weekday repeat across midnight, a device reboot, clock/time-zone change, and app update. Verify the next occurrence remains registered and canceled/disabled alarms stay canceled.
6. Test both full adhans, default alarm sound, alarm volume zero/nonzero, Do Not Disturb, and an incoming call. Test locked and unlocked delivery on both a Pixel and a device with manufacturer battery restrictions.
7. Choose a photo background, restart the app, and confirm it survives and appears when the alarm rings. Remove it and confirm the default artwork returns.

References: [Android alarms](https://developer.android.com/develop/background-work/services/alarms), [full-screen permission](https://developer.android.com/about/versions/14/behavior-changes-14#secure-fsi).
