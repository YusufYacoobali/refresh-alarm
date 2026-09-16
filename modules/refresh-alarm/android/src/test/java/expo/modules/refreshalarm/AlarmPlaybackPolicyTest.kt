package expo.modules.refreshalarm

import org.junit.Assert.*
import org.junit.Test

class AlarmPlaybackPolicyTest {
  @Test fun rampStartsQuietlyAndStopsAtChosenVolume() {
    assertEquals(0.1f, AlarmPlaybackPolicy.gain(0, 30), 0.001f)
    assertEquals(0.55f, AlarmPlaybackPolicy.gain(15_000, 30), 0.001f)
    assertEquals(1f, AlarmPlaybackPolicy.gain(30_000, 30), 0.001f)
    assertEquals(1f, AlarmPlaybackPolicy.gain(90_000, 30), 0.001f)
    assertEquals(1f, AlarmPlaybackPolicy.gain(0, 0), 0.001f)
  }
  @Test fun individualVolumeMapsToAlarmStreamWithoutAccidentalMute() {
    assertEquals(6, AlarmPlaybackPolicy.streamLevel(0.8, 7))
    assertEquals(1, AlarmPlaybackPolicy.streamLevel(0.1, 7))
    assertEquals(7, AlarmPlaybackPolicy.streamLevel(1.0, 7))
  }
  @Test fun idleReminderExpiresAtOneMinuteAndNotBefore() {
    val deadline = 1234L + AlarmPlaybackPolicy.MISSION_IDLE_MS
    assertFalse(AlarmPlaybackPolicy.expired(0, 100_000))
    assertFalse(AlarmPlaybackPolicy.expired(deadline, 61_233))
    assertTrue(AlarmPlaybackPolicy.expired(deadline, 61_234))
    assertTrue(AlarmPlaybackPolicy.expired(deadline, 100_000))
    val renewed = 50_000 + AlarmPlaybackPolicy.MISSION_IDLE_MS
    assertFalse(AlarmPlaybackPolicy.expired(renewed, 61_234))
  }
}
