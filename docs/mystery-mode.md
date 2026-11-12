# Mystery Mode and Android configuration reliability

Existing alarms still use Manual Mode when `missionMode` is absent. Their
`challenge`, `difficulty`, and ordered `missions` fields retain their existing
meaning. Mystery configuration lives separately in `mystery`; switching modes
does not overwrite Manual settings. The storage key and schema version remain
`daybreak.state.v1` / version 1, with additive optional fields.

Random Pick requires 2–6 eligible gameplay missions. Morning duas are optional;
an empty `mystery.duaIds` skips supplication entirely.
Difficulty and rounds use the existing mission controls and validation. Each
occurrence selects 2–4 distinct games, shuffles them, and then appends shuffled
individual duas. Recitation counts come from the existing supplication data.
Optional Fajr appears immediately before or after selected supplication, or after
the games when no duas are selected. When the gameplay
order matches the previous occurrence, swapping two distinct games guarantees a
different order, even with a constant random source.

## Wake-up identity and persistence

`wakeSessions[alarmId]` stores the active generated mission snapshot, original
session ID, scheduled occurrence key, start time, original eligible pool and
settings, and Fajr hadith index. Generation is serialized and saved before
gameplay opens. Storage errors keep the alarm on the ringing screen with a
retry action; loading cannot fall through to a mission-free dismissal.

Completion computes Fajr advancement from the executed snapshot, then removes
the full active session. `mysteryHistory[alarmId]` retains only its identity,
occurrence, start/completion times and gameplay kinds. This bounded record
prevents the next independent occurrence from repeating the prior order and
recognizes a duplicate completion. It does not retain dua order or the full
configuration. Completion also checks Android's current native occurrence so a
late callback from an old session cannot stop a newer scheduled wake-up.
Deleting an alarm removes its active session, history and any
recovery data. Old v3 `completed: true` records are normalized to history on
hydration, and orphan records are pruned. This normalization is saved with the
next normal state write; no startup write or storage-version migration is added.

Android `AlarmStore.fire` records a `sessionId` from the native registration and
scheduled timestamp. `AlarmRingService` retains it when timeout changes
`eventId`; the bridge exposes both. `eventId` continues to control native ringing
and mission deadlines. New scheduled deliveries receive new session IDs. A
persisted snooze links back to the original session even though its native
registration differs. Older Android builds without this bridge field reuse the
saved occurrence for reminder IDs. Timeout navigation also carries the stable
session ID separately from its current event ID.

iOS and browser handoffs use the latest scheduled local-time occurrence when
the platform only identifies the alarm. Explicit timeout and snooze handoffs
reuse the saved session. Gameplay progress restarts at mission/round/dua one
after timeout or a cold launch, using the same persisted mission and dua order.
Gameplay retains its 60-second deadline, and Fajr retains its 300-second deadline
(including the existing compatibility fallback for older Android binaries).
An unfinished snapshot remains authoritative if the alarm's mode, pool,
difficulties, rounds or selected duas are edited. For synthetic identifiers,
the next scheduled time after the snapshot's start separates a new scheduled
wake-up from a resumed session even if the configured clock time changed.

While a native Mystery alarm is actively ringing, mission/background-only
edits are persisted without replacing its native registration. Saving changes
to its delivery fields (time, days, enabled state, label, sound, volume/ramp or
app blocking) asks the user to finish the current wake-up first and retains the
draft. This avoids the old save path cancelling the actively playing alarm.
Manual alarms retain the existing save path. This native-active safeguard is
covered by code inspection and policy unit tests, not a physical-device check.

Unavailable or denied shake detection retains the user-selected math fallback.
If math is excluded from the original eligible pool, the screen explains that
and requires an explicit **Use math once for this shake mission** action. It
does not silently substitute an excluded game or rewrite the saved sequence.

Full-alarm previews carry their generated snapshot in route parameters across
timeout/restart and never write real wake-up history or completions. Individual
mission previews retain the existing behavior.

