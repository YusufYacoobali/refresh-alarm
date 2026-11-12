const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function transform(contents, language = 'swift') {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('./with-alarm-handoff.cjs'), 'utf8'), {
    module, require: id => id === 'expo/config-plugins' ? { withAppDelegate: (config, change) => change(config) } : require(id),
  });
  return module.exports({ modResults: { contents, language } }).modResults.contents;
}
test('iOS prebuild exports the native intent package once and leaves lifecycle/audio code intact', () => {
  const source = 'import Expo\nclass AppDelegate: ExpoAppDelegate { /* existing lifecycle */ }\n';
  const result = transform(source);
  assert.equal(transform(result), result);
  assert.ok(result.includes(source));
  assert.equal((result.match(/import AppIntents/g) ?? []).length, 1);
  assert.equal((result.match(/import DaybreakAlarmKit/g) ?? []).length, 1);
  assert.match(result, /@available\(iOS 26\.0, \*\)\nstruct RefreshAlarmIntentsPackage: AppIntentsPackage/);
  assert.match(result, /\[DaybreakAlarmIntentsPackage.self\]/);
  assert.throws(() => transform(source, 'objc'), /Swift AppDelegate/);
});
