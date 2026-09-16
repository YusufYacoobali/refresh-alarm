package expo.modules.refreshalarm

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.ZonedDateTime
import java.util.TimeZone

class AlarmTimingTest {
  private fun date(value: String) = ZonedDateTime.parse(value).toInstant().toEpochMilli()
  private fun inLondon(test: () -> Unit) {
    val previous = TimeZone.getDefault()
    try { TimeZone.setDefault(TimeZone.getTimeZone("Europe/London")); test() }
    finally { TimeZone.setDefault(previous) }
  }
  @Test fun `one off after midnight stays tomorrow`() = inLondon {
    assertEquals(date("2026-09-17T00:05:00+01:00"), AlarmTiming.next(0, 5, emptyList(), date("2026-09-16T23:59:00+01:00")))
  }
  @Test fun `same time already fired schedules following week`() = inLondon {
    assertEquals(date("2026-09-23T07:00:00+01:00"), AlarmTiming.next(7, 0, listOf(3), date("2026-09-16T07:00:00+01:00")))
  }
  @Test fun `weekday repeat skips weekend`() = inLondon {
    assertEquals(date("2026-09-21T07:00:00+01:00"), AlarmTiming.next(7, 0, listOf(1,2,3,4,5), date("2026-09-18T07:01:00+01:00")))
  }
  @Test fun `repeat follows local clock across daylight saving`() = inLondon {
    assertEquals(date("2026-03-29T07:00:00+01:00"), AlarmTiming.next(7, 0, listOf(0), date("2026-03-28T23:00:00Z")))
  }
}
