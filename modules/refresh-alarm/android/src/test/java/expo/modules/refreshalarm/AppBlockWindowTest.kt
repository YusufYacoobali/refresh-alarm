package expo.modules.refreshalarm

import org.junit.Assert.*
import org.junit.Test

class AppBlockWindowTest {
  @Test fun lastsFiveMinutesIncludingWhileMissionsAreFinished() {
    val start = 1_000_000L
    val end = start + 300_000L
    assertFalse(AppBlockWindow.active(start, end, start - 1))
    assertTrue(AppBlockWindow.active(start, end, start))
    assertTrue(AppBlockWindow.active(start, end, start + 60_000))
    assertTrue(AppBlockWindow.active(start, end, end - 1))
    assertFalse(AppBlockWindow.active(start, end, end))
    assertFalse(AppBlockWindow.active(start, end, end + 60_000))
  }
  @Test fun corruptOrClockRewoundWindowsFailOpen() {
    assertFalse(AppBlockWindow.active(100, 420_100, 200))
    assertFalse(AppBlockWindow.active(100, 300_100, 99))
  }
  @Test fun selectedDurationsExpireAtTheirOwnDeadline() {
    for (minutes in listOf(5, 10, 15, 30, 60)) {
      val end = 1_000L + AppBlockWindow.duration(minutes)
      assertEquals(minutes * 60_000L, end - 1_000L)
      assertTrue(AppBlockWindow.active(1_000, end, end - 1))
      assertFalse(AppBlockWindow.active(1_000, end, end))
    }
  }
  @Test(expected = IllegalArgumentException::class) fun rejectsUnsupportedDurations() {
    AppBlockWindow.duration(7)
  }
}
