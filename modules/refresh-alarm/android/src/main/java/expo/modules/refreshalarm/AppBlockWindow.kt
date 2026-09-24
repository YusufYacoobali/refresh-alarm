package expo.modules.refreshalarm

object AppBlockWindow {
  private val minutes = setOf(5, 10, 15, 30, 60)
  fun duration(value: Int): Long {
    require(value in minutes) { "Choose a valid app-block duration." }
    return value * 60_000L
  }
  fun active(start: Long, end: Long, now: Long) = minutes.any { end - start == it * 60_000L } && now >= start && now < end
}
