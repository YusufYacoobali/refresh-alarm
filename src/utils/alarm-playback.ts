export const MISSION_LIMIT_MS = 60_000;

export function missionSecondsLeft(deadline: number, now: number, limitMs = MISSION_LIMIT_MS) {
  return Math.max(0, Math.min(limitMs / 1000, Math.ceil((deadline - now) / 1000)));
}

/** Gain relative to the chosen alarm volume. A reminder rings at full chosen volume. */
export function alarmGain(elapsedMs: number, rampSeconds = 0) {
  return rampSeconds <= 0 ? 1 : 0.1 + 0.9 * Math.min(1, Math.max(0, elapsedMs / (rampSeconds * 1000)));
}
