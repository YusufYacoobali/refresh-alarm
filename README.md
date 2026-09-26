# Refresh

Refresh helps you build a wake-up routine for a fresher start, with personal sounds, backgrounds, and missions to get your mind and body going. Built with **Expo SDK 57, React Native, and TypeScript**. The supplied reference drives the midnight palette, clay illustrations, peach buttons, lavender surfaces, and scrolling time wheels.

## Run

Use Node.js 22.13 or later (`.node-version` pins a compatible version).

```sh
npm install
npm run web
# Native UI preview (AlarmKit needs a development build):
npx expo start --go
```

The browser preview runs at the URL printed by Expo. Browser alarms are explicitly previews and only work while the page is open. Start with onboarding, create an alarm, or use **Home → Try your wake-up routine** to explore the wake-up flow immediately.

## Included

- Four-step swipeable onboarding with original Lottie scenes and a contextual alarm permission request.
- Persisted alarm creation, editing, enabling/disabling, deletion, repeat days, AM/PM, labels, and snooze Off / 5 / 10 / 15 minutes. Saving has a fixed action, inline errors, and a confirmation.
- Local **Swift AlarmKit module for iOS 26+**: authorization, relative/weekly and fixed scheduling, cancellation, stop, state lookup, and an App Intent that opens the relevant wake-up screen after a cold launch.
- Native Android alarm-clock scheduling, continuous foreground-service audio, vibration, full-screen lock-screen intent, restart recovery, and exact/full-screen permission settings. Older iOS uses local notifications.
- Math puzzles, shuffled memory pairs, and accelerometer shake detection. Combine all three in an ordered sequence, with Easy/Hard difficulty for each, progress, haptics, and an accessible math alternative.
- Seventeen sound choices, personal photo backgrounds per alarm, three visual themes, and a private on-device morning journal. Shake missions listen automatically; math layouts adapt to small screens.
- Reanimated feedback and clay illustration motion, reduced-motion support, safe areas, scrollable forms, and native SF Symbols on iOS.
- Thirteen original, offline Lottie scenes, including four distinct onboarding button animations, 3D memory flips, math feedback, responsive shake animation, scrolling time wheels, and motion across buttons, selections, onboarding, and tabs.
- A test-alarm action in Settings and explicit permission/fallback status.

**17 supplied sounds are included**, with 15 alarm tones and an Islamic section containing two adhans. Both adhans play in full inside the app and through the Android native alarm service. iOS AlarmKit and local notifications use PCM WAV excerpts of up to 29 seconds. Original files stay in `assets/audio`; `scripts/prepare-audio.cjs` generates system resources and the catalog. Rebuild native clients to bundle new sounds. Automatic prayer-time calculation and location-based scheduling are not implemented. See `docs/audio.md`.

## iOS AlarmKit development build

AlarmKit is custom Swift code, so it cannot run inside Expo Go. Use a Mac with Xcode 26.4 or later to build with Expo SDK 57 and compile the AlarmKit integration:

```sh
npm ci
npx expo prebuild --platform ios
npm run ios -- --device
```

