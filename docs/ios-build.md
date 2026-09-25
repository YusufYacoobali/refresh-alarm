# iOS build recovery and validation

Use Node.js 22.13+ and Xcode 26.4+ with the full Xcode app selected in
Xcode Settings > Locations > Command Line Tools. These are the
[Expo SDK 57 requirements](https://docs.expo.dev/versions/v57.0.0/).
Check the selected tools in the same terminal used for the build:

```sh
node --version
xcodebuild -version
xcrun swift --version
```

## Fixes in this checkout

`patches/expo-modules-jsi+57.1.0.patch` addresses both failures in Expo's JSI
bridge, and `npm ci` / `npm install` apply it through `postinstall`:

- Remove invalid `SWIFT_RETURNS_RETAINED` annotations from the two C++
  constructors. Keep `SWIFT_SHARED_REFERENCE` and retain/release semantics.
  See [Expo issue 49214](https://github.com/expo/expo/issues/49214).
- Wrap the seven raw-pointer captures in a private, explicitly Sendable value
  wrapper: the host-object getter and both host-function callbacks. Unwrap only
  inside the synchronous actor closure. The C++ caller owns these pointers for
  the whole call; `withGuaranteedContext` and `assumeIsolated` run inline. The
  wrapper must never escape or be reused for asynchronous work. Actor checks,
  error forwarding, and Swift 6 concurrency checking remain enabled.
- Use valid Swift language mode `5.0` for the app's AlarmKit pod. The previous
  `5.9` value confused the compiler version with a supported language mode.
  This does not change Expo's Swift 6 language mode or the Xcode requirement.

The patch is tied to the lockfile's JSI version. When upgrading Expo, review
whether upstream has fixed these issues; regenerate or remove the patch as
appropriate. Never ignore a patch failure or use `--ignore-scripts` for a build.

## Recover an existing Mac checkout

### `Cannot find 'DaybreakAlarmSound' in scope`

The volume helper is defined in
`modules/daybreak-alarm-kit/ios/DaybreakAlarmSound.swift`. It must be present in
the Mac checkout alongside `DaybreakAlarmKitModule.swift`. The podspec already
includes all Swift files in that directory, but a previously generated Pods
project may still have the source list from before this file was added.

After bringing the Mac checkout up to date, close Xcode and run from the repo root:

```sh
cd ios
pod install
open Refresh.xcworkspace
```

If the project uses Bundler for CocoaPods, use `bundle exec pod install` instead.
In Xcode, choose **Product > Clean Build Folder**, then build again. Confirm
`DaybreakAlarmSound.swift` appears in the **DaybreakAlarmKit** pod target's
**Build Phases > Compile Sources**. Do not add it to the app target; it must
compile in the same module as `DaybreakAlarmKitModule.swift`. This refresh does
not require deleting `ios/` or changing the sound implementation.

### Full native regeneration

Commit or back up any manual edits to the generated `ios/` directory first.
This repository ignores that directory; `--clean` regenerates it and removes
local Podfile/build-setting workarounds. Run these commands from the repo root:

```sh
# Restores dependencies and applies the complete checked-in patch.
npm ci
# Replaces generated native configuration, including any earlier workaround.
npx expo prebuild --clean --platform ios
# Rebuilds native code without the previous Xcode build cache.
npx expo run:ios --device --no-build-cache
```

`npm ci` also replaces the dependency's local JSI build products. The generated
workspace is `ios/Refresh.xcworkspace`; open the workspace when building in
Xcode. Select your signing team and iPhone there if necessary. Do not globally
disable concurrency checks or change all Pods to Swift 5.

## Native validation

After the Debug device build, verify Release compilation without signing:

```sh
xcodebuild -workspace ios/Refresh.xcworkspace -scheme Refresh \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  CODE_SIGNING_ALLOWED=NO build
```

Then run a signed build on an iOS 26+ iPhone and follow
[device verification](device-verification.md), especially AlarmKit authorization,
locked/silent/Focus delivery, the single stop slider opening the alarm wallpaper,
one-minute mission backups, cold-launch routing, and completion/cancel cleanup.
On iOS 16.4–25, verify the documented notification fallback instead.

TypeScript checks, Expo diagnostics, successful patch application, and an iOS
JavaScript export do not prove Swift compilation or system alarm delivery.
The repair was prepared on Windows; Xcode builds and physical-device checks
remain required on a Mac/iPhone.

## Late iPhone alarm investigation — 23 September 2026

The reported 07:20 alarm first sounding at 07:28 was on **iOS**, not Android. Its exact cause is not reproduced or confirmed fixed. The JS scheduler passes the selected hour/minute directly to AlarmKit; a mocked-native regression now checks 07:20 explicitly.

- Defer the foreground audio handoff while iOS is inactive/backgrounded, including rechecking after asynchronous reminder cleanup. The system alarm must not be stopped merely because its state event reached JS behind the lock screen.
- On iOS 26+, refuse to enable a new alarm if the AlarmKit bridge is unavailable instead of silently registering an ordinary notification. Earlier iOS versions retain the notification fallback, now marked `timeSensitive` with its entitlement. Notification settings can still override time-sensitive delivery; see [Apple's delivery documentation](https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel/timesensitive) and [Expo SDK 57 notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/).
- Native Console category `AlarmTiming` records accepted schedules (hour, minute, timezone and fixed timestamp), observed alert-state updates, and app-requested stops. These are observation timestamps, not proof of the exact moment audio became audible; observation may resume late if the app was suspended.
- Rebuild iOS to include the timing logs, time-sensitive entitlement and trimmed bundled adhan excerpts. On the affected iPhone, save an alarm a few minutes ahead and verify locked, Silent/Focus, foreground, and cold-launch cases against a second clock. Record iOS version, whether the system alert appeared on time, and whether the app was opened at 07:28. No artificial eight-minute offset has been introduced or removed.

The five new mocked-native tests cover scheduling, bridge availability, fallback priority and inactive/background handoff ordering. They do not replace an Xcode build or physical-device delivery test.

Validation on September 17, 2026: TypeScript passed; all 16 existing unit tests
passed; Expo Doctor passed 21/21 checks; SDK dependencies were aligned; Apple
autolinking found `DaybreakAlarmKitModule`; the iOS export bundled 1,953 modules.
The dependency patch was reversed, reapplied to original sources, and applied
again successfully. Native Debug/Release compilation and device delivery are
not yet verified.
