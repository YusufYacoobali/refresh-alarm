package expo.modules.refreshalarm

import kotlin.math.roundToInt

object AlarmPlaybackPolicy {
  const val MISSION_IDLE_MS = 60_000L
  fun missionLimit(requestedMs: Long) = requestedMs.coerceIn(MISSION_IDLE_MS, 300_000L)
  fun gain(elapsedMs: Long, rampSeconds: Int): Float =
    if (rampSeconds <= 0) 1f else 0.1f + 0.9f * (elapsedMs.toFloat() / (rampSeconds * 1000L)).coerceIn(0f, 1f)
  fun streamLevel(volume: Double, max: Int): Int =
    (volume.coerceIn(0.1, 1.0) * max).roundToInt().coerceIn(1, max.coerceAtLeast(1))
  fun expired(deadline: Long, now: Long) = deadline > 0 && now >= deadline
}
