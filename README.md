# Daybreak

A gentle alarm app built with **Expo SDK 54, React Native, and TypeScript**. The supplied reference drives the midnight palette, clay illustrations, peach buttons, lavender surfaces, and sculptural time dial.

## Run

```sh
npm install
npm run web
# Native UI preview (AlarmKit needs a development build):
npx expo start --go
```

The browser preview runs at the URL printed by Expo. Browser alarms are explicitly previews and only work while the page is open. Start with onboarding, create an alarm, or use **Home → Try your morning experience** to explore the wake-up flow immediately.

## Included

- Four-step onboarding and contextual alarm permission request.
- Persisted alarm creation, editing, enabling/disabling, deletion, repeat days, AM/PM, labels, and 5/10/15-minute snooze.
- Local **Swift AlarmKit module for iOS 26+**: authorization, relative/weekly and fixed scheduling, cancellation, stop, state lookup, and an App Intent that opens the relevant wake-up screen after a cold launch.
- Local notification fallback on older iOS and Android, with a high-importance Android alarm channel.
- Math puzzles, shuffled memory pairs, and accelerometer shake detection. Gentle/bright difficulty, progress, haptics, and an accessible math alternative.
- Six illustrated sound preferences, three visual themes, a silent breathing timer, and a private on-device morning journal.
- Reanimated feedback and clay illustration motion, reduced-motion support, safe areas, scrollable forms, and native SF Symbols on iOS.
- A test-alarm action in Settings and explicit permission/fallback status.

**No audio assets are included.** The alarm sound is the device default. Sound collection choices are saved as metadata; they deliberately do not pretend to play a preview. Extend the `SoundId` catalog and scheduler sound resolver when adding actual audio or adhan. Prayer-time calculation, location, and an adhan engine are not implemented in this version.

## iOS AlarmKit development build

AlarmKit is custom Swift code, so it cannot run inside Expo Go. Use a Mac with Xcode 26 or later (including the iOS 26 SDK) to compile the AlarmKit integration:

```sh
npx expo prebuild --platform ios
npx expo run:ios --device
```

`modules/daybreak-alarm-kit` is discovered by Expo local-module autolinking. Its podspec weak-links AlarmKit, and all framework usage is availability-guarded for iOS 26. `NSAlarmKitUsageDescription` is configured in `app.json`. Use your own bundle identifier/signing team for a physical device. `eas.json` includes development, preview, and production profiles if you choose EAS Build; no EAS project, account, or signing credentials have been configured.

Apple keeps a system Stop action available. Challenges guide the in-app wake-up flow; they cannot enforce completion from the lock screen. Daybreak's in-app snooze schedules a new fixed alarm, so this version doesn't require a countdown Live Activity extension. See [Apple's AlarmKit walkthrough](https://developer.apple.com/videos/play/wwdc2025/230/) and [AlarmManager documentation](https://developer.apple.com/documentation/alarmkit/alarmmanager).

On Android and earlier iOS, this version provides notification-based reminders, not an Android alarm-clock service. Focus, channel settings, exact-alarm permission, and battery restrictions can affect those alerts. The app explains this fallback in Settings. No remote push server is needed.

## Verification

```sh
npm run typecheck
npm run test:unit
npm run test:e2e  # Start npm run web on port 8081 first; uses installed Microsoft Edge.
npx expo-doctor
npx expo export --platform all
```

Browser tests cover onboarding, create/edit/delete and persisted alarms, sound/challenge selection, math completion, memory matching, shake preview and fallback, journal save, and the breathing ritual. Unit tests exercise repeat schedules, day boundaries, validation, and puzzle generation. Screenshots are saved in `artifacts/screenshots`.

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
