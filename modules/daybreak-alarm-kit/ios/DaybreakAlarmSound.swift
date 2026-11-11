import Foundation
import AVFoundation
import CryptoKit

/// AlarmKit has no per-alarm gain control. Bake gain into the scheduled asset
/// before iOS takes ownership, including when Refresh is terminated or locked.
enum DaybreakAlarmSound {
  static func prepare(source: URL, volume: Double, folder: URL) throws -> String {
    guard volume.isFinite, (0.1...1).contains(volume) else {
      throw failure("Invalid alarm volume.")
    }
    if volume == 1 { return source.lastPathComponent }
    let files = FileManager.default
    // Content + gain identify immutable copies: editing/duplicating an alarm
    // must never change the sound used by another scheduled alarm or snooze.
    let digest = SHA256.hash(data: try Data(contentsOf: source))
      .map { String(format: "%02x", $0) }.joined()
    let name = "refresh_volume_v1_\(digest)_\(Float(volume).bitPattern).wav"
    let destination = folder.appendingPathComponent(name)
    if files.fileExists(atPath: destination.path) { return name }
    try files.createDirectory(at: folder, withIntermediateDirectories: true)

    let input = try AVAudioFile(forReading: source, commonFormat: .pcmFormatFloat32, interleaved: false)
    let format = input.processingFormat
    let frames = AVAudioFrameCount(min(input.length, AVAudioFramePosition(format.sampleRate * 29)))
    guard frames > 0, let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames) else {
      throw failure("This alarm sound is empty.")
    }
    try input.read(into: buffer, frameCount: frames)
    guard buffer.frameLength > 0, let channels = buffer.floatChannelData else {
      throw failure("This alarm sound could not be prepared.")
    }
    for channel in 0..<Int(format.channelCount) {
      for frame in 0..<Int(buffer.frameLength) {
        channels[channel][frame] *= Float(volume)
      }
    }

    let temporary = folder.appendingPathComponent("\(UUID().uuidString).wav")
    defer { try? files.removeItem(at: temporary) }
    // Close/finalize the WAV header before publishing it to AlarmKit.
    try write(buffer, to: temporary)
    #if os(iOS)
    try files.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: temporary.path)
    #endif
    do { try files.moveItem(at: temporary, to: destination) }
    catch {
      // A concurrent schedule may have published the same immutable asset.
      guard files.fileExists(atPath: destination.path) else { throw error }
    }
    return name
  }

  private static func write(_ buffer: AVAudioPCMBuffer, to url: URL) throws {
    let output = try AVAudioFile(forWriting: url, settings: [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVSampleRateKey: buffer.format.sampleRate,
      AVNumberOfChannelsKey: buffer.format.channelCount,
      AVLinearPCMBitDepthKey: 16,
      AVLinearPCMIsFloatKey: false,
      AVLinearPCMIsBigEndianKey: false,
    ], commonFormat: .pcmFormatFloat32, interleaved: false)
    try output.write(from: buffer)
  }

  private static func failure(_ message: String) -> NSError {
    NSError(domain: "DaybreakAlarmKit", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
}
