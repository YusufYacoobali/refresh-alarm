package expo.modules.refreshalarm

import android.accessibilityservice.AccessibilityService
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class AppBlockService : AccessibilityService(), SharedPreferences.OnSharedPreferenceChangeListener {
  private val handler = Handler(Looper.getMainLooper())
  private var foreground: String? = null
  private var cover: LinearLayout? = null
  private var countdown: TextView? = null
  private val tick = object : Runnable {
    override fun run() { update(); if (cover != null) handler.postDelayed(this, 500) }
  }
  override fun onServiceConnected() { AppBlockStore.prefs(this).registerOnSharedPreferenceChangeListener(this) }
  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val name = event.packageName?.toString() ?: return
    // Our own accessibility overlay must not be mistaken for an app switch.
    if (name == packageName && cover != null) return
    foreground = name
    update()
  }
  override fun onSharedPreferenceChanged(prefs: SharedPreferences?, key: String?) { handler.post { update() } }
  private fun update() {
    val end = foreground?.let { AppBlockStore.until(this, it) } ?: 0L
    if (end <= System.currentTimeMillis()) { hide(); return }
    if (cover == null) {
      val view = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(48, 64, 48, 64)
        setBackgroundColor(Color.rgb(18, 19, 37))
      }
      view.addView(TextView(this).apply { text = "A scroll-free start"; textSize = 28f; setTextColor(Color.WHITE); gravity = Gravity.CENTER })
      countdown = TextView(this).apply { textSize = 18f; setTextColor(Color.rgb(189, 176, 245)); gravity = Gravity.CENTER; setPadding(0, 32, 0, 32) }
      view.addView(countdown)
      view.addView(Button(this).apply { text = "Back to home"; setOnClickListener { performGlobalAction(GLOBAL_ACTION_HOME); foreground = null; hide() } })
      val params = WindowManager.LayoutParams(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN, PixelFormat.OPAQUE)
      params.setTitle("Refresh app block")
      runCatching { getSystemService(WindowManager::class.java).addView(view, params) }.onFailure { return }
      cover = view
      handler.removeCallbacks(tick); handler.postDelayed(tick, 500)
    }
    val seconds = ((end - System.currentTimeMillis() + 999) / 1000).coerceAtLeast(0)
    countdown?.text = "This app unlocks in ${seconds / 60}:${(seconds % 60).toString().padStart(2, '0')}\nYour app block began with the alarm."
  }
  private fun hide() {
    handler.removeCallbacks(tick)
    cover?.let { runCatching { getSystemService(WindowManager::class.java).removeView(it) } }
    cover = null; countdown = null
  }
  override fun onInterrupt() { hide() }
  override fun onDestroy() { AppBlockStore.prefs(this).unregisterOnSharedPreferenceChangeListener(this); hide(); super.onDestroy() }
}
