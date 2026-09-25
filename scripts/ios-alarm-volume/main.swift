// Run on macOS with AVFoundation; see docs/audio.md.
import Foundation
import AVFoundation

func check(_ condition: Bool, _ message: String) {
  precondition(condition, message)
}
func read(_ url: URL) throws -> AVAudioPCMBuffer {
  let file = try AVAudioFile(forReading: url, commonFormat: .pcmFormatFloat32, interleaved: false)
  let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length))!
  try file.read(into: buffer)
  return buffer
}
func fixture(_ url: URL) throws {
  let format = AVAudioFormat(standardFormatWithSampleRate: 22050, channels: 2)!
  let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 22050)!
  buffer.frameLength = 22050
  for frame in 0..<Int(buffer.frameLength) {
    buffer.floatChannelData![0][frame] = 0.5 * sin(Float(frame) * 0.1)
    buffer.floatChannelData![1][frame] = -0.25 * cos(Float(frame) * 0.1)
  }
  let file = try AVAudioFile(forWriting: url, settings: format.settings)
  try file.write(from: buffer)
}

let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: root) }
let source = root.appendingPathComponent("original.wav")
let sounds = root.appendingPathComponent("Sounds")
try fixture(source)
let originalBytes = try Data(contentsOf: source)
let original = try read(source)
var names = Set<String>()
for volume in [0.1, 0.4, 0.8] {
  let name = try DaybreakAlarmSound.prepare(source: source, volume: volume, folder: sounds)
  check(names.insert(name).inserted, "Different gains must not share a filename")
  let url = sounds.appendingPathComponent(name)
  let result = try read(url)
  check(result.frameLength == original.frameLength, "Preserve the audio duration")
  check(result.format.channelCount == 2, "Preserve every channel")
  for channel in 0..<2 {
    for frame in 0..<Int(result.frameLength) {
      let expected = original.floatChannelData![channel][frame] * Float(volume)
      check(abs(result.floatChannelData![channel][frame] - expected) < 0.00005, "Gain must apply from the first sample to both channels")
    }
  }
  let bytes = try Data(contentsOf: url)
  let cached = try DaybreakAlarmSound.prepare(source: source, volume: volume, folder: sounds)
  check(cached == name, "Reuse the same immutable sound")
  check(try Data(contentsOf: url) == bytes, "A repeated schedule must not rewrite audio")
}
check(try Data(contentsOf: source) == originalBytes, "Never attenuate the source in place")
check(try DaybreakAlarmSound.prepare(source: source, volume: 1, folder: sounds) == "original.wav", "Full/device volume keeps the original sound")
for invalid in [Double.nan, .infinity, -1, 0, 1.1] {
  do {
    _ = try DaybreakAlarmSound.prepare(source: source, volume: invalid, folder: sounds)
    fatalError("Invalid volume must fail")
  } catch {}
}
do {
  _ = try DaybreakAlarmSound.prepare(source: root.appendingPathComponent("missing.wav"), volume: 0.4, folder: sounds)
  fatalError("A missing sound must fail instead of falling back to full volume")
} catch {}
print("Native alarm volume checks passed")
