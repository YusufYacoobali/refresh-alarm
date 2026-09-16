package expo.modules.refreshalarm

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues
import org.json.JSONObject

class RefreshAlarmModule : Module() {
  private val context: Context get() = requireNotNull(appContext.reactContext)
  override fun definition() = ModuleDefinition {
    Name("RefreshAlarm")
    Function("permissions") {
      AlarmRingService.ensureChannel(context)
      val manager = context.getSystemService(NotificationManager::class.java)
      mapOf("exact" to AlarmStore.canSchedule(context), "fullScreen" to
        (Build.VERSION.SDK_INT < 34 || manager.canUseFullScreenIntent()),
        "notifications" to manager.areNotificationsEnabled(),
        "channel" to (Build.VERSION.SDK_INT < 26 || manager.getNotificationChannel(AlarmRingService.CHANNEL_ID).importance >= NotificationManager.IMPORTANCE_HIGH))
    }
    AsyncFunction("openSettings") { kind: String ->
      val action = if (kind == "exact" && Build.VERSION.SDK_INT >= 31) Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM
        else if (kind == "fullScreen" && Build.VERSION.SDK_INT >= 34) Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT
        else Settings.ACTION_APPLICATION_DETAILS_SETTINGS
      val intent = if (kind == "channel" && Build.VERSION.SDK_INT >= 26)
        Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName).putExtra(Settings.EXTRA_CHANNEL_ID, AlarmRingService.CHANNEL_ID)
        else Intent(action, Uri.parse("package:${context.packageName}"))
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    AsyncFunction("schedule") { json: String -> AlarmStore.schedule(context, JSONObject(json)) }
    AsyncFunction("cancel") { id: String -> AlarmStore.cancel(context, id) }
    Function("activeAlarm") {
      val active = AlarmStore.active(context)
      appContext.currentActivity?.let { activity -> activity.runOnUiThread { AlarmWindow.update(activity) } }
      active?.let { mapOf("alarmId" to it.getString("alarmId"), "eventId" to it.getString("eventId")) }
    }
    AsyncFunction("setMissionSilenced") { eventId: String, silent: Boolean ->
      AlarmRingService.silenceMission(eventId, silent)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("missionActivity") { eventId: String ->
      AlarmRingService.missionActivity(eventId)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("stop") { alarmId: String ->
      if (AlarmStore.active(context)?.optString("alarmId") == alarmId) {
        AlarmStore.clearActive(context)
        context.stopService(Intent(context, AlarmRingService::class.java))
        appContext.currentActivity?.let { activity -> activity.runOnUiThread { AlarmWindow.update(activity) } }
      }
    }.runOnQueue(Queues.MAIN)
  }
}
