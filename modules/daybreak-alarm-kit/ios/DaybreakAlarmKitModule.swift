import ExpoModulesCore
import Foundation
import AlarmKit
import SwiftUI
import AppIntents
import ActivityKit
import AVFoundation
import OSLog
import FamilyControls
import UIKit

struct DaybreakAlarmInput: Record {
  @Field var id: String = ""
  @Field var alarmId: String = ""
  @Field var hour: Int = 7
  @Field var minute: Int = 0
  @Field var days: [Int] = []
  @Field var label: String = "Rise & shine"
  @Field var timestamp: Double? = nil
  @Field var soundName: String? = nil
  @Field var volume: Double? = nil
  @Field var appBlockSelection: String? = nil
  @Field var appBlockMinutes: Int = 5
}

@available(iOS 26.0, *)
struct DaybreakMetadata: AlarmMetadata { var alarmId: String }

/// The system action opens the app. Native storage survives a cold launch.
@available(iOS 26.0, *)
public struct OpenDaybreakIntent: LiveActivityIntent {
  public static var title: LocalizedStringResource = "Wake up with Refresh"
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
  private var alarmUpdatesTask: Task<Void, Never>?
  private static let timingLog = Logger(subsystem: "com.yacoobali.alarm", category: "AlarmTiming")

