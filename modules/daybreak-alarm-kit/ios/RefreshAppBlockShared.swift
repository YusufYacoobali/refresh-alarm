import Foundation
import FamilyControls
import ManagedSettings
import DeviceActivity

// Compiled into both the app module and the Device Activity extension.
struct RefreshAppBlockRecord: Codable {
  var hour: Int
  var minute: Int
  var days: [Int]
  var timestamp: Double?
  var selection: String
  var minutes: Int? = nil
  var duration: TimeInterval { Double(minutes ?? 5) * 60 }
  var notBefore: Double = Date().timeIntervalSince1970
  var cancelledAt: Double?

  func window(at now: Date) -> DateInterval? {
    let calendar = Calendar.current
    let candidates: [Date]
    if let timestamp = timestamp { candidates = [Date(timeIntervalSince1970: timestamp)] }
    else {
      candidates = [0, -1].compactMap { offset in
        guard let day = calendar.date(byAdding: .day, value: offset, to: now),
              days.contains(calendar.component(.weekday, from: day) - 1) else { return nil }
        return calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day)
      }
    }
    return candidates.compactMap { start -> DateInterval? in
      let end = start.addingTimeInterval(duration)
      guard start.timeIntervalSince1970 >= notBefore, now >= start, now < end,
            cancelledAt.map({ start.timeIntervalSince1970 <= $0 }) ?? true else { return nil }
      return DateInterval(start: start, end: end)
    }.first
  }
}

enum RefreshAppBlockShared {
  static let group = "group.com.yacoobali.alarm.appblocking"
  static let prefix = "refresh.block."
  static var defaults: UserDefaults { UserDefaults(suiteName: group)! }
  static func selection(_ encoded: String) throws -> FamilyActivitySelection {
    guard let data = Data(base64Encoded: encoded) else { throw failure("Choose apps to block again.") }
    return try JSONDecoder().decode(FamilyActivitySelection.self, from: data)
  }
  static func failure(_ message: String) -> NSError { NSError(domain: "RefreshAppBlocking", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
  static func record(_ name: String) -> RefreshAppBlockRecord? {
    guard let data = defaults.data(forKey: name) else { return nil }
    return try? JSONDecoder().decode(RefreshAppBlockRecord.self, from: data)
  }
  static func save(_ value: RefreshAppBlockRecord, name: String) throws {
    defaults.set(try JSONEncoder().encode(value), forKey: name)
  }
  @discardableResult static func refresh(_ name: String, now: Date = Date()) -> Double {
    let store = ManagedSettingsStore(named: .init(name))
    guard let value = record(name), AuthorizationCenter.shared.authorizationStatus == .approved,
          let window = value.window(at: now), let chosen = try? selection(value.selection) else {
      store.clearAllSettings()
      return 0
    }
    store.shield.applications = chosen.applicationTokens.isEmpty ? nil : chosen.applicationTokens
    store.shield.applicationCategories = chosen.categoryTokens.isEmpty ? nil : .specific(chosen.categoryTokens)
    store.shield.webDomains = chosen.webDomainTokens.isEmpty ? nil : chosen.webDomainTokens
    store.shield.webDomainCategories = chosen.categoryTokens.isEmpty ? nil : .specific(chosen.categoryTokens)
    return window.end.timeIntervalSince1970 * 1000
  }
  static func refreshAll() -> Double {
    var end: Double = 0
    for name in defaults.dictionaryRepresentation().keys where name.hasPrefix(prefix) {
      end = max(end, refresh(name))
      if let value = record(name), value.window(at: Date()) == nil,
         value.cancelledAt != nil || value.timestamp.map({ $0 + value.duration < Date().timeIntervalSince1970 }) == true {
        defaults.removeObject(forKey: name)
        DeviceActivityCenter().stopMonitoring([DeviceActivityName(name)])
      }
    }
    return end
  }
  static func schedule(id: String, record value: RefreshAppBlockRecord) throws {
    _ = refreshAll()
    guard [5, 10, 15, 30, 60].contains(value.minutes ?? 5) else { throw failure("Choose a valid app-block duration.") }
    let selected = try selection(value.selection)
    guard !selected.applicationTokens.isEmpty || !selected.categoryTokens.isEmpty || !selected.webDomainTokens.isEmpty else { throw failure("Choose at least one app or category.") }
    guard AuthorizationCenter.shared.authorizationStatus == .approved else { throw failure("Allow Screen Time access before saving.") }
    let name = prefix + id
    let calendar = Calendar.current
    let ring = value.timestamp.map { Date(timeIntervalSince1970: $0) } ?? calendar.date(bySettingHour: value.hour, minute: value.minute, second: 0, of: Date())!
    // Short blocks use the end warning within the minimum 15-minute interval.
    // Longer blocks release at the actual interval end.
    let interval = max(900, value.duration)
    let components: Set<Calendar.Component> = value.timestamp == nil ? [.hour, .minute, .second] : [.year, .month, .day, .hour, .minute, .second]
    let schedule = DeviceActivitySchedule(intervalStart: calendar.dateComponents(components, from: ring),
      intervalEnd: calendar.dateComponents(components, from: ring.addingTimeInterval(interval)), repeats: value.timestamp == nil,
      warningTime: interval > value.duration ? DateComponents(second: Int(interval - value.duration)) : nil)
    try save(value, name: name)
    do { try DeviceActivityCenter().startMonitoring(DeviceActivityName(name), during: schedule) }
    catch { defaults.removeObject(forKey: name); throw error }
  }
  static func cancel(id: String) {
    let name = prefix + id
    guard var value = record(name) else { return }
    if value.window(at: Date()) != nil {
      // Finishing a one-off alarm must not release an ongoing block.
      value.cancelledAt = Date().timeIntervalSince1970
      try? save(value, name: name)
    } else {
      defaults.removeObject(forKey: name)
      ManagedSettingsStore(named: .init(name)).clearAllSettings()
      DeviceActivityCenter().stopMonitoring([DeviceActivityName(name)])
    }
  }
}
