const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function transform(contents) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('./with-refresh-alarm.cjs'), 'utf8'), {
    module,
    require: name => name === 'expo/config-plugins' ? {
      withMainActivity: (config, change) => change(config),
      withDangerousMod: config => config,
    } : require(name),
  });
  return module.exports({ modResults: { contents } }).modResults.contents;
}

for (const newline of ['\n', '\r\n']) {
  for (const legacy of [false, true]) {
    test(`alarm window hooks apply before launch/resume and survive repeated prebuild (legacy=${legacy}, CRLF=${newline.length === 2})`, () => {
      const source = `class MainActivity : ReactActivity() {
${legacy ? '  override fun onResume() {\n    super.onResume()\n    expo.modules.refreshalarm.AlarmWindow.update(this)\n  }\n' : ''}
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
${legacy ? '    // Refresh alarm window\n    expo.modules.refreshalarm.AlarmWindow.update(this)' : ''}
  }
}`.replaceAll('\n', newline);
      const result = transform(source);
      assert.equal(transform(result), result);
      assert.equal((result.match(/override fun onResume/g) ?? []).length, 1);
      assert.equal((result.match(/override fun onNewIntent/g) ?? []).length, 1);
      for (const method of ['onCreate', 'onResume', 'onNewIntent']) {
        const body = result.slice(result.indexOf(`override fun ${method}`)).split('}')[0];
        assert.ok(body.indexOf('AlarmWindow.update(this)') < body.indexOf(`super.${method}`));
      }
      assert.match(result, /override fun onPause\(\) \{\s*expo.modules.refreshalarm.AlarmRingService.setAppVisible\(false\)/);
    });
  }
}
