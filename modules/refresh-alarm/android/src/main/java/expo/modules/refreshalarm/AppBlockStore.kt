package expo.modules.refreshalarm

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.Intent
import android.view.accessibility.AccessibilityManager
import org.json.JSONArray
import org.json.JSONObject

object AppBlockStore {
  fun prefs(c: Context) = c.getSharedPreferences("refresh.appBlocking", Context.MODE_PRIVATE)
  fun authorized(c: Context): Boolean = c.getSystemService(AccessibilityManager::class.java)
    .getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
    .any { it.resolveInfo.serviceInfo.packageName == c.packageName && it.resolveInfo.serviceInfo.name == AppBlockService::class.java.name }

  // Only launchable apps can be selected. System Settings, the launcher and Refresh
  // remain reachable so access can always be revoked by the person using the phone.
  fun apps(c: Context): List<Map<String, Any>> {
    val pm = c.packageManager
    val homes = pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0).map { it.activityInfo.packageName }.toSet()
    val suggested = setOf("com.instagram.android", "com.facebook.katana", "com.facebook.lite", "com.zhiliaoapp.musically", "com.ss.android.ugc.trill", "com.snapchat.android", "com.twitter.android", "com.reddit.frontpage", "com.pinterest", "com.instagram.barcelona", "com.linkedin.android", "com.tumblr", "com.discord", "com.google.android.youtube")
    return pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)
      .filter { it.activityInfo.packageName != c.packageName && it.activityInfo.packageName !in homes && it.activityInfo.packageName != "com.android.settings" && it.activityInfo.packageName != "com.android.systemui" }
      .distinctBy { it.activityInfo.packageName }.map {
        mapOf("id" to it.activityInfo.packageName, "name" to it.loadLabel(pm).toString(), "suggested" to suggested.contains(it.activityInfo.packageName))
      }.sortedBy { it["name"].toString().lowercase() }
  }
  fun validate(c: Context, selection: String): Set<String> {
    val json = JSONArray(selection)
    val allowed = apps(c).map { it["id"] as String }.toSet()
    val packages = (0 until json.length()).map { json.getString(it) }.toSet()
    check(packages.isNotEmpty() && packages.all { it in allowed }) { "Choose installed apps to block again." }
    return packages
  }
  fun start(c: Context, alarm: JSONObject) {
    val selection = alarm.optString("appBlockSelection")
    if (selection.isEmpty() || !authorized(c)) return
    val event = alarm.getString("eventId")
    if (prefs(c).contains(event)) return // Delivery retries never extend the window.
    val json = runCatching { JSONArray(selection) }.getOrNull() ?: return
    // Selection was validated on save. Do not scan installed apps in the alarm
    // receiver: that could delay playback. Removed packages produce no events.
    val packages = (0 until json.length()).map { json.optString(it) }
      .filter { it.isNotEmpty() && it != c.packageName && it != "com.android.settings" && it != "com.android.systemui" }
    if (packages.isEmpty()) return
    val start = alarm.getLong("receivedAt")
    val duration = AppBlockWindow.duration(alarm.optInt("appBlockMinutes", 5))
    prefs(c).edit().putString(event, JSONObject().put("start", start).put("end", start + duration).put("packages", JSONArray(packages.toList())).toString()).commit()
  }
  fun until(c: Context, packageName: String? = null, now: Long = System.currentTimeMillis()): Long {
    var end = 0L
    val editor = prefs(c).edit()
    prefs(c).all.forEach { (key, raw) ->
      val session = runCatching { JSONObject(raw as String) }.getOrNull()
      if (session == null || !AppBlockWindow.active(session.optLong("start"), session.optLong("end"), now)) editor.remove(key)
      else {
        val packages = session.getJSONArray("packages")
        if (packageName == null || (0 until packages.length()).any { packages.getString(it) == packageName }) end = maxOf(end, session.getLong("end"))
      }
    }
    editor.apply()
    return end
  }
}
