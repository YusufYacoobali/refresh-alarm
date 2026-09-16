export const MISSION_IDLE_MS = 60_000;

/** Gain relative to the chosen alarm volume. A reminder rings at full chosen volume. */
export function alarmGain(elapsedMs: number, rampSeconds = 0) {
  return rampSeconds <= 0 ? 1 : 0.1 + 0.9 * Math.min(1, Math.max(0, elapsedMs / (rampSeconds * 1000)));
}
