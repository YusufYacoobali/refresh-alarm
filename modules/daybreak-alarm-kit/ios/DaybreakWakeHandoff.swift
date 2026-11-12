import Foundation
import OSLog
import Darwin

/// App Intents run from the host app. This store needs no widget/App Group and
/// remains readable after the device has first been unlocked since boot.
enum DaybreakWakeHandoff {
  static let changed = Notification.Name("DaybreakWakeHandoffChanged")
  private static let lock = NSLock()
  private static let logger = Logger(subsystem: "com.yacoobali.alarm", category: "AlarmTiming")
  private static var lastReadRevision: Int?

  struct Schedule: Codable, Equatable {
    var alarmId: String
    var hour: Int
    var minute: Int
    var days: [Int]
    var timestamp: Double?
    var sessionId: String?
    var kind: String
    var cancelled = false
  }
  struct Handoff: Codable, Equatable {
    var alarmId: String
    var occurrenceId: String
    var registrationId: String
    var sessionId: String
    var scheduledAt: Double
    var createdAt: Double
    var kind: String
    var source: String
    var deferred = false
    var dictionary: [String: Any] {
      ["alarmId": alarmId, "occurrenceId": occurrenceId, "registrationId": registrationId,
       "sessionId": sessionId, "scheduledAt": scheduledAt, "createdAt": createdAt,
       "kind": kind, "source": source, "deferred": deferred]
    }
  }
  private struct State: Codable {
    var revision = 0
    var schedules: [String: Schedule] = [:]
    var pending: [String: Handoff] = [:]
    // A repeating registration only needs its latest completed occurrence.
    var completed: [String: Double] = [:]
    var importedLegacy = false
  }
  static func token(_ value: String) -> String {
    String(value.utf8.reduce(UInt32(2166136261)) { ($0 ^ UInt32($1)) &* 16777619 }, radix: 16)
  }
  static func log(_ event: String, id: String = "", reason: String = "") {
    logger.notice("\(event, privacy: .public) key=\(token(id), privacy: .public) reason=\(reason, privacy: .public) at=\(Date().timeIntervalSince1970, privacy: .public)")
  }
  private static func file() throws -> URL {
    let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("RefreshWakeHandoffs", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
      attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
    return directory.appendingPathComponent("pending-v1.json")
  }
  private static func locked<T>(_ action: (URL) throws -> T) throws -> T {
    lock.lock(); defer { lock.unlock() }
    let url = try file()
    let descriptor = Darwin.open(url.appendingPathExtension("lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
    guard descriptor >= 0 else { throw failure("Could not lock wake-up handoffs.") }
    defer { Darwin.close(descriptor) }
    try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
      ofItemAtPath: url.appendingPathExtension("lock").path)
    guard flock(descriptor, LOCK_EX) == 0 else { throw failure("Could not lock wake-up handoffs.") }
    defer { flock(descriptor, LOCK_UN) }
    return try action(url)
  }
  private static func load(_ url: URL) throws -> State {
    guard FileManager.default.fileExists(atPath: url.path) else { return State() }
    // A read failure must propagate; an unreadable pending queue is not empty.
    return try JSONDecoder().decode(State.self, from: Data(contentsOf: url))
  }
  private static func mutate<T>(_ action: (inout State) throws -> T) throws -> T {
    let (result, didChange) = try locked { url -> (T, Bool) in
      var state = try load(url)
      let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
      let before = try encoder.encode(state)
      let result = try action(&state)
      let changed = try encoder.encode(state) != before
      if changed {
        state.revision += 1
        try encoder.encode(state).write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        let descriptor = Darwin.open(url.path, O_RDONLY)
        guard descriptor >= 0 else { throw failure("Could not persist wake-up handoffs.") }
        defer { Darwin.close(descriptor) }
        guard fsync(descriptor) == 0 else { throw failure("Could not persist wake-up handoffs.") }
      }
      return (result, changed)
    }
    if didChange { NotificationCenter.default.post(name: changed, object: nil) }
    return result
  }
  private static func latestOccurrence(_ schedule: Schedule, now: Date) -> Date {
    if let fixed = schedule.timestamp { return Date(timeIntervalSince1970: fixed) }
    let calendar = Calendar.current
    for offset in 0...7 {
      guard let day = calendar.date(byAdding: .day, value: -offset, to: now),
            let candidate = calendar.date(bySettingHour: schedule.hour, minute: schedule.minute, second: 0, of: day) else { continue }
      if candidate <= now && (schedule.days.isEmpty || schedule.days.contains(calendar.component(.weekday, from: candidate) - 1)) { return candidate }
    }
    return now
  }
  static func register(_ registrationId: String, schedule: Schedule) throws {
    try mutate { $0.schedules[registrationId] = schedule }
  }
  static func cancelSchedule(_ registrationId: String) throws {
    // Cancelling a scheduled backup during navigation is not wake-up completion.
    try mutate { state in state.schedules[registrationId]?.cancelled = true }
  }
  static func alarmId(for registrationId: String) throws -> String? {
    try locked { try load($0).schedules[registrationId]?.alarmId }
  }
  @discardableResult static func record(registrationId: String, alarmId: String? = nil, source: String, now: Date = Date()) throws -> Handoff? {
    var inserted = false
    let result = try mutate { state -> Handoff? in
      let schedule = state.schedules[registrationId]
      if schedule?.cancelled == true { return nil }
      guard let alarm = alarmId ?? schedule?.alarmId, !alarm.isEmpty else { return nil }
      // Old intents have no registration parameter. Their Stop callback and a
      // migrated/observed legacy handoff must not create two Manual wake-ups.
      if schedule == nil, let existing = state.pending.values.first(where: {
        $0.alarmId == alarm && $0.source == "legacy" &&
          Calendar.current.isDate(Date(timeIntervalSince1970: $0.scheduledAt / 1000), inSameDayAs: now)
      }) { return existing }
      // Only called after an actual Stop intent or observed .alerting state.
      // Schedule arithmetic associates that evidence; it never triggers a wake-up.
      let date = schedule.map { latestOccurrence($0, now: now) } ?? Calendar.current.startOfDay(for: now)
      let at = (date.timeIntervalSince1970 * 1000).rounded()
      let key = registrationId.isEmpty ? "legacy:\(alarm)" : registrationId
      let occurrence = "\(key):\(Int64(at))"
      let completed = max(state.completed[key] ?? -1, schedule == nil ? state.completed["legacy:\(alarm)"] ?? -1 : -1)
      guard at > completed else {
        log("handoff.ignored", id: occurrence, reason: "completed"); return nil
      }
      if var existing = state.pending[occurrence] {
        if source == "stop" && existing.source != "legacy" { existing.source = "stop"; state.pending[occurrence] = existing }
        return existing
      }
      let handoff = Handoff(alarmId: alarm, occurrenceId: occurrence, registrationId: key,
        sessionId: schedule?.sessionId ?? occurrence, scheduledAt: at, createdAt: now.timeIntervalSince1970 * 1000,
        kind: schedule?.kind ?? "scheduled", source: schedule == nil ? "legacy" : source)
      state.pending[occurrence] = handoff
      inserted = true
      return handoff
    }
    if inserted, let item = result {
      log("handoff.persisted", id: item.occurrenceId,
        reason: "\(item.source),registration=\(token(item.registrationId)),session=\(token(item.sessionId))")
    }
    return result
  }
  static func pending() throws -> [Handoff] {
    if let legacy = UserDefaults.standard.string(forKey: "daybreak.pendingAlarm"), !legacy.isEmpty {
      try mutate { state in
        guard !state.importedLegacy else { return }
        state.importedLegacy = true
        if state.pending.values.contains(where: { $0.alarmId == legacy }) { return }
        let key = "legacy:\(legacy):imported"
        state.pending[key] = Handoff(alarmId: legacy, occurrenceId: key, registrationId: "legacy:\(legacy)", sessionId: key,
          scheduledAt: Date().timeIntervalSince1970 * 1000, createdAt: Date().timeIntervalSince1970 * 1000, kind: "scheduled", source: "legacy")
      }
      // Never remove the old value until successful completion/cancellation.
    }
    return try locked { url in
      let state = try load(url)
      if lastReadRevision != state.revision {
        log("handoff.read", reason: "revision=\(state.revision),count=\(state.pending.count)")
        lastReadRevision = state.revision
      }
      return state.pending.values.sorted { $0.createdAt == $1.createdAt ? $0.occurrenceId < $1.occurrenceId : $0.createdAt < $1.createdAt }
    }
  }
  static func adopt(_ occurrenceId: String, sessionId: String) throws {
    try mutate { state in
      guard var item = state.pending[occurrenceId], item.source == "legacy" else { return }
      item.sessionId = sessionId; state.pending[occurrenceId] = item
    }
  }
  static func deferSession(_ sessionId: String) throws {
    try mutate { state in
      for (key, var item) in state.pending where item.sessionId == sessionId {
        item.deferred = true; state.pending[key] = item
      }
    }
    log("handoff.deferred", id: sessionId, reason: "snoozed")
  }
  static func complete(_ sessionId: String, reason: String) throws {
    guard ["completed", "deleted", "cancelled"].contains(reason) else { throw failure("Invalid handoff cleanup.") }
    let alarms = try mutate { state -> Set<String> in
      var alarms = Set<String>()
      for (key, item) in state.pending where item.sessionId == sessionId {
        alarms.insert(item.alarmId)
        state.completed[item.registrationId] = max(state.completed[item.registrationId] ?? -1, item.scheduledAt)
        if item.source == "legacy" {
          let legacyKey = "legacy:\(item.alarmId)"
          state.completed[legacyKey] = max(state.completed[legacyKey] ?? -1, item.scheduledAt)
        }
        state.pending.removeValue(forKey: key)
      }
      return alarms
    }
    if let legacy = UserDefaults.standard.string(forKey: "daybreak.pendingAlarm"), alarms.contains(legacy) {
      UserDefaults.standard.removeObject(forKey: "daybreak.pendingAlarm")
    }
    log("handoff.cleaned", id: sessionId, reason: reason)
  }
  static func failure(_ message: String) -> NSError { NSError(domain: "DaybreakWakeHandoff", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
}
