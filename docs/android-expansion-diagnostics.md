# Android configuration expansion diagnostics

The configuration cards retain the existing Android safeguards: no card
entry/layout transition around changing content, no detached ScrollView
children, finite native picker dimensions, and a consent dialog outside the
clipped card. These safeguards are now scoped to the editor, app-block settings,
sound selection and existing mission-selection cards. Normal button feedback,
haptics, mission animations, shared entry animations, and iOS transitions remain
enabled.

Android development builds emit `[RefreshExpansion]` records for Repeat,
Sound & volume, Wake-up missions, More options and Block distracting apps:

1. `press` records the handler invocation and previous open state.
2. `committed` records the actual React open state after the render commits.
3. `layout` records the expanded body's native layout.
4. `windowBounds` records its measured screen coordinates and size.

For a failed first interaction, capture these records with the screen visible.
No `press` suggests an input/touch-target problem; a press without the expected
commit suggests a state problem; a commit followed by zero/stale bounds or
invisible content points to native layout/drawing. Compare dimensions after
scrolling and after navigating away and back. The trace contains section names,
request counters and geometry, with no app selections or alarm content.

No delays, retries or extra taps are introduced. Production builds attach no
diagnostic layout/measurement handlers. Consent handling and Settings-return
permission refresh are unchanged.

The configuration/motion browser checks and TypeScript check passed for this
follow-up. A physical Android device remains necessary to establish the native
root cause: the reported blank window has not been reproduced here, so clipping
and animated bounds remain a diagnosis supported by code inspection, not a
device-confirmed cause.
