# Physical-device verification

JavaScript compilation is verified separately from Swift compilation and actual system delivery. Use a signed development build on a physical iOS 26+ device for the following checks before relying on Daybreak as a primary alarm.

1. Confirm Expo autolinks `DaybreakAlarmKitModule`, build with the iOS 26+ SDK, and verify Settings describes AlarmKit rather than notification fallback.
2. Allow and deny AlarmKit permission. Denial must leave an attempted alarm disabled and display a recoverable error; allow permission from system Settings and retry.
3. Schedule a two-minute test, lock the phone, enable Silent / Focus, and confirm the system alarm rings with the device default sound.
4. Tap **Wake up** from the system alarm with Daybreak terminated. Confirm the correct alarm opens and its configured challenge runs. Repeat while Daybreak is already open.
5. Stop a one-off alarm and a weekday alarm from both the app and system UI. Confirm the one-off is not scheduled again, and the weekday alarm's future occurrence remains correct.
6. Edit, disable, and delete scheduled alarms, including a snoozed alarm. Confirm old alerts are cancelled and no duplicate alarm remains in AlarmKit.
7. Snooze, terminate Daybreak, and confirm the newly scheduled fixed alarm rings. Complete the challenge and confirm snooze cleanup.
8. Test local time-zone changes and a DST boundary. Relative weekly alarms follow local wall time; a snooze is a fixed absolute date.
9. Reboot the device and confirm the system owns delivery without depending on the JavaScript runtime.
10. Grant and deny motion access. Test shake peak detection on hardware; ensure resting or rotating the device doesn't register repeated shakes, and math fallback remains reachable.
11. Test VoiceOver, large text, reduced motion, numeric keyboard dismissal, and a small display. Judge motion on a release build on the slowest supported device.
12. On Android, test notification channel permission, exact-alarm settings, reboot rescheduling, and battery saver. Notification fallback is visibly described and isn't presented as AlarmKit-equivalent delivery.

Current implementation uses system alarm sound only. Sound names and artwork are preferences for future audio assets. No sound playback, adhan calculation, remote push, or countdown widget is claimed.
