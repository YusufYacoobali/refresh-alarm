const { withMainActivity, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

module.exports = function withRefreshAlarm(config) {
  config = withMainActivity(config, config => {
    let source = config.modResults.contents;
    if (!source.includes('// Refresh alarm window')) {
      if (!source.includes('super.onCreate(null)')) throw new Error('Refresh needs a Kotlin MainActivity with onCreate.');
      source = source.replace('super.onCreate(null)', 'super.onCreate(null)\n    // Refresh alarm window\n    expo.modules.refreshalarm.AlarmWindow.update(this)');
      source = source.replace('class MainActivity : ReactActivity() {', 'class MainActivity : ReactActivity() {\n  override fun onResume() {\n    super.onResume()\n    expo.modules.refreshalarm.AlarmWindow.update(this)\n  }\n');
      config.modResults.contents = source;
    }
    return config;
  });
  return withDangerousMod(config, ['android', async config => {
    const root = config.modRequest.projectRoot;
    const output = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/raw');
    fs.mkdirSync(output, { recursive: true });
    const catalog = JSON.parse(fs.readFileSync(path.join(root, 'assets/audio/catalog.json'), 'utf8'));
    for (const sound of catalog.filter(sound => sound.fullPlayback)) {
      fs.copyFileSync(path.join(root, 'assets/audio', sound.file), path.join(output, `refresh_full_${sound.id}.mp3`));
    }
    return config;
  }]);
};
