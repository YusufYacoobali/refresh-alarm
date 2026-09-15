# Refresh motion

Thirteen original Lottie compositions are bundled in `assets/motion` (about 339 KB combined). They are generated from the authored shapes and keyframes in `scripts/generate-lottie.cjs`; run `node scripts/generate-lottie.cjs` to regenerate them. No third-party animation files, remote media, fonts, audio, or credentials are used.

| Scene | Where it appears |
| --- | --- |
| Waking sun | Alarm ringing, onboarding, simple mission selection |
| Calculator friend | Math mission and mission selection |
| Memory friends | Matching mission, onboarding, mission selection |
| Shake friend | Shake mission and mission selection |
| Morning bloom | Wake-up completion; confetti plays once |
| Stardust | Home landscape and ringing |
| Moon cradle | Available alternate illustration |
| Dawn garden | Available alternate illustration |
| Cloud clock | Permission onboarding page |
| Shooting star | Get started button press |
| Sunrise sweep | Second onboarding button press |
| Matching clay tiles | Third onboarding button press |
| Ringing bell | Final onboarding button press |

The compositions use rounded paths, gradient fills, offset edges, small contact shadows, and the app's peach/lavender/mint palette. Native playback uses `lottie-react-native`; web uses the bundled `lottie-web` SVG renderer, with no CDN or WASM download.

## Interaction feedback

- Press-in compression and release, animated selected chips and cards, tab icon lift, card entrances, and color transitions.
- Compact custom hour and minute wheels sit inside the sculpted clay ring on every platform, with snapping, fading numbers, and haptic ticks. AM/PM chips sit below the numbers; tapping a ring bead updates the minute wheel and animated marker. Repeat-day options enter and leave smoothly.
- The ring scales to 288 points (272 on a 320-point phone), with 28-point numerals in 40-point rows. Neighboring numbers can be tapped. Native wheels use normal scroll deceleration; web uses explicit CSS snapping, smooth wheel input, and mouse dragging with release momentum. Scroll acknowledgments cannot rewind an ongoing glide; the first and last rows center fully and remain selectable.
- Math questions enter individually; incorrect answers shake the question card, and correct answers briefly expand it and advance the animated progress bar.
- Memory cards turn in 3D, matched pairs settle with a checkmark, and mismatches turn face down again.
- Every counted shake animates the companion and counter. Sensor thresholds and mission scoring remain independent of animation timing.
- Onboarding pages slide together with subtle illustration parallax and changing progress indicators. Only the active page’s Lottie plays; hidden pages pause. Landscapes float behind local animated sparkles.
- The first two onboarding pages use the original moon and valley artwork. The mission and permission pages use Lottie.
- Each primary onboarding button has a distinct 800 ms, one-shot Lottie illustration. Its label briefly fades as the next page slides into place. Rapid duplicate presses are ignored during the handoff. Permission and persistence start immediately; final navigation waits only for the bounded visual handoff, independently of Lottie loading. Reduced motion skips this travel and delay. Leaving the screen or backgrounding clears the effect.

## Haptics

`src/services/haptics.ts` centralizes tactile feedback. Buttons use a light impact; chips, cards, dial controls, and tabs use selection ticks. Alarm toggles have a light pulse. Saves, deletion, snooze, onboarding completion, and journal/theme changes report success only after the operation succeeds; failed persistence reports an error. Opening the delete confirmation uses a firmer impact.

Math answers use success/error feedback. Memory uses a selection tick for the first card and success/warning for the pair; ignored taps stay silent. Each counted shake gets one light pulse, replaced by success on final completion. Completion never also emits a generic button pulse. Decorative animation loops do not vibrate.

Android uses its native semantic haptic effects; iOS uses selection, impact, and notification feedback. Calls are fire-and-forget, suppress feedback in the background, and safely tolerate unavailable hardware. Reduced motion does not disable tactile feedback. Browser regression tests instrument the vibration boundary to check pulse counts, outcome patterns, and failure isolation; physical-device testing is still required to judge strength and timing.

## Lifecycle and accessibility

The shared motion provider observes system reduced-motion changes and app visibility. Lottie pauses when its route loses focus or the app moves into the background. Reduced-motion mode uses a still illustration, immediate card flips, and no spatial press or feedback effects. Decorative art is hidden from assistive technology; mission progress and errors remain readable text.

Animation frames never drive scoring, scheduling, snooze, or completion. The app does not wait for a Lottie sequence before saving an alarm or finishing a mission.

## Verification

`node scripts/review-motion.cjs` renders each mission, compares changing SVG frames, checks reduced-motion stillness, captures screenshots under `artifacts/motion`, and reports browser runtime errors. `tests/motion.spec.ts` verifies live playback, dynamic reduced motion, background pausing/resuming, and wrong-answer scoring. Existing end-to-end tests cover alarm persistence and mission completion.

For production checks, run `npx expo export --platform all`, then `node scripts/serve-preview.cjs`. Set `DAYBREAK_TEST_URL=http://127.0.0.1:8082` when running Playwright or the review scripts. The production preview avoids slow development-bundle downloads from Metro.

Native development builds must be rebuilt to include Lottie. Check memory flips, rapid taps, physical shake feedback, VoiceOver, background/resume, and frame pacing on a release build on a physical device; browser verification does not establish native performance.
