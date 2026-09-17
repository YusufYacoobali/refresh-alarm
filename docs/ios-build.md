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
locked/silent/Focus delivery, cold-launch Wake up, snooze, and stop/cancel.
On iOS 16.4–25, verify the documented notification fallback instead.

TypeScript checks, Expo diagnostics, successful patch application, and an iOS
JavaScript export do not prove Swift compilation or system alarm delivery.
The repair was prepared on Windows; Xcode builds and physical-device checks
remain required on a Mac/iPhone.

Validation on September 17, 2026: TypeScript passed; all 16 existing unit tests
passed; Expo Doctor passed 21/21 checks; SDK dependencies were aligned; Apple
autolinking found `DaybreakAlarmKitModule`; the iOS export bundled 1,953 modules.
The dependency patch was reversed, reapplied to original sources, and applied
again successfully. Native Debug/Release compilation and device delivery are
not yet verified.
