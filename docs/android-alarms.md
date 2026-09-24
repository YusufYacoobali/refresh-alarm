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
- **Sound & volume** groups the tone, individual volume (10–100%), and gradual increase (off, 30 seconds, 1 minute, or 2 minutes). New alarms use 80% with a 30-second increase; existing alarms retain device volume and no ramp until edited. Android sets the alarm stream to the selected level, ramps player gain from 10% to full, and restores the original stream level when stopped unless the user changed it while ringing. Native volume steps can round the requested percentage.
- Every mission has a visible, required 60-second deadline. Starting the next mission resets it; answers, card flips, shakes, and silence heartbeats do not. The native deadline survives service recreation. On expiry the service restores the chosen volume immediately, reposts the full-screen notification, and changes the occurrence ID so the app returns to ringing and restarts the entire sequence. Completion destroys the timer with the service. A foreground JavaScript equivalent supports browser flow verification.
- The editor keeps repeat and label visible, with expandable Sound & volume, Wake-up missions, and More options sections and a fixed Save button. Both the animated sun and the sun in the default ringing background are removed; custom photos still work.
- Full-screen access, exact-alarm access, and ringing-channel notification importance have Settings rows and are checked before saving. A disabled/lowered channel can prevent full-screen display even when the other permissions are allowed. Android may show a heads-up notification while the phone is unlocked; tapping it opens the wake-up screen.
- Schedules are persisted natively and restored after boot, package replacement, clock/time-zone changes, and exact-alarm access restoration. Repeating alarms schedule their next occurrence when fired. Expired fixed alarms are not replayed after reboot.
- Existing future notification registrations migrate on launch/resume when access is granted. An already-snoozed legacy alarm is left intact until it completes; its repeating parent migrates on a subsequent resume.
- Both adhans are bundled in full for Android service playback. Ordinary tones loop their prepared WAV clips. Missing audio falls back to the device alarm tone. Alarm volume and the user's Do Not Disturb rules still apply.

## Device verification

Validation on 2026-09-16: Android release compilation, seven JVM timing/playback tests, 12 TypeScript utility tests, four config-plugin lifecycle/idempotence tests, TypeScript checking, and 19 browser flow tests passed on Windows. Browser coverage includes saved per-alarm volume, gradual audio gain, idle reminders, activity renewal, completion cancellation, disabled reminders, silent missions, completion failure/retry, snooze, sound selection, mission sequences, time editing, and small-screen shake layout. Two visual/feature checks were repeated after the final background edit. No physical Android device was connected; the installed emulator could not start because its system image is missing. The lock-screen and background checks below still require a phone with the new native build.

1. Install the new native build and allow notifications, Alarms & reminders, and Lock-screen alarms. With each permission denied, verify the app explains what is missing when saving.
2. Schedule a two-minute test, lock the phone, and swipe Refresh from recents. Confirm the display wakes, the selected sound loops, and the alarm screen appears over the lock screen. An Android force-stop intentionally prevents future app delivery until the app is opened again.
3. Complete math, memory, and shake missions with Silent during missions both off and on. Toggle sound during a mission, advance to another mission, then lock/background the phone. Confirm silence persists between missions, ringing resumes in the background, and completion stops sound/vibration and removes the notification. Rapidly tap dismiss/snooze and confirm a single action; a failed completion save should offer retry without repeating missions.
4. Test Snooze Off and 5-minute snooze. Verify only the intended snoozed alarm rings and its sound matches.
5. Test a weekday repeat across midnight, a device reboot, clock/time-zone change, and app update. Verify the next occurrence remains registered and canceled/disabled alarms stay canceled.
6. Test both full adhans, default alarm sound, alarm volume zero/nonzero, Do Not Disturb, and an incoming call. Test locked and unlocked delivery on both a Pixel and a device with manufacturer battery restrictions.
7. Choose a photo background, restart the app, and confirm it survives and appears when the alarm rings. Remove it and confirm the default artwork returns.
8. Save two alarms at different volumes and ramp durations. Verify a quiet start, the chosen final level, and restoration after stop and snooze. Repeat with the device alarm stream initially muted and with a hardware volume change while ringing.
9. Start a silent mission and leave it untouched for 60 seconds, both visible and locked. Confirm sound/vibration return, the alarm screen opens, and missions restart. Answer at 50 seconds and verify the next reminder waits another full minute. Complete before the deadline and confirm no later re-ring. Repeat with the reminder disabled and after service recreation.

## Ringing background asset

`assets/art/valley-no-sun.png` is a non-destructive edit of `assets/art/valley.png`, generated with the built-in image editing tool. Only the ringing screen uses it.

Final prompt: “Edit target: supplied valley.png, a portrait clay-style mountain landscape used as an alarm app background. Precise object removal: completely remove the large glowing sun disk above the central mountain valley. Fill its location seamlessly with the existing dusky purple/peach sky and distant mountain silhouettes; leave a subtle diffuse twilight horizon glow but NO sun, moon, orb, disk, or replacement celestial body. Preserve the original portrait composition, mountains, river, trees, stars, clay material, dark spacious upper sky, and all remaining details as closely as possible. No text or interface elements. This is a clean background asset for the project.”

References: [Android alarms](https://developer.android.com/develop/background-work/services/alarms), [full-screen permission](https://developer.android.com/about/versions/14/behavior-changes-14#secure-fsi).

## Reliability changes · 23 September 2026

The reported 07:20 → 07:28 delay could not be reproduced on a physical phone here. Schedule calculation still targets the chosen local hour/minute, with seconds and milliseconds cleared, using `setAlarmClock` rather than an inexact timer.

A real startup gap was fixed: AlarmManager releases its wake lock when the receiver returns, so the phone could sleep before the audio service acquired its own lock. `AlarmHandoff` now holds a bounded 30-second partial wake lock across that handoff and releases it once the service owns its playback lock. Startup failure and service destruction also release it. See [Android AlarmManager wake-lock guidance](https://developer.android.com/reference/android/app/AlarmManager).

Failure to schedule the next repeating occurrence no longer prevents the current occurrence from ringing. A three-second preparation watchdog switches to the device alarm tone if the selected recording's decoder stalls. Logcat tag `RefreshAlarm` records scheduled, received, service-started and audio-started timestamps to distinguish OS delivery delays from startup/audio delays. No alarm label or audio contents are logged.

Build the native app again; a JavaScript-only update cannot install these changes or the newly prepared audio resources. Repeat the locked-phone overnight test and collect `adb logcat -s RefreshAlarm` if it is late. The 19.40/8.88-second adhan lead-ins are separate defects and do not explain an eight-minute delay by themselves.
