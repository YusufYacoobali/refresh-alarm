const { withMainActivity, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

module.exports = function withRefreshAlarm(config) {
  config = withMainActivity(config, config => {
    let source = config.modResults.contents.replace(/\r\n/g, '\n');
    // Upgrade the old hook as well as fresh prebuilds.
    source = source.replace('super.onCreate(null)\n    // Refresh alarm window\n    expo.modules.refreshalarm.AlarmWindow.update(this)', 'super.onCreate(null)');
    if (!source.includes('// Refresh alarm window v2')) {
      if (!source.includes('super.onCreate(null)')) throw new Error('Refresh needs a Kotlin MainActivity with onCreate.');
      source = source.replace('super.onCreate(null)', '// Refresh alarm window v2\n    expo.modules.refreshalarm.AlarmWindow.update(this)\n    super.onCreate(null)');
      source = source.replace(/  override fun onResume\(\) \{\s*super.onResume\(\)\s*expo.modules.refreshalarm.AlarmWindow.update\(this\)\s*\}\s*/, '');
      source = source.replace('class MainActivity : ReactActivity() {', `class MainActivity : ReactActivity() {
  override fun onNewIntent(intent: android.content.Intent) {
    expo.modules.refreshalarm.AlarmWindow.update(this)
    super.onNewIntent(intent)
    setIntent(intent)
  }

  override fun onResume() {
    expo.modules.refreshalarm.AlarmWindow.update(this)
    expo.modules.refreshalarm.AlarmRingService.setAppVisible(true)
    super.onResume()
  }

  override fun onPause() {
    expo.modules.refreshalarm.AlarmRingService.setAppVisible(false)
    super.onPause()
  }
`);
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
      const name = `refresh_full_${sound.id}`;
      // The old MP3 and new WAV must not produce duplicate Android resource IDs.
      const legacy = path.join(output, `${name}.mp3`);
      if (fs.existsSync(legacy)) fs.unlinkSync(legacy);
      fs.copyFileSync(path.join(root, 'assets/audio/prepared', `${name}.wav`), path.join(output, `${name}.wav`));
    }
    return config;
  }]);
};
