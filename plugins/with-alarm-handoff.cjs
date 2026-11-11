const { withAppDelegate } = require('expo/config-plugins');

module.exports = function withAlarmHandoff(config) {
  return withAppDelegate(config, config => {
    if (config.modResults.language !== 'swift') throw new Error('Refresh AlarmKit handoff needs a Swift AppDelegate.');
    let source = config.modResults.contents;
    if (!source.includes('import AppIntents')) source = `import AppIntents\n${source}`;
    if (!source.includes('import DaybreakAlarmKit')) source = `import DaybreakAlarmKit\n${source}`;
    if (!source.includes('struct RefreshAlarmIntentsPackage: AppIntentsPackage')) source += `
// Include the native module's intent metadata in the host app, not an extension.
@available(iOS 26.0, *)
struct RefreshAlarmIntentsPackage: AppIntentsPackage {
  static var includedPackages: [any AppIntentsPackage.Type] {
    [DaybreakAlarmIntentsPackage.self]
  }
}
`;
    config.modResults.contents = source;
    return config;
  });
};
