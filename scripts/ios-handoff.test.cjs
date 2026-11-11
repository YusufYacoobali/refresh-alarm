const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const alarms = require('../src/utils/alarms.ts');
const sessions = require('../src/utils/wake-session.ts');
const plain = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));
function load(file, mocks, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, __DEV__: false, require(id) {
    if (!(id in mocks)) throw new Error(`Unexpected import: ${id}`);
    return mocks[id];
  }, ...globals }, { filename: file });
  return exports;
}
const alarm = { id: 'a', hour: 7, minute: 0, days: [0,1,2,3,4,5,6], label: 'Wake', sound: 'system', enabled: true,
  challenge: 'math', difficulty: 'gentle', snooze: 5, registration: { kind: 'alarmkit', ids: ['primary'] } };
const handoff = { alarmId: 'a', occurrenceId: 'primary:morning', registrationId: 'primary', sessionId: 'primary:morning',
  scheduledAt: 100, createdAt: 110, kind: 'scheduled', source: 'stop', deferred: false };
function reader(kit, timeout = null, android = null, os = 'ios') {
  return load('src/services/wake-handoff.ts', {
    'react-native': { Platform: { OS: os } }, './alarm-kit': kit, './android-alarm': android,
    './mission-timeout': { readMissionTimeout: async () => timeout }, '@/utils/wake-session': sessions,
  });
}
test('real native reader resumes a durable Stop after termination without requiring an alerting alarm or consuming evidence', async () => {
  const disk = [plain(handoff)]; let reads = 0;
  const kit = { isSupported: () => true, pendingWakeups: async () => { reads++; return plain(disk); },
    getAlarms: async () => { throw new Error('System alarm no longer exists'); },
    consumePendingAlarm: () => assert.fail('Reads must not consume') };
  const data = { alarms: [alarm] };
  const cold = await reader(kit).readNativeWakeups(data);
  const relaunched = await reader(kit).readNativeWakeups(data);
  assert.deepEqual(plain(cold), plain(relaunched)); assert.equal(cold[0].sessionId, handoff.sessionId);
  assert.equal(reads, 2); assert.deepEqual(disk, [handoff]);
});
test('elapsed scheduled time alone never manufactures an AlarmKit wake-up', async () => {
  const kit = { isSupported: () => true, pendingWakeups: async () => [], getAlarms: async () => [{ id: 'primary', state: 'scheduled' }] };
  const expired = { alarmId: 'a', deadline: 1, registration: { kind: 'alarmkit', ids: ['backup'] } };
  assert.deepEqual(plain(await reader(kit, expired).readNativeWakeups({ alarms: [alarm] })), []);
});
test('actual alerting signals recover registrations saved by an older native build only after native confirmation', async () => {
  let queue = [], captures = [];
  const kit = { isSupported: () => true, pendingWakeups: async () => queue,
    getAlarms: async () => [{ id: 'primary', state: 'alerting' }],
    captureAlertingWakeup: async (id, alarmId) => { captures.push([id, alarmId]); queue = [handoff]; } };
  assert.equal((await reader(kit).readNativeWakeups({ alarms: [alarm] }))[0].id, 'a');
  assert.deepEqual(captures, [['primary', 'a']]);
});
test('legacy native clients retain a non-destructive pending ID even when the system lookup fails', async () => {
  const kit = { isSupported: () => true, activeAlarm: () => 'a', getAlarms: async () => { throw new Error('transient'); },
    consumePendingAlarm: () => assert.fail('Legacy reads must not consume') };
  assert.equal((await reader(kit).readNativeWakeups({ alarms: [alarm] }))[0].id, 'a');
});
test('native read errors and corrupt records propagate instead of silently resolving to ordinary tabs', async () => {
  for (const pendingWakeups of [async () => { throw new Error('read failed'); }, async () => [{ ...handoff, sessionId: '' }]]) {
    await assert.rejects(reader({ isSupported: () => true, pendingWakeups }).readNativeWakeups({ alarms: [alarm] }));
  }
});
test('legacy handoffs adopt the persisted Mystery session without generating or modifying its routine', async () => {
  const saved = { id: 'v3-session', missions: [{ kind: 'supplication', duaIds: ['protection', 'waking'] }] };
  const calls = [];
  const kit = { isSupported: () => true, pendingWakeups: async () => [{ ...handoff, source: 'legacy' }],
    adoptWakeup: async (...args) => calls.push(args) };
  const data = { alarms: [alarm], wakeSessions: { a: saved } }, before = JSON.stringify(data);
  const result = await reader(kit).readNativeWakeups(data);
  assert.equal(result[0].sessionId, 'v3-session'); assert.equal(JSON.stringify(data), before);
  assert.deepEqual(calls, [[handoff.occurrenceId, 'v3-session']]);
});
test('timeout identity remains identical when a native delivery replaces an expired stored deadline', async () => {
  const timeout = { alarmId: 'a', sessionId: handoff.sessionId, deadline: 200, registration: { kind: 'alarmkit', ids: ['backup'] } };
  const kit = { isSupported: () => true, pendingWakeups: async () => [handoff] };
  const before = (await reader(kit, timeout).readNativeWakeups({ alarms: [alarm] }))[0];
  kit.pendingWakeups = async () => [{ ...handoff, occurrenceId: 'backup:200', registrationId: 'backup', kind: 'timeout', createdAt: 210 }];
  const after = (await reader(kit).readNativeWakeups({ alarms: [alarm] }))[0];
  assert.equal(before.eventId, after.eventId); assert.equal(after.reminder, '1');
  assert.equal(before.sessionId, after.sessionId);
});
test('Android snooze and re-ring keep the original logical session and remain routable', async () => {
  const data = { alarms: [alarm], snoozed: { alarmId: 'a', at: 200, sessionId: handoff.sessionId, registration: { kind: 'android', ids: ['snooze-native'] } } };
  for (const eventId of ['snooze-native:200', 'snooze-native:reminder:999']) {
    const android = { activeAlarm: () => ({ alarmId: 'a', eventId, sessionId: 'snooze-native:200' }) };
    const candidate = (await reader(null, null, android, 'android').readNativeWakeups(data))[0];
    assert.equal(candidate.sessionId, handoff.sessionId); assert.equal(candidate.kind, 'snooze');
    assert.equal(candidate.reminder, eventId.includes('reminder') ? '1' : undefined);
  }
});
test('unsupported iOS and web do not call the native AlarmKit delivery path', async () => {
  for (const os of ['ios', 'web']) {
    const kit = { isSupported: () => false, pendingWakeups: () => assert.fail('unsupported') };
    assert.deepEqual(plain(await reader(kit, null, null, os).readNativeWakeups({ alarms: [alarm] })), []);
  }
});

