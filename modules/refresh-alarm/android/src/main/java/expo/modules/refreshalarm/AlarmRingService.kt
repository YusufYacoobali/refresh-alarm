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

class AlarmRingService : Service() {
  companion object {
    const val CHANNEL_ID = "refresh-ringing-v1"
    private var running: AlarmRingService? = null
    private var appVisible = false
    @JvmStatic fun setAppVisible(visible: Boolean) {
      appVisible = visible
      if (!visible) running?.silence(false)
    }
    fun silenceMission(eventId: String, silent: Boolean) {
      // Reject late JS mute requests after the screen has locked/backgrounded.
      running?.takeIf { it.eventId == eventId }?.silence(silent && appVisible)
    }
    fun missionActivity(eventId: String) {
      running?.takeIf { it.eventId == eventId && appVisible }?.touchMission()
    }
    fun ensureChannel(context: android.content.Context) {
      if (Build.VERSION.SDK_INT >= 26) context.getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Ringing alarms", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Full-screen wake-up alarms"
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
          setSound(null, null); enableVibration(false)
        })
    }
  }
  private val handler = Handler(Looper.getMainLooper())
  private val resume = Runnable { silence(false) }
  private var eventId: String? = null
  private var silent = false
  private var ringStarted = 0L
  private var rampSeconds = 0
  private var missionDeadline = 0L
  private var previousVolume: Int? = null
  private var appliedVolume: Int? = null
  private val pulse = object : Runnable {
    override fun run() {
      if (AlarmPlaybackPolicy.expired(missionDeadline, SystemClock.elapsedRealtime())) {
        remind()
        return // onStartCommand schedules the next pulse.
      }
      applyGain()
      handler.postDelayed(this, 250)
    }
  }
  private var player: MediaPlayer? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var focus: AudioFocusRequest? = null
  private var vibrator: Vibrator? = null
  private val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
  private val audioManager get() = getSystemService(AudioManager::class.java)
  override fun onBind(intent: Intent?) = null
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // A replayed start command must not resurrect an already dismissed alarm.
    val alarm = AlarmStore.active(this)
    if (alarm == null) { stopSelf(); return START_NOT_STICKY }
    if (eventId == alarm.getString("eventId")) return START_STICKY
    eventId = alarm.getString("eventId")
    running = this
    silent = false
    handler.removeCallbacks(resume)
    handler.removeCallbacks(pulse)
    ringStarted = SystemClock.elapsedRealtime()
    rampSeconds = if (alarm.optBoolean("reminder", false)) 0 else alarm.optInt("volumeRampSeconds", 0)
    missionDeadline = alarm.optLong("missionDeadline", 0L)
    // Persist the original level before changing it, including across service restarts.
    if (previousVolume == null && alarm.has("previousVolume")) {
      previousVolume = alarm.getInt("previousVolume")
      appliedVolume = alarm.getInt("appliedVolume")
    }
    if (alarm.has("volume")) {
      val target = AlarmPlaybackPolicy.streamLevel(alarm.getDouble("volume"), audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM))
      if (previousVolume == null) previousVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM)
      appliedVolume = target
      alarm.put("previousVolume", previousVolume).put("appliedVolume", target)
      AlarmStore.setActive(this, alarm)
      // Fixed-volume devices or policy restrictions must not prevent playback.
      runCatching { audioManager.setStreamVolume(AudioManager.STREAM_ALARM, target, 0) }
    }
    handler.post(pulse)
    ensureChannel(this)
    AlarmWindow.refresh()
    val open = AlarmStore.launch(this, alarm.getString("id"))
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL_ID) else Notification.Builder(this)
    if (Build.VERSION.SDK_INT >= 31) builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
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
    vibrate()
    return START_STICKY
  }
  private fun vibrate() {
    if (Build.VERSION.SDK_INT >= 26) vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 500, 300, 500, 1200), 0), attributes)
    else vibrator?.vibrate(longArrayOf(0, 500, 300, 500, 1200), 0)
  }
  private fun silence(value: Boolean) {
    handler.removeCallbacks(resume)
    if (silent != value) {
      silent = value
      applyGain()
      if (value) vibrator?.cancel() else vibrate()
    }
    // Renewed while the mission is visible; a stalled JS runtime must not leave
    // an unfinished alarm permanently muted. Activity pause also restores it.
    if (value) handler.postDelayed(resume, 30_000)
  }
  private fun applyGain() {
    val gain = if (silent) 0f else AlarmPlaybackPolicy.gain(SystemClock.elapsedRealtime() - ringStarted, rampSeconds)
    runCatching { player?.setVolume(gain, gain) }
  }
  private fun touchMission() {
    val active = AlarmStore.active(this) ?: return
    if (active.optString("eventId") != eventId || !active.optBoolean("missionReminder", true)) return
    // An interaction delivered after the deadline cannot cancel an overdue reminder.
    if (AlarmPlaybackPolicy.expired(missionDeadline, SystemClock.elapsedRealtime())) { remind(); return }
    missionDeadline = SystemClock.elapsedRealtime() + AlarmPlaybackPolicy.MISSION_IDLE_MS
    active.put("missionDeadline", missionDeadline)
    // Frequent card flips and shakes should not block rendering on disk I/O.
    AlarmStore.setActive(this, active, synchronous = false)
  }
  private fun remind() {
    val active = AlarmStore.active(this) ?: return
    if (active.optString("eventId") != eventId) return
    active.remove("missionDeadline")
    active.put("reminder", true).put("eventId", "${active.getString("id")}:reminder:${SystemClock.elapsedRealtime()}")
    AlarmStore.setActive(this, active)
    // Repost the alarm notification to wake a locked screen; the new occurrence
    // also sends the visible app back to the ringing screen and resets missions.
    stopForeground(STOP_FOREGROUND_REMOVE)
    onStartCommand(null, 0, 0)
  }
  override fun onTaskRemoved(rootIntent: Intent?) { silence(false); super.onTaskRemoved(rootIntent) }
  private fun play(source: Uri, fallback: Uri, retry: Boolean) {
    player?.release()
    val next = MediaPlayer()
    player = next
    next.setAudioAttributes(attributes)
    next.isLooping = true
    next.setOnPreparedListener {
      if (player === it) {
        applyGain()
        it.start()
      }
    }
    next.setOnErrorListener { _, _, _ -> if (retry) play(fallback, fallback, false); true }
    try { next.setDataSource(this, source); next.prepareAsync() }
    catch (_: Exception) { if (retry) play(fallback, fallback, false) }
  }
  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    if (running === this) running = null
    player?.release(); player = null
    vibrator?.cancel()
    previousVolume?.let { original ->
      if (audioManager.getStreamVolume(AudioManager.STREAM_ALARM) == appliedVolume)
        runCatching { audioManager.setStreamVolume(AudioManager.STREAM_ALARM, original, 0) }
    }
    if (wakeLock?.isHeld == true) wakeLock?.release()
    if (Build.VERSION.SDK_INT >= 26) focus?.let { audioManager.abandonAudioFocusRequest(it) }
    else audioManager.abandonAudioFocus(null)
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }
}
