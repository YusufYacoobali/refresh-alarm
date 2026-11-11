# Mystery Mode and Android configuration reliability

Existing alarms still use Manual Mode when `missionMode` is absent. Their
`challenge`, `difficulty`, and ordered `missions` fields retain their existing
meaning. Mystery configuration lives separately in `mystery`; switching modes
does not overwrite Manual settings. The storage key and schema version remain
`daybreak.state.v1` / version 1, with additive optional fields.

Mystery requires 2–6 eligible gameplay missions and at least one morning dua.
Difficulty and rounds use the existing mission controls and validation. Each
occurrence selects 2–4 distinct games, shuffles them, and then appends shuffled
individual duas. Recitation counts come from the existing supplication data.
Optional Fajr appears immediately before or after supplication. When the gameplay
order matches the previous occurrence, swapping two distinct games guarantees a
different order, even with a constant random source.

## Wake-up identity and persistence

`wakeSessions[alarmId]` stores the generated mission snapshot, original session
ID, scheduled occurrence key, start time, and completion flag. Generation is
serialized and saved before gameplay opens. Storage errors keep the alarm on
the ringing screen with a retry action. The latest session is retained after
completion so the next occurrence can avoid its gameplay order; deleting the
alarm removes its session.

Android `AlarmStore.fire` records a `sessionId` from the native registration and
scheduled timestamp. `AlarmRingService` retains it when timeout changes
`eventId`; the bridge exposes both. `eventId` continues to control native ringing
and mission deadlines. New scheduled deliveries receive new session IDs. A
persisted snooze links back to the original session even though its native
registration differs. Older Android builds without this bridge field reuse the
saved occurrence for reminder IDs.

iOS and browser handoffs use the latest scheduled local-time occurrence when
the platform only identifies the alarm. Explicit timeout and snooze handoffs
reuse the saved session. Gameplay progress restarts at mission/round/dua one
after timeout or a cold launch, using the same persisted mission and dua order.
Gameplay retains its 60-second deadline, and Fajr retains its 300-second deadline
(including the existing compatibility fallback for older Android binaries).
Unavailable shake detection retains the existing math fallback.

Full-alarm previews carry their generated snapshot in route parameters across
timeout/restart and never write real wake-up history or completions. Individual
mission previews retain the existing behavior.

## Android rendering changes

The configuration screens now share the existing mission-screen safeguards:
Android scroll views keep children attached, expanding cards skip Reanimated
layout/entry transitions, and changing row values render immediately. iOS and
web retain their animations. Repeat expansion also skips Android transitions.

The app-block duration picker has a fixed 56-point Android Host height, matching
the native Material text-field anchor and the existing rounds picker pattern.
The Accessibility disclosure is outside the clipped card and uses a separately
sized Host for its native dialog window. Consent wording, Agree/Decline actions,
background cancellation, duplicate-click protection, and permission checks are
preserved. Permission status still refreshes on `AppState` becoming active after
Android Settings. The native permission navigation and scheduling paths are
unchanged.

These drawing/measurement interactions are supported by code inspection and
the existing safeguards, but their role in the reported physical-device blank
windows has not been reproduced on a device in this environment.

## Validation

Verified in this Linux environment:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run test:unit` | 64 passed, including 10 new Mystery/session tests and existing iOS/plugin/audio coverage |
| Browser suite, configured single worker, Chromium | 76 passed |
| Additional session write-failure/retry browser case | 1 passed (added after the full run started) |
| Expo production export, Android + iOS + web | Passed for all three platforms |
| `expo prebuild --platform android --no-install` | Passed |
| Native Kotlin compilation + Android unit tests | Attempted; blocked resolving React Native's Android archive before completion |
| Physical Android/iOS behavior | Not device-tested |

The browser suite was run against a production web export using
`DAYBREAK_TEST_URL=http://127.0.0.1:8082` and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`. Existing stale assertions
were updated for the already-hidden alarm names, the current ringing action,
and Lottie's current location in mission selection. Math tests now wait for the
visible question during transitions. An initial two-worker run exposed timing
failures; the final run used the repository's configured single worker and
passed every test. The stale name/action/Lottie failures were also reproduced
against unchanged `main`.

The native command attempted was:

```sh
cd android
./gradlew :refresh-alarm:compileDebugKotlin :refresh-alarm:testDebugUnitTest
```

The SDK, JDK 17, NDK, Gradle, and build tools were provisioned successfully.
Resolution of `com.facebook.react:react-android:0.86.3` then failed: Maven Central
redirects `react-android-0.86.3-debug.aar` to `repo.reactnative.dev`, which is
outside this environment's allowed hosts and returned HTTP 403. This is a
verified environment dependency blocker, not a Kotlin compiler result. Add
`repo.reactnative.dev` to the environment's allowed hosts and rerun the native
command; no project dependency change is required. Native source compilation
and native unit-test success are **not claimed**.

## Device verification still required

No physical Android device is attached (`adb devices -l` returns an empty list).
Browser tests and native compilation cannot establish native touch, permission,
audio, or lock-screen behavior. An updated native build is required to exercise
the new native session field.

On a physical Android phone, repeat these checks with animations enabled:

1. Open/close Repeat, Sound & volume, Wake-up missions, More options, and Block
   distracting apps at least three times, scrolling between upper/lower rows.
   Confirm first-tap opening, visible content, and touch targets at their current
   positions. Change sounds, volume/ramp, mission difficulty/rounds, backgrounds
   (choose/cancel/remove), block duration, Social/Custom apps, search, save/cancel,
   and reopening saved selections.
2. Try disclosure Agree, No thanks, Back, outside dismissal, repeated Agree, and
   backgrounding. Only an active, explicit Agree may open Accessibility settings.
   Enable and revoke access in Settings, return, and verify status and app-choice
   controls refresh. Check exact-alarm, full-screen, and notification permission
   navigation too.
3. Ring a Mystery alarm, record game/difficulty/round/dua order, and time out in
   both gameplay and supplication. Repeat after process death and from a locked
   screen. Verify the original session ID remains unchanged as event IDs change,
   and every restart uses the same sequence. Check snooze and the next scheduled
   wake-up separately; the next occurrence must get a new session.
4. Check Fajr's longer deadline, shake sensor denial/unavailability, Manual Mode,
   and system/app alarm audio, both silent and audible during missions.

Native iOS build/device checks (AlarmKit, Screen Time, audio, Settings return,
and cold launch) also remain necessary on macOS/iPhone; this Linux environment
can verify the iOS JavaScript bundle and existing iOS unit coverage only.
