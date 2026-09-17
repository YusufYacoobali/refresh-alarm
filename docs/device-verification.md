# Physical-device verification

JavaScript compilation is verified separately from Swift compilation and actual system delivery. Use a signed development build on a physical iOS 26+ device for the following checks before relying on Refresh as a primary alarm.

1. Confirm Expo autolinks `DaybreakAlarmKitModule`, build with the iOS 26+ SDK, and verify Settings describes AlarmKit rather than notification fallback.
2. Allow and deny AlarmKit permission. Denial must leave an attempted alarm disabled and display a recoverable error; allow permission from system Settings and retry.
3. Schedule a two-minute test with each custom sound, lock the phone, enable Silent / Focus, and confirm the selected sound rings. Repeat with Device default. Use a rebuilt native client containing the WAV resources.
4. Use the single system **slide to stop** control with Refresh terminated. Confirm the correct alarm's wallpaper opens immediately, with audio and **Wake up my mind**. Repeat from Home, Journal, and an open editor. No second lock-screen action should appear.
5. Complete a one-off alarm and a weekday alarm in the app. Confirm only mission completion dismisses the app's wake-up flow, the one-off is disabled, and the weekday alarm's future occurrence remains correct. Reopening Refresh before completion must restore the alarm instead of exposing a tab.
6. Edit, disable, and delete scheduled alarms, including a snoozed alarm. Confirm old alerts are cancelled and no duplicate alarm remains in AlarmKit.
7. Start a multi-mission alarm. Each mission must start at **1:00**; answers, flips, sound toggles, and shakes must not extend it. Let mission two expire: the wallpaper and full-volume alarm must return, and starting again must return to mission one. Repeat with the phone locked and with Refresh terminated during a mission, verifying the AlarmKit backup. Complete all missions and wait another minute to verify backup cancellation.
8. Test local time-zone changes and a DST boundary. Relative weekly alarms follow local wall time; a snooze is a fixed absolute date.
9. Reboot the device and confirm the system owns delivery without depending on the JavaScript runtime.
10. Grant and deny motion access. Test shake peak detection on hardware; ensure resting or rotating the device doesn't register repeated shakes, and math fallback remains reachable.
11. Test VoiceOver, large text, reduced motion, numeric keyboard dismissal, and a small display. Judge motion on a release build on the slowest supported device.
12. On Android, test notification channel permission, exact-alarm settings, reboot rescheduling, and battery saver. Notification fallback is visibly described and isn't presented as AlarmKit-equivalent delivery.

13. Confirm only one sound plays after foreground handoff. Mission sound defaults off and remembers the last chosen setting; turning it on starts playback automatically. Verify preview switching never overlaps playback and leaving the picker stops it. Check lock-screen media controls and interrupted playback.
14. Open Refresh normally with no pending alarm: **Alarms** must be selected. Verify Home still opens as its own tab and cannot prevent an active alarm from taking over.

Custom sound playback and system sound configuration are implemented; physical-device delivery is not verified on Windows. Adhan calculation, remote push, and a countdown widget remain outside this implementation.