The install step applies the checked-in `expo-modules-jsi@57.1.0` patch for the
`RuntimeScheduler` constructor and Swift pointer-capture compiler errors. Keep
install scripts enabled. For an existing Mac checkout with the earlier workaround,
follow [iOS build recovery and validation](docs/ios-build.md) before rebuilding.
**Expo JSI / Xcode compatibility:** `npm install` and `npm ci` run a small postinstall workaround for [Expo's RuntimeScheduler constructor-annotation bug](https://github.com/expo/expo/issues/49214), also [reported on SDK 57](https://github.com/expo/expo/issues/50067). It removes only the invalid Swift ownership annotations from the two constructors in `expo-modules-jsi`, preserving the class's ARC retain/release behavior. The fix also runs before `npm run ios`, survives dependency reinstalls, and does nothing when the header is already fixed. No dependency versions are changed.

For an existing Xcode checkout, run `npm run fix:ios-jsi` from the repository root, then use **Product → Clean Build Folder** and build the `.xcworkspace` again. This manual command is also needed when dependency lifecycle scripts were disabled with `--ignore-scripts`. Do not delete or regenerate your native project just to apply this header fix. Run `npm run test:ios-jsi` to check the workaround independently of the app's other tests.

`modules/daybreak-alarm-kit` is discovered by Expo local-module autolinking. Its podspec weak-links AlarmKit, and all framework usage is availability-guarded for iOS 26. `NSAlarmKitUsageDescription` is configured in `app.json`. Use your own bundle identifier/signing team for a physical device. `eas.json` includes development, preview, and production profiles if you choose EAS Build; no EAS project, account, or signing credentials have been configured.

Apple keeps a system Stop action available. Challenges guide the in-app wake-up flow; they cannot enforce completion from the lock screen. Refresh's in-app snooze schedules a new fixed alarm, so this version doesn't require a countdown Live Activity extension. See [Apple's AlarmKit walkthrough](https://developer.apple.com/videos/play/wwdc2025/230/) and [AlarmManager documentation](https://developer.apple.com/documentation/alarmkit/alarmmanager).

Android uses `modules/refresh-alarm`: `AlarmManager.setAlarmClock`, a media-playback foreground service on the alarm audio stream, and a full-screen intent opening the app over the lock screen. Native playback continues through missions and stops on completion or snooze. `plugins/with-refresh-alarm.cjs` configures the activity and bundles full adhan recordings. Enable notifications, Alarms & reminders, and Lock-screen alarms in Settings. Existing future notification-based alarms migrate once permissions are granted. Build again with `npx expo run:android`; Expo Go and previously installed builds cannot load this native module. See [Android checks](docs/android-alarms.md).

## Verification

```sh
npm run typecheck
npm run test:unit
npm run test:e2e  # Start npm run web on port 8081 first; uses installed Microsoft Edge.
npx expo-doctor
npx expo export --platform all
```

Browser tests cover onboarding, create/edit/delete and persisted alarms, sound/challenge selection, math completion, memory matching, shake preview and fallback, journal save, snooze off, wheel input, and complete multi-mission sequences. Unit tests exercise repeat schedules, day boundaries, validation, and puzzle generation. Screenshots are saved in `artifacts/screenshots`.

See [motion artwork and behavior](docs/motion.md) for the editable Lottie generator, lifecycle handling, and motion-specific checks. Run `node scripts/review-motion.cjs` to capture the animated missions. Rebuild an existing native development client after adding Lottie.

**Native validation still required:** Swift compilation/signing and actual iPhone alarm delivery, silent/Focus behavior, reboot and cold launch, time-zone/DST changes, motion permissions, and release-device animation performance. These cannot be verified by JavaScript exports or a Windows browser. See [device verification](docs/device-verification.md).

## Structure

```
src/app/                 Expo Router routes
src/screens/             Screen implementations
src/components/          Shared controls, art views, and native icons
src/theme.ts             Design tokens and art references
src/state/app-state.tsx  Persisted state and alarm mutations
src/services/            AlarmKit bridge and notification scheduling
src/utils/               Time / puzzle logic and tests
modules/                 iOS AlarmKit Expo module
assets/art/              Generated clay illustrations
docs/                    Image prompts and native verification notes
```

All artwork was generated with the built-in ImageGen workflow from the supplied style reference. Exact prompts and output paths are recorded in [art direction](docs/art-direction.md).

## Missions and subtle Islamic styling

Number trail adds ascending/descending number search. Tile recall highlights blank tiles together for two seconds, then asks you to find them in any order: Easy uses a 4×4 grid with three targets; Hard uses a 6×6 grid with eight targets. Pattern echo lights up six pads in sequence before you repeat it. The boards fill the available phone screen. All three support difficulty, independent rounds, previews, and a one-minute mission deadline. Existing Colour focus / Shape match selections automatically use Tile recall. Missions remain optional and can be combined in selection order.

Fajr reminder displays one of five complete hadiths, with full Arabic narration, prominent English translation, narrator and linked reference. Chapter headings are omitted to keep the focus on the hadith. It rotates after a completed wake-up; previews and timed-out attempts do not advance it. Multiple rounds show successive reminders. Reading has a five-minute limit. The Android native module must be rebuilt to support that longer limit; older binaries retain their existing one-minute deadline.

The supplication mission lets each alarm choose one or more of the three existing duas. Arabic, transliteration, translation, sources and recitation counts are unchanged. Older saved alarms retain all three until edited. Preview and alarm playback use the selected subset.

Built-in artwork is faceless, with small lanterns, a crescent, an arched pavilion and geometric details in the existing clay palette. See `docs/art-direction.md` for saved assets and exact generation prompts.
