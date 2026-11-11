# Verification results

Verified in the Windows workspace on 2026-09-15, after upgrading to Expo SDK 57.0.23 (React 19.2.3 / React Native 0.86.3), using Node.js 24.19.0:

- TypeScript: `npx tsc --noEmit` passes.
- Alarm / puzzle logic: **10 tests pass**.
- Playwright: **15 end-to-end tests pass**, covering scheduled one-off ringing, snooze, completion, failed-save retry, onboarding, alarm CRUD and persistence, enabling/disabling across reloads, sound selection, challenge selection, math, memory, shake preview and fallback, journal saving, Lottie playback, dynamic reduced motion, and background pause/resume. Editor checks cover real wheel scrolling, persisted mission order and per-mission difficulty, Snooze Off, visible save confirmation, and completing all missions before dismissing. Onboarding checks cover horizontal paging, inactive-scene pausing, reduced motion, and 320 × 640 layouts. Haptic checks verify one effect per math answer and counted shake, distinct completion feedback, and continued mission progress when the vibration API throws.
  The motion update was checked against the exported production app on port 8082. Metro development bundle downloads caused long page-load delays; tracing showed interactions themselves completed quickly. Math tests wait for the entrance animation's visible equation before reading it.
- Error messages now render inside each focused native screen via Stack screenLayout. Two browser regressions inject a permission-style transaction error on ringing and mission screens, verify visibility and hit-testing at 320 × 640, then dismiss and retry successfully. Actual OS permission prompts and native modal presentation still require device verification.
- Expo Doctor: **21/21 checks pass**.
- Production JavaScript exports: **iOS, Android, and web pass**.
- Expo Apple autolinking resolves `DaybreakAlarmKit` and `DaybreakAlarmKitModule` from the local module.
- Alarm toggles use SDK 57's universal Expo UI API on iOS and Android. The browser uses React Native Web's switch to retain its hidden accessible label.
- Browser visual review: onboarding, home, editor, sounds, challenges, journal, completion, ringing, and themes; the Save action stays visible at 320 × 640. Screenshots live in `artifacts/screenshots`; the redesigned onboarding, wheel editor, and mission selection are in `artifacts/refinement`.
- 17 supplied sounds now have bundled PCM WAV copies, preview playback, and native scheduling configuration; see `audio.md` for conversion and device checks. The two Islamic recordings use their full original audio inside the app and 29-second excerpts for system alerts.
- Thirteen original Lottie JSON files are included, with an editable generator in `scripts/generate-lottie.cjs`. Mission screenshots and frame-change checks are in `artifacts/motion`; see `docs/motion.md`.
- Onboarding button update: all **8 targeted onboarding and app-flow tests pass**, including four distinct live Lottie sequences, duplicate-press protection, haptic counts, reduced motion, failed setup retry, and normal completion. TypeScript and all three platform JavaScript exports pass. Press-state screenshots at 390 × 844 and 320 × 640 are in `artifacts/onboarding-buttons`; `scripts/review-onboarding-buttons.cjs` reports no browser runtime errors.
- Wheel refinement: all **8 editor and app-flow tests pass**, including first/last row centering, full selected-row opacity, tapping 01–03 and minute 59, intermediate positions during smooth scrolling, mouse dragging, ring synchronization, and saved values. TypeScript and iOS/Android/web JavaScript exports pass. Updated normal/small editor screenshots are in `artifacts/refinement`; native glide and haptic feel still need device verification.
- Shake/audio update: TypeScript, 10 unit tests, and all three platform JavaScript exports pass. Browser checks cover decoding/playing all 15 clips, exclusive previews, saved sound selection, looping through missions, stopping on completion, a shake counter over 110 px at 320 × 640, and the existing editor/motion/haptic flows. Fifteen checks passed together; the remaining math-feedback test was updated for the shorter error copy and rerun separately. Audio picker and shake screenshots are in `artifacts/refinement`.

- Islamic sounds update: TypeScript and iOS/Android/web JavaScript exports pass. All **4 targeted audio browser tests pass**, covering playback of all 17 recordings, full-length adhan sources, exclusive previews, saving an adhan and reopening the Islamic section with its selection intact, alarm playback through missions, and the large shake counter. Visually reviewed `artifacts/refinement/islamic-sounds.png`.

## Android alarms, wallpapers, and compact missions — 2026-09-16

- TypeScript and iOS/Android/web JavaScript exports pass.
- Android `:app:compileDebugKotlin`, native module compilation, and merged manifest processing pass. The activity's conditional lock-screen handling compiles with the app. Build output: `artifacts/android-build-check.log`.
- All four native JVM scheduling tests pass: next-day midnight, weekly recurrence after firing, weekday/weekend selection, and local-clock scheduling across daylight saving.
- In-app browser review at a 320 × 568 viewport: math equation and all answer buttons fit, three correct answers complete the mission, and shake preview increments its large counter.
- Wallpaper selection through the real photo picker, saving, persistence across reload, display on the alarm screen, and switching back to default artwork were checked through the UI.
- The mobile shake mission now subscribes on mount, without a Start button. Actual accelerometer readings still require a phone.

## Custom audio imports — 2026-09-16

- TypeScript and iOS/Android/web JavaScript exports pass.
- Android native alarm module and full app Kotlin compilation pass with the new document picker. Build output: `artifacts/android-custom-audio-build.log`.
- In-app browser checks: real file-picker import, automatic selection, preview play/stop, invalid-audio rejection, and recording playback after reload pass. Saving an alarm with the imported sound, reloading, and reopening its picker preserves the selection and opens Custom automatically.
- Visually checked the Custom filter and fixed bottom selection action at 320 × 568. The library scrolls on small screens.
- Android imported-file playback and iOS conversion/system delivery require native device verification. Swift compilation was not available on this Windows host.

