# App blocking

Each alarm has **Block distracting apps**. Android offers a **Social** group (Instagram, YouTube,
Reddit, TikTok, Facebook, Threads, X, Snapchat, Pinterest, LinkedIn, Tumblr, Twitch,
and Discord), and a Custom apps option. The duration is selectable: **5, 10,
15, 30, or 60 minutes**. After granting access and choosing apps,
the saved alarm requests a block of that duration starting at ring time. Finishing or
restarting missions does not change the deadline. A snoozed alarm starts another
window when it rings; overlapping windows remain independently active. Previews
never create blocking sessions. Existing alarms default to off; previously saved
app-block settings without a duration retain five minutes. Duration and group are
saved per alarm, including when blocking is off. Changing a group clears the old
selection and requires setup before it can be enabled.

## Android

The alarm receiver stores the window before starting playback. The accessibility
service covers selected foreground apps with a countdown and a Home button. The
expiry lives in native storage, survives process recreation, and is checked on
every app switch and every half-second while covered. Uninstalled apps are skipped.
Revoking accessibility access stops enforcement without preventing recurring alarms.

Setup explicitly explains what the service observes and asks the user to open
Accessibility settings. It reads window package names only: no window-content
retrieval, screen capture, activity upload, or QUERY_ALL_PACKAGES permission.
The Social preset selects installed versions of the apps listed above together,
including supported Lite/regional variants. Tap **Use Social apps** again to refresh
an existing saved selection after the preset expands or another app is installed. Missing apps are
skipped, and an empty preset produces a setup message. Custom apps remain individually
selectable. Refresh,
Settings, and launchers are excluded. This does not block social websites opened
in an unselected browser, notifications, other profiles, or every conceivable
social app automatically. OEM accessibility behavior needs device testing.

## iPhone

Requires iOS 26+ with this app's AlarmKit module. Family Controls individual
authorization and Apple's app/category picker produce opaque tokens. **Choose apps
to block** opens Apple's categorized picker directly. The former Social option only
changed instructions, without filtering or preselecting anything, so it is removed
on iOS. Existing saved selections are preserved, including those labelled Social.
Selections are per alarm. Managed Settings uses a separate named store for each
alarm registration, so finishing one alarm cannot release another's shields.

The config plugin adds a Device Activity monitor extension, shared App Group, and
Family Controls entitlements to the app and extension. Native scheduling registers
a Device Activity interval starting at the alarm time. Blocks of 15 minutes or more
use their actual duration. The 5- and 10-minute options use the minimum 15-minute
interval and an end warning of 10 or 5 minutes respectively. All callbacks re-evaluate
the selected window, preventing late callbacks from starting a new block.
The interval-end callback and foreground refresh also clear expired shields.
Cancelled schedules retain only a currently active window until it expires.

**Timing is best effort on iOS.** Screen Time callbacks are controlled by the OS
and may arrive late or be omitted, especially while locked. A missed warning can
leave shields until the interval-end callback or the next Refresh foreground
refresh; this is not a guaranteed exact system timer. Verify locked,
terminated, and overnight delivery on a signed iPhone before release.

### Build requirements

- Rebuild both native apps; an OTA update or Expo Go cannot add these services.
  Native app-block API version 2 adds selectable durations. The legacy picker group
  argument is retained for bridge compatibility; iOS always uses the standard picker.
  An older build cannot silently save a longer block that still lasts five minutes.
- In Apple Developer, enable Family Controls for `com.yacoobali.alarm` and
  `com.yacoobali.alarm.appblock`, and configure
  `group.com.yacoobali.alarm.appblocking` for both. Distribution requires Apple's
  Family Controls approval for both bundle identifiers and refreshed profiles.
- The plugin declares the extension in EAS build metadata for signing discovery.
  Xcode is required to compile Swift; Windows checks cannot verify Apple frameworks.
- Google Play distribution requires the applicable AccessibilityService declaration
  and disclosure review. The service declares itself as not an accessibility tool.

### Device verification

Schedule a real alarm with selected apps, leave Refresh, and open one while it
rings. Complete missions before the selected deadline: blocking should continue. Check
release at each selectable duration while the blocked app is open and while the phone is
locked. Repeat with process termination, reboot, revoked access, two overlapping
alarms, snooze, midnight/repeating weekdays, and saving an alarm just after today's
scheduled time. Confirm Settings/Home/Refresh remain usable. Verify notifications
and unselected apps remain accessible. Native device behavior is not simulated by
the browser regression or mocked bridge tests.

References: [Device Activity warnings](https://developer.apple.com/documentation/deviceactivity/deviceactivityschedule/warningtime),
[callback delivery](https://developer.apple.com/documentation/deviceactivity/deviceactivityschedule/nextinterval),
[Screen Time frameworks](https://developer.apple.com/documentation/screentimeapidocumentation/),
[Android accessibility services](https://developer.android.com/guide/topics/ui/accessibility/views/service).

## Local verification — 24 September 2026

- TypeScript passes; 50 unit/configuration/bridge/audio tests pass.
- Production JavaScript exports pass for iOS, Android, and web. These do not
  compile the iOS Swift sources.
- Android Kotlin compilation and all 10 native JVM tests pass, including exact
  five-minute expiry and invalid-window handling.
- Six browser checks pass for the new setting and existing alarm/mission flow.
  Reviewed the setting at 390 × 844 and 320 × 640.
- The iOS plugin passes a real Xcode project parse/write test, repeated application,
  extension embedding, shared source, entitlement, and signing metadata checks.
- Swift compilation, actual permission prompts, OS blocking, and background timing
  have not been verified on physical phones in this Windows workspace.

### Social group and duration follow-up

TypeScript, the web export, 32 focused unit/config/bridge checks, the Android
compile and 12 JVM checks pass. Both app-blocking browser checks pass, including
the named Social apps, all five duration options, saving/reloading 30 minutes,
switching groups without losing the duration, and the 320 × 640 layout.
Device verification of iOS remains outstanding.
