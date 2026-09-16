package expo.modules.refreshalarm

import android.app.ActivityOptions
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import org.json.JSONObject

object AlarmStore {
  private fun prefs(c: Context) = c.getSharedPreferences("refresh.alarms", Context.MODE_PRIVATE)
  fun canSchedule(c: Context) = Build.VERSION.SDK_INT < 31 || c.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
  fun get(c: Context, id: String): JSONObject? = prefs(c).getString("alarm:$id", null)?.let { JSONObject(it) }
  fun active(c: Context): JSONObject? = prefs(c).getString("active", null)?.let { JSONObject(it) }
  fun clearActive(c: Context) { prefs(c).edit().remove("active").commit() }
  fun setActive(c: Context, alarm: JSONObject, synchronous: Boolean = true) {
    val edit = prefs(c).edit().putString("active", alarm.toString())
    if (synchronous) edit.commit() else edit.apply()
  }
  fun launch(c: Context, id: String): PendingIntent {
    val intent = requireNotNull(c.packageManager.getLaunchIntentForPackage(c.packageName))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      .setAction("refresh.OPEN.$id")
    val options = if (Build.VERSION.SDK_INT >= 35) ActivityOptions.makeBasic().apply {
      setPendingIntentCreatorBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
    }.toBundle() else null
    return PendingIntent.getActivity(c, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE, options)
  }
  private fun trigger(c: Context, id: String): PendingIntent = PendingIntent.getBroadcast(c, 0,
    Intent(c, AlarmReceiver::class.java).setAction("refresh.RING")
      .setData(Uri.parse("refresh-alarm://scheduled/$id")).putExtra("id", id),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  fun next(alarm: JSONObject, now: Long = System.currentTimeMillis()): Long {
    val fixed = alarm.optLong("timestamp", 0L)
    if (fixed > 0) return fixed
    val days = alarm.getJSONArray("days")
    return AlarmTiming.next(alarm.getInt("hour"), alarm.getInt("minute"), (0 until days.length()).map { days.getInt(it) }, now)
  }
  @Synchronized fun schedule(c: Context, alarm: JSONObject) {
    check(canSchedule(c)) { "Enable the Alarms & reminders permission for Refresh." }
    val id = alarm.getString("id")
    if (alarm.has("soundUri")) {
      val uri = Uri.parse(alarm.getString("soundUri"))
      val file = java.io.File(requireNotNull(uri.path)).canonicalFile
      check(uri.scheme == "file" && file.path.startsWith(c.filesDir.canonicalPath + java.io.File.separator) && file.isFile) { "This imported audio is missing. Import it again." }
    }
    val at = next(alarm)
    check(at > System.currentTimeMillis()) { "Choose a future alarm time." }
    val stored = JSONObject(alarm.toString()).put("scheduledAt", at)
    check(prefs(c).edit().putString("alarm:$id", stored.toString()).commit()) { "Could not save this alarm." }
    try {
      c.getSystemService(AlarmManager::class.java).setAlarmClock(AlarmManager.AlarmClockInfo(at, launch(c, id)), trigger(c, id))
    } catch (error: Exception) {
      prefs(c).edit().remove("alarm:$id").commit()
      throw error
    }
  }
  @Synchronized fun cancel(c: Context, id: String) {
    val intent = trigger(c, id)
    c.getSystemService(AlarmManager::class.java).cancel(intent)
    intent.cancel()
    prefs(c).edit().remove("alarm:$id").commit()
    if (active(c)?.optString("id") == id) {
      clearActive(c)
      c.stopService(Intent(c, AlarmRingService::class.java))
    }
  }
  @Synchronized fun fire(c: Context, id: String): JSONObject? {
    val alarm = get(c, id) ?: return null
    if (alarm.optLong("scheduledAt") > System.currentTimeMillis() + 1500) return null
    val active = JSONObject(alarm.toString()).put("eventId", "$id:${alarm.optLong("scheduledAt")}")
    setActive(c, active)
    if (alarm.optLong("timestamp", 0L) == 0L && alarm.getJSONArray("days").length() > 0) schedule(c, alarm)
    else prefs(c).edit().remove("alarm:$id").commit()
    return active
  }
  @Synchronized fun restore(c: Context) {
    if (!canSchedule(c)) return
    prefs(c).all.filterKeys { it.startsWith("alarm:") }.values.forEach { raw ->
      runCatching {
        val alarm = JSONObject(raw as String)
        if (alarm.optLong("timestamp", 0L) > 0 && alarm.getLong("timestamp") <= System.currentTimeMillis())
          prefs(c).edit().remove("alarm:${alarm.getString("id")}").commit()
        else if (alarm.getJSONArray("days").length() == 0 && alarm.optLong("scheduledAt") < System.currentTimeMillis())
          prefs(c).edit().remove("alarm:${alarm.getString("id")}").commit()
        else schedule(c, alarm)
      }
    }
  }
}
