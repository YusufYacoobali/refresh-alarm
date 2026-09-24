package expo.modules.refreshalarm

import android.content.Context
import android.os.PowerManager

/** AlarmManager's wake lock ends with onReceive, before the service may start. */
object AlarmHandoff {
  private var lock: PowerManager.WakeLock? = null
  @Synchronized fun acquire(context: Context) {
    val wake = lock ?: context.getSystemService(PowerManager::class.java)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Refresh:alarm-handoff")
      .apply { setReferenceCounted(false) }.also { lock = it }
    wake.acquire(30_000L)
  }
  @Synchronized fun release() {
    lock?.let { if (it.isHeld) it.release() }
    lock = null
  }
}
