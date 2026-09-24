package expo.modules.refreshalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == "refresh.RING") {
      val id = intent.getStringExtra("id") ?: return
      val alarm = AlarmStore.fire(context, id) ?: return
      // A blocker failure must never prevent the wake-up alarm from ringing.
      runCatching { AppBlockStore.start(context, alarm) }
        .onFailure { android.util.Log.e("RefreshAlarm", "Could not start app blocking", it) }
      val service = Intent(context, AlarmRingService::class.java).putExtra("alarm", alarm.toString())
      AlarmHandoff.acquire(context)
      try {
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(service) else context.startService(service)
      } catch (error: Exception) {
        AlarmHandoff.release()
        throw error
      }
    } else {
      if (intent.action == Intent.ACTION_BOOT_COMPLETED) AlarmStore.clearActive(context)
      AlarmStore.restore(context)
    }
  }
}
