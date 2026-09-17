Pod::Spec.new do |s|
  s.name           = 'DaybreakAlarmKit'
  s.version        = '1.0.0'
  s.summary        = 'Refresh system alarms for iOS 26+'
  s.description    = 'Expo bridge for AlarmKit authorization, schedules, and wake-up intents.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true
  s.weak_frameworks = 'AlarmKit'
  # SWIFT_VERSION is a language mode, not the compiler release (5.9 is invalid).
  s.swift_version = '5.0'

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