async function provider(stored, options = {}) {
  let value, disk = plain(stored); const effects = [], calls = [], acknowledgements = [];
  const kit = { isSupported: () => true, activeWakeup: () => handoff,
    completeWakeup: async (id, reason) => {
      acknowledgements.push([id, reason]); calls.push('ack');
      if (options.cleanupFailure) throw new Error('Native write unavailable');
    }, deferWakeup: async id => { calls.push('defer'); assert.equal(disk.snoozed.sessionId, id); }, logWakeHandoff() {} };
  load('src/state/app-state.tsx', {
    react: { createContext: () => ({ Provider: 'provider' }), useState: value => [value, () => {}], useRef: current => ({ current }), useEffect: fn => effects.push(fn) },
    'react/jsx-runtime': { jsx: (_type, props) => { value = props.value; } },
    '@react-native-async-storage/async-storage': { getItem: async () => JSON.stringify(disk), setItem: async (_key, json) => {
      if (options.persistFailure) throw new Error('Disk full'); disk = JSON.parse(json); calls.push('persist');
    } },
    'expo-crypto': { randomUUID: () => 'uuid' }, 'react-native': { AppState: {}, Platform: { OS: 'ios' } },
    '@/services/alarm-kit': kit, '@/services/android-alarm': null,
    '@/services/mission-timeout': { cancelMissionTimeout: async () => calls.push('cancel-backup') },
    '@/utils/fajr-reminders': require('../src/utils/fajr-reminders.ts'),
    '@/utils/sounds': require('../src/utils/sounds.ts'), '@/utils/wake-session': sessions, '@/utils/alarms': alarms,
    '@/services/scheduler': {
      stopAlarm: async () => calls.push('stop'), cancelRegistration: async () => {},
      scheduleAlarm: async (_alarm, _at, _reuse, metadata) => { calls.push(['schedule', metadata]); return { kind: 'alarmkit', ids: ['snooze-registration'] }; },
    },
  }).AppProvider({ children: null });
  effects[0](); await flush();
  return { value, calls, acknowledgements, disk: () => disk, kit };
}
const base = () => ({ version: 1, onboarded: true, theme: 'serene', journal: [], completions: [], alarms: [plain(alarm)] });
test('real provider durably records Manual completion before native acknowledgement, including failed cleanup', async () => {
  const p = await provider(base(), { cleanupFailure: true });
  await p.value.finish(alarm, undefined, handoff.sessionId);
  assert.equal(p.disk().wakeHandoffCompletions.a.sessionId, handoff.sessionId);
  assert.ok(p.calls.indexOf('persist') < p.calls.indexOf('ack'));
  assert.equal(p.disk().alarms[0].enabled, true); assert.deepEqual(p.acknowledgements, [[handoff.sessionId, 'completed']]);
});
test('failed JS completion persistence never acknowledges or clears native pending state', async () => {
  const p = await provider(base(), { persistFailure: true });
  await assert.rejects(p.value.finish(alarm, undefined, handoff.sessionId), /Disk full/);
  assert.deepEqual(p.acknowledgements, []);
});
test('a later morning preserves older completed sessions whose native cleanup still fails', async () => {
  const data = base(); data.wakeHandoffCompletions = { a: { sessionId: 'yesterday', completedAt: 1, pendingCleanup: ['earlier'] } };
  const p = await provider(data, { cleanupFailure: true }); await p.value.finish(alarm, undefined, handoff.sessionId);
  assert.deepEqual(p.disk().wakeHandoffCompletions.a.pendingCleanup, ['yesterday', 'earlier']);
});
test('successful native cleanup compacts old failure markers at the next completion', async () => {
  const data = base(); data.wakeHandoffCompletions = { a: { sessionId: 'yesterday', completedAt: 1, pendingCleanup: ['earlier'] } };
  const p = await provider(data); await p.value.finish(alarm, undefined, handoff.sessionId);
  assert.equal(p.disk().wakeHandoffCompletions.a.pendingCleanup, undefined);
});
test('real provider snooze schedules the same wake-up identity and persists before deferring native evidence', async () => {
  const p = await provider(base()); await p.value.snooze(alarm);
  const schedule = p.calls.find(call => Array.isArray(call));
  assert.deepEqual(plain(schedule[1]), { sessionId: handoff.sessionId, kind: 'snooze' });
  assert.equal(p.disk().snoozed.sessionId, handoff.sessionId);
  assert.ok(p.calls.indexOf('persist') < p.calls.indexOf('defer')); assert.deepEqual(p.acknowledgements, []);
});

