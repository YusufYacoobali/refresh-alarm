# Verification results

Verified in the Windows workspace on 2026-09-15, after migrating to Expo SDK 54.0.37 (React 19.1.0 / React Native 0.81.5):

- TypeScript: `npx tsc --noEmit` passes.
- Alarm / puzzle logic: **8 tests pass**.
- Playwright: **5 end-to-end tests pass**, covering scheduled one-off ringing, snooze, completion, failed-save retry, onboarding, alarm CRUD and persistence, enabling/disabling across reloads, sound selection, challenge selection, math, memory, shake preview and fallback, journal saving, and the breathing ritual.
- Expo Doctor: **18/18 checks pass**.
- Production JavaScript exports: **iOS, Android, and web pass**.
- Expo Apple autolinking resolves `DaybreakAlarmKit` and `DaybreakAlarmKitModule` from the local module.
- Expo UI is pinned to SDK 54's `0.2.0-beta.9`. Alarm toggles use SwiftUI on iOS, Compose on Android, and a browser switch on web.
- Browser visual review: onboarding, home, editor, sounds, challenges, unwind, journal, completion, ringing, and themes; a 320 × 640 viewport can scroll to the Save action. Screenshots live in `artifacts/screenshots`.
- No audio files are bundled in the application assets.

Not verified here: Xcode/Swift compilation, native signing, actual AlarmKit delivery, lock-screen App Intent behavior, physical accelerometer detection, Android notification timing, VoiceOver, and release-device frame rate. These need the physical-device checks in `device-verification.md`. The browser shake control is explicitly a preview.

The generated native iOS and Android projects are not committed; use Expo prebuild when creating a development build. No app-store deployment or EAS build has been submitted.