## Invalid settings and recovery

Saving validates the active mode. Inactive Manual/Mystery settings remain
available for editing and copying without invalid inactive data disabling the
working mode. Startup validates core alarm data separately from mission
configuration, so damaged Mystery choices cannot hide the alarm list or block
the native handoff. The editor salvages readable settings without enabling
games from an empty corrupt pool; accepting Random Pick still requires at least
two games. Duas may be left unselected.

Snapshots validate independently of the current edited alarm. When an original
configuration snapshot exists, game eligibility/difficulty/rounds, dua selection
and Fajr inclusion must agree with it. A damaged session is quarantined in
`wakeSessionRecovery[alarmId]` and never quietly regenerated. The original
backup remains available until recovery is explicitly accepted or the alarm is
deleted. Malformed history is ignored rather than blocking startup. Invalid
shared session containers do not change otherwise valid Manual alarms.

The ringing screen keeps playback mounted and offers retry. For invalid
configuration/session data it also offers an explicit **Use morning duas this
time** recovery choice. Acceptance persists a `fallback: "duas-only"` session:
readable selected duas (all three if none can be recovered), optional configured
Fajr, and no gameplay missions. Its order remains stable through restart,
timeout and snooze. Saved alarm settings are retained for later repair. Storage
write failures cannot bypass persistence using this recovery action.

## Android rendering changes

The configuration screens now share the existing mission-screen safeguards:
Android scroll views keep children attached and configuration cards skip
Reanimated layout/entry transitions. This is scoped to expandable editor and
app-block settings cards, the changing sound list, and the existing
mission-selection safeguards. Shared card/screen/entry animations, ordinary
button animations, row-value feedback, haptics, and mission animations remain
enabled. iOS and web retain their transitions. Repeat expansion also skips
Android transitions.

The app-block duration picker has a fixed 56-point Android Host height, matching
the native Material text-field anchor and the existing rounds picker pattern.
The Accessibility disclosure is outside the clipped card and uses a separately
sized Host for its native dialog window. Consent wording, Agree/Decline actions,
background cancellation, duplicate-click protection, and permission checks are
preserved. Permission status still refreshes on `AppState` becoming active after
Android Settings. Native permission navigation and timer APIs are unchanged.

These drawing/measurement interactions are supported by code inspection and
the existing safeguards, but their role in the reported physical-device blank
windows has not been reproduced on a device in this environment. There is no
confirmed native root cause to claim. Android development builds now distinguish
the press handler, React state commit and native content/window bounds without
adding a delay or retry; see [the diagnostic protocol](android-expansion-diagnostics.md).

## Validation

Verified in this Linux environment:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run test:unit` | 71 passed, including 17 Mystery/session tests and existing iOS/plugin/audio coverage |
| Android follow-up configuration/motion browser checks | 4 passed before its separate commit |
| Full browser suite, configured single worker, Chromium | 87 passed, including 16 Mystery browser scenarios |
| Final lifecycle/recovery checks against the latest export | 6 passed, including recovery at 320×640 |
| Expo production export, Android + iOS + web | Passed for all three platforms |
| `expo prebuild --platform android --no-install` | Passed |
| Native Kotlin compilation + Android unit tests | Attempted; blocked resolving React Native's Android archive before completion |
| Physical Android/iOS behavior | Not device-tested |

The browser suite was run against a production web export using
`DAYBREAK_TEST_URL=http://127.0.0.1:8084` and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`. Existing stale assertions
were updated for the already-hidden alarm names, the current ringing action,
and Lottie's current location in mission selection. Math tests now wait for the
visible question during transitions. An initial two-worker run exposed timing
failures; the final run used the repository's configured single worker and
passed every test for the initial implementation. The stale name/action/Lottie
failures were also reproduced against unchanged `main`. Follow-up coverage adds
corrupt-data recovery, mode/schedule changes during a session, both Fajr
positions, disabled Fajr, failed completion, repair of empty pools, explicit
excluded-math fallback, duplication and deletion.

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
command; no project dependency change is required. A follow-up `--offline`
attempt reached the same missing `react-android-0.86.3-debug.aar` dependency and
failed because it is not cached. Native source compilation and native unit-test
success are **not claimed**.

