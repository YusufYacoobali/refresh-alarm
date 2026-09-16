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
      val service = Intent(context, AlarmRingService::class.java).putExtra("alarm", alarm.toString())
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(service) else context.startService(service)
    } else {
      if (intent.action == Intent.ACTION_BOOT_COMPLETED) AlarmStore.clearActive(context)
      AlarmStore.restore(context)
    }
  }
}