## Refresh messaging — 2026-09-16

- App configuration, Android launcher label, browser title, and visible branding use Refresh.
- Rewrote onboarding, home, mission selection, journal, settings, and completion copy around personal wake-ups, getting past snooze, and fresh starts. Existing test selectors were updated for the new labels.
- TypeScript and web export pass. In-app browser review covered all four slides and completing onboarding, at 390 × 844 and 320 × 640. Compact layouts reduce illustration size and spacing so supporting copy stays visible alongside the action.

Not verified here: Xcode/Swift compilation, native signing, actual AlarmKit delivery, lock-screen App Intent behavior, physical accelerometer detection, haptic strength and timing, Android lock-screen/service delivery on hardware, VoiceOver, and release-device frame rate. These need the physical-device checks in `device-verification.md` and `android-alarms.md`. No Android device was connected for these changes. The browser shake control is explicitly a preview.

The generated native iOS and Android projects are not committed; use Expo prebuild when creating a development build. No app-store deployment or EAS build has been submitted.

## 23 September 2026 refresh

- TypeScript checking and Expo SDK 57 web export pass.
- 41 unit/config/audio tests pass, including validation of new missions and selected duas and onset checks for both full adhans and their iOS excerpts.
- 19 browser checks pass across audio, time editing, all new missions, selected-dua persistence/preview, existing supplications and mission rounds. This includes incorrect answers, completion, narrow phone layout, round resets and timeout behaviour.
- Android `:refresh-alarm:testDebugUnitTest` compiles the changed Kotlin module and passes its JVM tests.
- Physical phone delivery, Doze, OEM battery restrictions and iOS system playback still require a new native build on-device. The specific eight-minute delay is not confirmed as reproduced or eliminated.

## Full-screen games and Fajr reminders — 23 September 2026

- Shape match replaces the word/ink game while preserving stored mission IDs. Number trail, Shape match and Pattern echo fill the available screen; all pads fit at 320 × 640 and 390 × 844.
- 16 targeted browser tests pass across visual games, Fajr reminders, selected duas and mission rounds. Coverage includes wrong answers, automatic light sequences and replay, completion, all five full readings, persisted rotation, previews that do not consume reminders, and the five-minute reading timeout.
- TypeScript and web export pass. Android `:refresh-alarm:testDebugUnitTest` compiles the new reading-limit bridge and passes native deadline tests. A rebuilt Android app is required for the longer reading limit; older binaries keep their one-minute native limit.
- Reviewed screenshots in `artifacts/islamic-refresh/shapes.png`, `pattern.png`, and `fajr.png`. Physical-device gameplay and delivery still require testing on a phone.

## iOS timing follow-up

- User confirmed the eight-minute late alarm occurred on iOS. Android hardening is separate from that report.
- Five mocked-native iOS regression tests pass: exact 07:20 scheduling, rejecting missing AlarmKit on iOS 26+, time-sensitive older-iOS fallback, and preserving the system alarm while inactive or backgrounded during handoff setup.
- Added native `AlarmTiming` logs for scheduling, observed alert changes and stops. The original eight-minute delay has not been reproduced. Swift compilation and locked-iPhone delivery remain unverified on this Windows machine.
- All 47 local unit/config/audio/iOS-boundary tests pass. TypeScript and both iOS and web JavaScript exports pass; exporting JavaScript does not validate Swift compilation.
- Final exported-browser regression: 17 additional checks pass across alarm routing, audio playback, sound preferences, time-wheel editing and completion/retry. Together with the 16 mission/reading checks, 33 browser checks pass for this update. The preview server was restarted after the interrupted turn before this final run.

## Tile recall refinement — 23 September 2026

- Replaced Shape match with three simultaneously highlighted, blank tiles, shown for two seconds. Recall accepts any order; a wrong tile resets progress and replays the same locations. Easy uses 3×4 and Hard uses 4×4. Existing saved mission IDs and round settings remain compatible.
- TypeScript and web export pass. All five focus-mission browser tests pass, including exact two-second visibility, input locking during preview, unordered answers, duplicate prevention, mistake recovery, multiple rounds, and full-screen phone layouts.
- Visually reviewed both difficulty levels at 320 × 640: `artifacts/islamic-refresh/tile-recall-gentle.png` and `tile-recall-bright.png`.

- Difficulty increased: Easy is now 4×4 with three targets; Hard is 6×6 with eight. Both retain two seconds of preview. TypeScript and web export pass. The four other focus-mission checks pass, and the updated recall regression passes after fixing highlight borders to maintain equal tile widths. All hard-mode tiles stay at least 44 × 44 on a 320 × 640 viewport; unordered recall, mistake reset and both rounds pass for both difficulties.

## New mission icons — 23 September 2026

- Added dedicated faceless clay Lottie icons for Number Trail, Tile Recall, Pattern Echo, Duas and Fajr Reminder; all mission collection cards now use the shared animated artwork component.
- TypeScript and web export pass. Browser verification confirms all five SVGs render in the exported app, animate normally, and stop for reduced motion, with no page errors. Reviewed `artifacts/islamic-refresh/mission-icons.png` and `mission-icons-in-app.png` for composition and small-size legibility.
