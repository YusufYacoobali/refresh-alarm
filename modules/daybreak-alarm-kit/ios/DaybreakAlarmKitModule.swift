import ExpoModulesCore
import Foundation
import AlarmKit
import SwiftUI
import AppIntents

struct DaybreakAlarmInput: Record {
  @Field var id: String = ""
  @Field var alarmId: String = ""
  @Field var hour: Int = 7
  @Field var minute: Int = 0
  @Field var days: [Int] = []
  @Field var label: String = "Rise & shine"
  @Field var timestamp: Double? = nil
}

@available(iOS 26.0, *)
struct DaybreakMetadata: AlarmMetadata { var alarmId: String }

/// The system action opens the app. Native storage survives a cold launch.
@available(iOS 26.0, *)
public struct OpenDaybreakIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Wake up with Daybreak"
  public static var openAppWhenRun = true
  @Parameter(title: "Alarm") public var alarmId: String
  public init() { alarmId = "" }
  public init(alarmId: String) { self.alarmId = alarmId }
  public func perform() async throws -> some IntentResult {
    UserDefaults.standard.set(alarmId, forKey: "daybreak.pendingAlarm")
    return .result()
  }
}

public class DaybreakAlarmKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DaybreakAlarmKit")
    Function("isSupported") { () -> Bool in
      if #available(iOS 26.0, *) { return true }
      return false
    }
    Function("authorizationStatus") { () -> String in
      guard #available(iOS 26.0, *) else { return "unsupported" }
      return Self.status(AlarmManager.shared.authorizationState)
    }
    AsyncFunction("requestAuthorization") { () async throws -> String in
      guard #available(iOS 26.0, *) else { return "unsupported" }
      return Self.status(try await AlarmManager.shared.requestAuthorization())
    }
    AsyncFunction("schedule") { (input: DaybreakAlarmInput) async throws in
      guard #available(iOS 26.0, *) else { throw Self.error("AlarmKit requires iOS 26 or later.") }
      guard let id = UUID(uuidString: input.id), (0...23).contains(input.hour), (0...59).contains(input.minute), input.days.allSatisfy({ (0...6).contains($0) }) else { throw Self.error("Invalid alarm schedule.") }
      guard AlarmManager.shared.authorizationState == .authorized else { throw Self.error("Allow Daybreak alarms in Settings before scheduling.") }
      let schedule: Alarm.Schedule
      if let timestamp = input.timestamp {
        guard timestamp > Date().timeIntervalSince1970 else { throw Self.error("The alarm time has already passed.") }
        schedule = .fixed(Date(timeIntervalSince1970: timestamp))
      } else {
        let weekdays: [Locale.Weekday] = [.sunday, .monday, .tuesday, .wednesday, .thursday, .friday, .saturday]
        let recurrence: Alarm.Schedule.Relative.Recurrence = input.days.isEmpty ? .never : .weekly(input.days.map { weekdays[$0] })
        schedule = .relative(.init(time: .init(hour: input.hour, minute: input.minute), repeats: recurrence))
      }
      let alert = AlarmPresentation.Alert(
        title: LocalizedStringResource(stringLiteral: input.label),
        stopButton: AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.circle"),
        secondaryButton: AlarmButton(text: "Wake up", textColor: .white, systemImageName: "sun.max.fill"),
        secondaryButtonBehavior: .custom
      )
      let attributes = AlarmAttributes<DaybreakMetadata>(
        presentation: AlarmPresentation(alert: alert),
        metadata: DaybreakMetadata(alarmId: input.alarmId),
        tintColor: Color(red: 0.74, green: 0.69, blue: 0.96)
      )
      // Snooze is a new fixed alarm. No countdown / Live Activity extension is needed.
      // Audio assets are intentionally absent; use the system alarm tone.
      let configuration = AlarmManager.AlarmConfiguration<DaybreakMetadata>.alarm(
        schedule: schedule, attributes: attributes,
        secondaryIntent: OpenDaybreakIntent(alarmId: input.alarmId), sound: .default
      )
      _ = try await AlarmManager.shared.schedule(id: id, configuration: configuration)
    }
    AsyncFunction("cancel") { (value: String) throws in
      guard #available(iOS 26.0, *), let id = UUID(uuidString: value) else { return }
      if try AlarmManager.shared.alarms.contains(where: { $0.id == id }) { try AlarmManager.shared.cancel(id: id) }
    }
    AsyncFunction("stop") { (value: String) throws in
      guard #available(iOS 26.0, *), let id = UUID(uuidString: value) else { return }
      if try AlarmManager.shared.alarms.contains(where: { $0.id == id && $0.state == .alerting }) { try AlarmManager.shared.stop(id: id) }
    }
    AsyncFunction("getAlarms") { () throws -> [[String: String]] in
      guard #available(iOS 26.0, *) else { return [] }
      return try AlarmManager.shared.alarms.map { alarm in
        ["id": alarm.id.uuidString.lowercased(), "state": alarm.state == .alerting ? "alerting" : "scheduled"]
      }
    }
    Function("consumePendingAlarm") { () -> String? in
      let value = UserDefaults.standard.string(forKey: "daybreak.pendingAlarm")
      UserDefaults.standard.removeObject(forKey: "daybreak.pendingAlarm")
      return value
    }
  }
  @available(iOS 26.0, *)
  private static func status(_ value: AlarmManager.AuthorizationState) -> String {
    switch value {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .notDetermined: return "notDetermined"
    @unknown default: return "unknown"
    }
  }
  private static func error(_ message: String) -> NSError {
    NSError(domain: "DaybreakAlarmKit", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
}
