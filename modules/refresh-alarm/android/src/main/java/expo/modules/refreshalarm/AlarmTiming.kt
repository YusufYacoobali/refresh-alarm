package expo.modules.refreshalarm

import java.util.Calendar

object AlarmTiming {
  fun next(hour: Int, minute: Int, days: List<Int>, now: Long): Long {
    require(hour in 0..23 && minute in 0..59 && days.all { it in 0..6 })
    for (offset in 0..7) {
      val date = Calendar.getInstance().apply {
        timeInMillis = now
        add(Calendar.DAY_OF_YEAR, offset)
        set(Calendar.HOUR_OF_DAY, hour); set(Calendar.MINUTE, minute)
        set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
      }
      if (date.timeInMillis > now && (days.isEmpty() || days.contains(date.get(Calendar.DAY_OF_WEEK) - 1))) return date.timeInMillis
    }
    error("Invalid repeat days")
  }
}
