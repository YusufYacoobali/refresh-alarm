package expo.modules.refreshalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.*
import org.json.JSONObject

class AlarmRingService : Service() {
  private var player: MediaPlayer? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var focus: AudioFocusRequest? = null
  private var vibrator: Vibrator? = null
  private val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
  private val audioManager get() = getSystemService(AudioManager::class.java)
  override fun onBind(intent: Intent?) = null
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val alarm = intent?.getStringExtra("alarm")?.let { JSONObject(it) } ?: AlarmStore.active(this)
    if (alarm == null) { stopSelf(); return START_NOT_STICKY }
    AlarmStore.setActive(this, alarm)
    val notifications = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) notifications.createNotificationChannel(
      NotificationChannel("refresh-ringing-v1", "Ringing alarms", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Full-screen wake-up alarms"
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setSound(null, null); enableVibration(false)
      })
    val open = AlarmStore.launch(this, alarm.getString("id"))
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "refresh-ringing-v1") else Notification.Builder(this)
    val notification = builder.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(alarm.getString("label")).setContentText("Time to wake up · tap to complete your missions")
      .setCategory(Notification.CATEGORY_ALARM).setPriority(Notification.PRIORITY_MAX)
      .setVisibility(Notification.VISIBILITY_PUBLIC).setOngoing(true).setAutoCancel(false)
      .setContentIntent(open).setFullScreenIntent(open, true)
      .addAction(Notification.Action.Builder(null, "Wake up", open).build()).build()
    startForeground(7301, notification)
    if (wakeLock == null) wakeLock = getSystemService(PowerManager::class.java)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Refresh:alarm").apply { acquire(60 * 60 * 1000L) }
    if (Build.VERSION.SDK_INT >= 26) {
      focus?.let { audioManager.abandonAudioFocusRequest(it) }
      focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        .setAudioAttributes(attributes).setOnAudioFocusChangeListener { }.build()
      audioManager.requestAudioFocus(focus!!)
    } else audioManager.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
    val resource = alarm.optString("soundName").substringBeforeLast('.')
    val resId = if (resource.isNotBlank()) resources.getIdentifier(resource, "raw", packageName) else 0
    val fallback = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
    val uri = if (alarm.has("soundUri")) Uri.parse(alarm.getString("soundUri")) else if (resId != 0) Uri.parse("android.resource://$packageName/$resId") else fallback
    play(uri, fallback, true)
    vibrator = getSystemService(VIBRATOR_SERVICE) as Vibrator
    if (Build.VERSION.SDK_INT >= 26) vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 500, 300, 500, 1200), 0), attributes)
    else vibrator?.vibrate(longArrayOf(0, 500, 300, 500, 1200), 0)
    return START_STICKY
  }
  private fun play(source: Uri, fallback: Uri, retry: Boolean) {
    player?.release()
    val next = MediaPlayer()
    player = next
    next.setAudioAttributes(attributes)
    next.isLooping = true
    next.setOnPreparedListener { it.start() }
    next.setOnErrorListener { _, _, _ -> if (retry) play(fallback, fallback, false); true }
    try { next.setDataSource(this, source); next.prepareAsync() }
    catch (_: Exception) { if (retry) play(fallback, fallback, false) }
  }
  override fun onDestroy() {
    player?.release(); player = null
    vibrator?.cancel()
    if (wakeLock?.isHeld == true) wakeLock?.release()
    if (Build.VERSION.SDK_INT >= 26) focus?.let { audioManager.abandonAudioFocusRequest(it) }
    else audioManager.abandonAudioFocus(null)
    super.onDestroy()
  }
}