  public func definition() -> ModuleDefinition {
    Name("DaybreakAlarmKit")
    Function("soundVolumeVersion") { 1 }
    Function("appBlockVersion") { 2 }
    Function("appBlockStatus") { () -> [String: Any] in
      ["authorized": AuthorizationCenter.shared.authorizationStatus == .approved, "activeUntil": RefreshAppBlockShared.refreshAll()]
    }
    AsyncFunction("requestAppBlockAccess") { () async throws in
      guard #available(iOS 26.0, *) else { throw RefreshAppBlockShared.failure("App blocking with system alarms requires iOS 26 or later.") }
      try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
    }
    AsyncFunction("chooseBlockedApps") { (encoded: String, _: String, promise: Promise) in
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject(RefreshAppBlockShared.failure("Open Refresh to choose apps.")); return
      }
      let selection = (try? RefreshAppBlockShared.selection(encoded)) ?? FamilyActivitySelection()
      var controller: UIViewController?
      let picker = RefreshAppBlockPicker(selection: selection) { chosen in
        guard let presented = controller else { return }
        controller = nil
        presented.dismiss(animated: true)
        guard let chosen = chosen else { promise.resolve(nil); return }
        do {
          let encoded = try JSONEncoder().encode(chosen).base64EncodedString()
          promise.resolve(["selection": encoded, "count": chosen.applicationTokens.count + chosen.categoryTokens.count + chosen.webDomainTokens.count] as [String: Any])
        } catch { promise.reject(error) }
      }
      controller = UIHostingController(rootView: picker)
      presenter.present(controller!, animated: true)
    }.runOnQueue(.main)
    Events("onAlarmStateChange")
    OnCreate { [weak self] in
      guard #available(iOS 26.0, *) else { return }
      self?.alarmUpdatesTask = Task { [weak self] in
        for await alarms in AlarmManager.shared.alarmUpdates {
          if Task.isCancelled { break }
          for alarm in alarms where alarm.state == .alerting {
            RefreshAppBlockShared.refresh(RefreshAppBlockShared.prefix + alarm.id.uuidString.lowercased())
            Self.timingLog.notice("AlarmKit alert observed id=\(alarm.id.uuidString, privacy: .public) at=\(Date().timeIntervalSince1970, privacy: .public)")
          }
          self?.sendEvent("onAlarmStateChange", [:])
        }
      }
    }
    OnDestroy { [weak self] in
      self?.alarmUpdatesTask?.cancel()
      self?.alarmUpdatesTask = nil
    }
    AsyncFunction("prepareCustomSound") { (uri: String, value: String) throws -> String in
      guard let id = UUID(uuidString: value), let url = URL(string: uri), url.isFileURL else { throw Self.error("Invalid imported audio file.") }
      let files = FileManager.default
      let documents = try files.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
      guard url.standardizedFileURL.path.hasPrefix(documents.path + "/custom-audio/") else { throw Self.error("Choose a sound from your imported audio.") }
      let source = try AVAudioFile(forReading: url)
      let format = source.processingFormat
      let frames = AVAudioFrameCount(min(source.length, AVAudioFramePosition(format.sampleRate * 29)))
      guard frames > 0, let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames) else { throw Self.error("This audio file is empty.") }
      try source.read(into: buffer, frameCount: frames)
      let folder = try files.url(for: .libraryDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("Sounds", isDirectory: true)
      try files.createDirectory(at: folder, withIntermediateDirectories: true)
      let name = "refresh_custom_\(id.uuidString.lowercased()).wav"
      let output = try AVAudioFile(forWriting: folder.appendingPathComponent(name), settings: [AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: format.sampleRate, AVNumberOfChannelsKey: format.channelCount, AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false, AVLinearPCMIsBigEndianKey: false])
      try output.write(from: buffer)
      return name
    }
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
      guard AlarmManager.shared.authorizationState == .authorized else { throw Self.error("Allow Refresh alarms in Settings before scheduling.") }
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
        secondaryButton: nil,
        secondaryButtonBehavior: nil
      )
      let attributes = AlarmAttributes<DaybreakMetadata>(
        presentation: AlarmPresentation(alert: alert),
        metadata: DaybreakMetadata(alarmId: input.alarmId),
        tintColor: Color(red: 0.74, green: 0.69, blue: 0.96)
      )
      // Snooze is a new fixed alarm. No countdown / Live Activity extension is needed.
      let sound: AlertConfiguration.AlertSound
      if let volume = input.volume {
        guard volume.isFinite, (0.1...1).contains(volume) else { throw Self.error("Invalid alarm volume.") }
      }
      // The opaque system tone cannot be attenuated. Match the foreground
      // player's bundled beep when a lower volume is explicitly selected.
      let name = input.soundName ?? ((input.volume ?? 1) < 1 ? "daybreak_digital_beep.wav" : nil)
      if let name = name {
        let folder = try FileManager.default.url(for: .libraryDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("Sounds", isDirectory: true)
        let library = folder.appendingPathComponent(name)
        let bundled = name.hasPrefix("daybreak_") && Bundle.main.url(forResource: name, withExtension: nil) != nil
        let imported = name.hasPrefix("refresh_custom_") && FileManager.default.fileExists(atPath: library.path)
        guard name.hasSuffix(".wav"), !name.contains("/"), bundled || imported
        else { throw Self.error("This alarm sound is missing. Import it again or choose another sound.") }
        let source = bundled ? Bundle.main.url(forResource: name, withExtension: nil)! : library
        let prepared = try DaybreakAlarmSound.prepare(source: source, volume: input.volume ?? 1, folder: folder)
        sound = .named(prepared)
      } else { sound = .default }
      // Show only the system stop control and use it to open the mission flow;
      // stopping the system sound must not mark the app's mission complete.
      let configuration = AlarmManager.AlarmConfiguration<DaybreakMetadata>.alarm(
        schedule: schedule, attributes: attributes,
        stopIntent: OpenDaybreakIntent(alarmId: input.alarmId),
        sound: sound
      )
      if let selection = input.appBlockSelection {
        let calendar = Calendar.current
        let fixed = input.timestamp ?? (input.days.isEmpty ? calendar.nextDate(after: Date(), matching: DateComponents(hour: input.hour, minute: input.minute, second: 0), matchingPolicy: .nextTime)?.timeIntervalSince1970 : nil)
        try RefreshAppBlockShared.schedule(id: id.uuidString.lowercased(), record: RefreshAppBlockRecord(hour: input.hour, minute: input.minute, days: input.days, timestamp: fixed, selection: selection, minutes: input.appBlockMinutes))
      }
      do { _ = try await AlarmManager.shared.schedule(id: id, configuration: configuration) }
      catch { RefreshAppBlockShared.cancel(id: id.uuidString.lowercased()); throw error }
      Self.timingLog.notice("AlarmKit scheduled id=\(id.uuidString, privacy: .public) hour=\(input.hour) minute=\(input.minute) fixed=\(input.timestamp ?? 0) timezone=\(TimeZone.current.identifier, privacy: .public) savedAt=\(Date().timeIntervalSince1970, privacy: .public)")
    }
    AsyncFunction("cancel") { (value: String) throws in
      guard #available(iOS 26.0, *), let id = UUID(uuidString: value) else { return }
      if try AlarmManager.shared.alarms.contains(where: { $0.id == id }) { try AlarmManager.shared.cancel(id: id) }
      RefreshAppBlockShared.cancel(id: id.uuidString.lowercased())
    }
    AsyncFunction("stop") { (value: String) throws in
      guard #available(iOS 26.0, *), let id = UUID(uuidString: value) else { return }
      if try AlarmManager.shared.alarms.contains(where: { $0.id == id && $0.state == .alerting }) {
        Self.timingLog.notice("AlarmKit stop requested id=\(id.uuidString, privacy: .public) at=\(Date().timeIntervalSince1970, privacy: .public)")
        try AlarmManager.shared.stop(id: id)
      }
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
    // Keep the handoff durable until the app successfully completes the alarm.
    // Reading it on launch/resume must not lose an unfinished wake-up session.
    Function("activeAlarm") { () -> String? in
      UserDefaults.standard.string(forKey: "daybreak.pendingAlarm")
    }
    Function("beginAlarm") { (alarmId: String) in
      _ = RefreshAppBlockShared.refreshAll()
      UserDefaults.standard.set(alarmId, forKey: "daybreak.pendingAlarm")
    }
    Function("completeAlarm") { (alarmId: String) in
      if UserDefaults.standard.string(forKey: "daybreak.pendingAlarm") == alarmId {
        UserDefaults.standard.removeObject(forKey: "daybreak.pendingAlarm")
      }
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