test('mission safety scheduling carries the original session and preserves an alerting backup on route cleanup', async () => {
  let stored = null, alerting = true; const calls = [];
  const service = load('src/services/mission-timeout.ts', {
    '@react-native-async-storage/async-storage': { getItem: async () => stored, setItem: async (_key, value) => { stored = value; }, removeItem: async () => { stored = null; } },
    './alarm-kit': { getAlarms: async () => [{ id: 'safety', state: alerting ? 'alerting' : 'scheduled' }] },
    './scheduler': { alarmKitAvailable: () => true, scheduleAlarm: async (_alarm, at, _reuse, metadata) => {
      calls.push(['schedule', at.getTime(), metadata]); return { kind: 'alarmkit', ids: ['safety'] };
    }, cancelRegistration: async registration => calls.push(['cancel', plain(registration)]) },
  });
  const fajrDeadline = Date.now() + 300000;
  await service.startMissionTimeout(alarm, fajrDeadline, 'fajr', handoff.sessionId);
  assert.deepEqual(plain(calls[0]), ['schedule', fajrDeadline, { sessionId: handoff.sessionId, kind: 'timeout' }]);
  await service.cancelMissionTimeout('fajr', true);
  assert.equal(calls.length, 1); assert.ok(stored);
  alerting = false; await service.cancelMissionTimeout('fajr', true);
  assert.equal(stored, null); assert.equal(calls[1][0], 'cancel');
});

test('explicit deletion durably authorizes cleanup without cancelling unrelated alarm handoffs', async () => {
  const data = base(); data.alarms.push({ ...alarm, id: 'b' });
  const p = await provider(data); await p.value.deleteAlarm(alarm);
  assert.deepEqual(p.disk().wakeHandoffCancellations, ['a']);
  assert.deepEqual(p.disk().alarms.map(a => a.id), ['b']);
});

test('real provider reuses the exact persisted Mystery routine through iOS timeout, snooze and cold hydration', async () => {
  const data = base(), mystery = { ...alarm, missionMode: 'mystery', mystery: {
    games: [{ kind: 'math', difficulty: 'gentle', rounds: 2 }, { kind: 'shake', difficulty: 'bright', rounds: 3 }],
    duaIds: ['waking', 'protection', 'contentment'], fajr: true,
  } };
  const snapshot = sessions.resolveMysterySession(mystery, undefined, { sessionId: handoff.sessionId }, undefined, Date.now(), () => .4);
  data.alarms = [mystery]; data.wakeSessions = { a: snapshot };
  const p = await provider(data);
  const timed = await p.value.ensureWakeSession(mystery, { sessionId: handoff.sessionId, eventId: 'backup:deadline', reminder: true });
  assert.deepEqual(plain(timed), snapshot);
  await p.value.snooze(mystery);
  const cold = await provider(p.disk());
  const resumed = await cold.value.ensureWakeSession(mystery, { sessionId: handoff.sessionId, eventId: 'snooze-registration:delivery' });
  assert.deepEqual(plain(resumed), snapshot);
  await cold.value.finish(mystery, snapshot.id, handoff.sessionId);
  assert.equal(cold.disk().wakeSessions.a, undefined); assert.equal(cold.disk().fajrReminderIndex, 1);
  assert.equal(cold.disk().wakeHandoffCompletions.a.sessionId, handoff.sessionId);
});

test('older Android binaries distinguish a fresh day from a reminder even without a native session field', async () => {
  const data = { alarms: [alarm], wakeSessions: { a: { id: 'yesterday' } } };
  for (const [eventId, expected] of [['primary:tomorrow', 'primary:tomorrow'], ['primary:reminder:999', 'yesterday']]) {
    const android = { activeAlarm: () => ({ alarmId: 'a', eventId }) };
    assert.equal((await reader(null, null, android, 'android').readNativeWakeups(data))[0].sessionId, expected);
  }
});