## Modified files and purpose

This covers the original v3 implementation plus the follow-up brief. The Android
follow-up is isolated in commit `1cdb5b0`; lifecycle/recovery changes follow it.

| File | Purpose |
| --- | --- |
| `src/screens/alarm-editor.tsx` | Scope Android expansion safeguards, trace first presses/layout, summarize the selected mode. |
| `src/components/ui.tsx` | Android clipping default, preserved shared animations, disabled invalid-form actions. |
| `src/components/use-expansion-diagnostics.ts` | Development-only press/commit/native geometry diagnostics. |
| `src/components/app-block-settings.tsx` | Stable Android card and picker dimensions; disclosure outside the clipped card; expansion traces. |
| `src/components/app-block-disclosure.android.tsx` | Explicit Host size for the native consent dialog. |
| `src/screens/collections.tsx` | Manual/Mystery controls, per-game settings, mandatory dua/pool selection, Fajr toggle, corrupt-setting repair. |
| `src/components/alarm-card.tsx` | Show Mystery Mode without revealing a generated order. |
| `src/utils/alarms.ts` | Optional mode/settings types, active-mode validation, safe copies, summaries and native-delivery edit policy. |
| `src/utils/mystery-sequence.ts` | Pure bounded generation, injected RNG, distinct games, fixed settings, dua/Fajr ending, repeat avoidance. |
| `src/utils/wake-session.ts` | Stable occurrence identity, snapshot validation, history/cleanup, quarantining and explicit recovery. |
| `src/utils/supplications.ts` | Order-aware Mystery resolver; preserve Manual's canonical ordering. |
| `src/state/app-state.tsx` | Serialize/persist sessions, load damaged choices safely, own completion/snooze/cleanup, preserve active native registrations. |
| `src/screens/wake-up.tsx` | Shared effective routine, loading/error protection, snapshot execution, Fajr timer/index, explicit recovery and shake fallback. |
| `src/components/use-mission-reminder.ts` | Carry stable session IDs and preview snapshots through timeout routes. |
| `src/services/android-alarm.ts` | Type the optional native original-session identifier. |
| `modules/refresh-alarm/android/src/main/java/expo/modules/refreshalarm/AlarmStore.kt` | Create the original session ID at genuine delivery. |
| `modules/refresh-alarm/android/src/main/java/expo/modules/refreshalarm/AlarmRingService.kt` | Preserve session ID when reminders replace event ID. |
| `modules/refresh-alarm/android/src/main/java/expo/modules/refreshalarm/RefreshAlarmModule.kt` | Expose both IDs to JavaScript, including old active-record compatibility. |
| `src/utils/mystery-sequence.test.ts` | Randomness, pools, settings, ordering, legacy data, identity, edit policy, cleanup and recovery tests. |
| `tests/mystery.spec.ts` | Mode/save/reload/preview/lifecycle/Fajr/recovery/duplicate/delete browser integration coverage. |
| `tests/alarm-lifecycle.spec.ts` | Wait for the visible math question before reading its answer. |
| `tests/audio.spec.ts` | Same transition-safe assertion during actual playback coverage. |
| `tests/app.spec.ts` | Assert the clock in the already-nameless ringing screen. |
| `tests/error-layer.spec.ts` | Exercise the current ringing action and visible error layer. |
| `tests/motion.spec.ts` | Exercise mission Lottie in selection, where it is currently rendered. |
| `package.json` | Include all utility unit-test files. |
| `playwright.config.ts` | Allow an installed Chromium executable while preserving the default browser. |
| `docs/android-expansion-diagnostics.md` | Diagnostic procedure and device-only limits. |
| `docs/mystery-mode.md` | Storage/lifecycle design, safety behavior, verification and remaining checks. |

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
