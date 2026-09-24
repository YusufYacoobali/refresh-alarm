const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

// Execute the real TS service/component with native boundaries replaced. This
// verifies JS handoff ordering; it does not simulate iOS system alarm delivery.
function load(file, mocks, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require(id) {
    if (!(id in mocks)) throw new Error(`Unexpected import: ${id}`);
    return mocks[id];
  }, ...globals }, { filename: file });
  return exports;
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const alarm = { id: 'wake', hour: 7, minute: 20, days: [1,2,3,4,5], label: 'Wake', sound: 'system', enabled: true };

function scheduler(version, supported, blockAuthorized = false) {
  const calls = { native: [], notifications: [] };
  const kit = supported === null ? null : {
    isSupported: () => supported, requestAuthorization: async () => 'authorized',
    appBlockStatus: () => ({ authorized: blockAuthorized, activeUntil: 0 }),
    appBlockVersion: () => 2,
    schedule: async input => calls.native.push(input), getAlarms: async () => [],
  };
  const result = load('src/services/scheduler.ts', {
    'react-native': { Platform: { OS: 'ios', Version: version } },
    'expo-notifications': {
      requestPermissionsAsync: async () => ({ granted: true }),
      scheduleNotificationAsync: async input => { calls.notifications.push(input); return 'notification'; },
      SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
    },
    'expo-crypto': { randomUUID: () => 'native-id' }, './alarm-kit': kit, './android-alarm': null,
    '@/utils/alarms': { nextOccurrence: () => new Date(2026, 8, 24, 7, 20, 0) },
    '@/utils/sounds': { soundFile: () => undefined, resolveSoundId: value => value, isCustomSound: () => false },
    './custom-audio': {},
  });
  return { ...result, calls };
}
test('iOS 26 schedules the exact chosen hour/minute through AlarmKit', async () => {
  const s = scheduler('26.0', true);
  assert.equal((await s.scheduleAlarm(alarm)).kind, 'alarmkit');
  assert.equal(s.calls.native[0].hour, 7);
  assert.equal(s.calls.native[0].minute, 20);
  assert.deepEqual(Array.from(s.calls.native[0].days), alarm.days);
  assert.equal(s.calls.notifications.length, 0);
  const at = new Date('2026-09-24T06:20:00Z');
  await s.scheduleAlarm(alarm, at);
  assert.equal(s.calls.native[1].timestamp, at.getTime() / 1000);
});
test('app blocking requires permission and passes the selected apps to the native alarm scheduler', async () => {
  const selected = { ...alarm, appBlock: { enabled: true, selection: 'opaque-selection', count: 1 } };
  const denied = scheduler('26.0', true);
  await assert.rejects(denied.scheduleAlarm(selected), /app-blocking access/);
  assert.equal(denied.calls.native.length, 0);
  const allowed = scheduler('26.0', true, true);
  await allowed.scheduleAlarm(selected);
  assert.equal(allowed.calls.native[0].appBlockSelection, 'opaque-selection');
  assert.equal(allowed.calls.native[0].appBlockMinutes, 5);
  await allowed.scheduleAlarm({ ...selected, appBlock: { ...selected.appBlock, enabled: false } });
  assert.equal(allowed.calls.native[1].appBlockSelection, undefined);
  for (const minutes of [10, 15, 30, 60]) {
    await allowed.scheduleAlarm({ ...selected, appBlock: { ...selected.appBlock, minutes } });
    assert.equal(allowed.calls.native.at(-1).appBlockMinutes, minutes);
  }
  const older = scheduler('18.6', false, true);
  await assert.rejects(older.scheduleAlarm(selected), /iOS 26/);
  assert.equal(older.calls.notifications.length, 0);
});

test('iOS 26 cannot silently save a notification when the native alarm bridge is missing', async () => {
  for (const supported of [false, null]) {
    const s = scheduler('26.0.1', supported);
    await assert.rejects(s.scheduleAlarm(alarm), /updated Refresh build/);
    assert.equal(s.calls.notifications.length, 0);
  }
});
test('older iOS fallback preserves 7:20 and requests time-sensitive delivery', async () => {
  const s = scheduler('18.6', false);
  await s.scheduleAlarm(alarm);
  assert.equal(s.calls.notifications.length, 5);
  for (const call of s.calls.notifications) {
    assert.equal(call.trigger.hour, 7);
    assert.equal(call.trigger.minute, 20);
    assert.equal(call.content.interruptionLevel, 'timeSensitive');
  }
  assert.equal(require('../app.json').expo.ios.entitlements['com.apple.developer.usernotifications.time-sensitive'], true);
});

function handoff(state, cancel = async () => {}) {
  let effect, resume, retry, cleanup;
  const calls = [];
  const app = { currentState: state, addEventListener: (_name, listener) => { resume = listener; return { remove() {} }; } };
  const component = load('src/components/alarm-sound.tsx', {
    react: { useCallback: fn => fn, useRef: current => ({ current }), useState: value => [value, () => {}] },
    'react/jsx-runtime': {},
    'expo-router': { useFocusEffect: fn => { effect = fn; } },
    'react-native': { AppState: app, Platform: { OS: 'ios' } },
    '@/utils/sounds': { resolveSoundId: id => id },
    '@/services/scheduler': { stopAlarm: async () => { calls.push('stop-native'); } },
    './use-sound-player': { useSoundPlayer: () => ({ play: async () => { calls.push('play'); }, stop: () => {}, playing: null, error: null }) },
    './ui': {}, '@/services/android-alarm': null,
    '@/services/mission-timeout': { cancelMissionTimeout: cancel },
  }, { setInterval: fn => { retry = fn; return 1; }, clearInterval() {} });
  component.AlarmSound({ alarm, preview: false, ringing: true });
  cleanup = effect();
  return { calls, cleanup, app, resume: () => resume(), retry: () => retry() };
}
test('inactive/locked iOS leaves the system alarm audible until the app becomes active', async () => {
  for (const state of ['inactive', 'background']) {
    const h = handoff(state);
    await flush(); h.retry(); await flush();
    assert.deepEqual(h.calls, []);
    h.app.currentState = 'active'; h.resume(); await flush();
    assert.deepEqual(h.calls, ['stop-native', 'play']);
    h.cleanup();
  }
});
test('backgrounding during asynchronous handoff setup does not stop the system alarm', async () => {
  let release;
  const h = handoff('active', () => new Promise(resolve => { release = resolve; }));
  h.app.currentState = 'background'; release(); await flush();
  assert.deepEqual(h.calls, []);
  h.cleanup();
});
