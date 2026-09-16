package expo.modules.refreshalarm

import android.app.Activity
import android.os.Build
import android.media.AudioManager
import android.view.WindowManager
import java.lang.ref.WeakReference

object AlarmWindow {
  private var current = WeakReference<Activity>(null)
  // Called on the main thread before publishing the full-screen notification.
  // A stopped activity must already be eligible to appear over the keyguard;
  // waiting for its next onResume/onNewIntent alone can be too late.
  fun refresh() {
    current.get()?.takeUnless { it.isFinishing || it.isDestroyed }?.let { update(it) }
  }
  @JvmStatic fun update(activity: Activity) {
    current = WeakReference(activity)
    val active = AlarmStore.active(activity) != null
    activity.volumeControlStream = if (active) AudioManager.STREAM_ALARM else AudioManager.USE_DEFAULT_STREAM_TYPE
    if (Build.VERSION.SDK_INT >= 27) {
      activity.setShowWhenLocked(active)
      activity.setTurnScreenOn(active)
    }
    val flags = WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
      (if (Build.VERSION.SDK_INT < 27) WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON else 0)
    if (active) activity.window.addFlags(flags) else activity.window.clearFlags(flags)
  }
}
