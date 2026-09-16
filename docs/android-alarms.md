# Android alarm delivery

Refresh uses a local Kotlin Expo module, not notification timers, for Android alarms. Build a new native app after these changes (`npx expo prebuild --platform android` then `npx expo run:android`). For a standalone local build, use `npx expo run:android --variant release` with your signing configuration.

- `AlarmManager.setAlarmClock` schedules one-off, weekly, and fixed snooze alarms. Registration IDs remain separate from alarm IDs for safe edit/rollback behavior.
- The receiver starts a foreground media-playback service. It loops the selected audio with `USAGE_ALARM`, vibrates, and posts an ongoing alarm notification with a full-screen activity intent.
- The activity shows over the lock screen only while an alarm is active. It keeps the screen awake and directs volume keys to alarm volume. The service stays audible across missions and backgrounding; completion/snooze stop it.
- Full-screen access and exact-alarm access have their own Settings rows and are checked before saving. Android may show a heads-up notification while the phone is unlocked; tapping it opens the wake-up screen.
- Schedules are persisted natively and restored after boot, package replacement, clock/time-zone changes, and exact-alarm access restoration. Repeating alarms schedule their next occurrence when fired. Expired fixed alarms are not replayed after reboot.
- Existing future notification registrations migrate on launch/resume when access is granted. An already-snoozed legacy alarm is left intact until it completes; its repeating parent migrates on a subsequent resume.
- Both adhans are bundled in full for Android service playback. Ordinary tones loop their prepared WAV clips. Missing audio falls back to the device alarm tone. Alarm volume and the user's Do Not Disturb rules still apply.

## Device verification

Native Kotlin compilation, merged manifest checks, and four JVM timing tests passed on Windows. No physical Android device was connected during implementation; the items below still require device testing.

1. Install the new native build and allow notifications, Alarms & reminders, and Lock-screen alarms. With each permission denied, verify the app explains what is missing when saving.
2. Schedule a two-minute test, lock the phone, and swipe Refresh from recents. Confirm the display wakes, the selected sound loops, and the alarm screen appears over the lock screen. An Android force-stop intentionally prevents future app delivery until the app is opened again.
3. Complete math, memory, and shake missions. Confirm shaking listens immediately, the sound continues between missions and in the background, and completion stops sound/vibration and removes the notification.
4. Test Snooze Off and 5-minute snooze. Verify only the intended snoozed alarm rings and its sound matches.
5. Test a weekday repeat across midnight, a device reboot, clock/time-zone change, and app update. Verify the next occurrence remains registered and canceled/disabled alarms stay canceled.
6. Test both full adhans, default alarm sound, alarm volume zero/nonzero, Do Not Disturb, and an incoming call. Test locked and unlocked delivery on both a Pixel and a device with manufacturer battery restrictions.
7. Choose a photo background, restart the app, and confirm it survives and appears when the alarm rings. Remove it and confirm the default artwork returns.

References: [Android alarms](https://developer.android.com/develop/background-work/services/alarms), [full-screen permission](https://developer.android.com/about/versions/14/behavior-changes-14#secure-fsi).
