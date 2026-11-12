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
function reader(kit, timeout = null, android = null, os = 'ios', now) {
  return load('src/services/wake-handoff.ts', {
    'react-native': { Platform: { OS: os } }, './alarm-kit': kit, './android-alarm': android,
    './mission-timeout': { readMissionTimeout: async () => timeout }, '@/utils/wake-session': sessions,
  }, now === undefined ? {} : { Date: class extends Date { static now() { return now; } } });
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
  const saved = { id: 'v3-session', startedAt: handoff.scheduledAt, missions: [{ kind: 'supplication', duaIds: ['protection', 'waking'] }] };
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

function mixedReader(initial, registrations, options = {}) {
  const disk = plain(initial), captures = [], logs = [], adoptions = [];
  const now = options.now ?? handoff.scheduledAt, at = options.now === undefined ? handoff.scheduledAt : new Date(now).setHours(0, 0, 0, 0);
  let reads = 0;
  const saved = [alarm, { ...alarm, id: 'b', registration: { kind: 'alarmkit', ids: ['older-b'] } },
    { ...alarm, id: 'c', registration: { kind: 'alarmkit', ids: ['older-c'] } }];
  const kit = { isSupported: () => true,
    pendingWakeups: async () => { reads++; if (options.rereadFailure && reads > 1) throw new Error('reread'); return plain(disk); },
    getAlarms: async () => { if (options.lookupFailure) throw new Error('lookup'); return registrations; },
    captureAlertingWakeup: async (registrationId, alarmId) => {
      captures.push(registrationId);
      if (options.captureFailure === registrationId) throw new Error('capture');
      if (options.completed?.includes(registrationId)) return;
      if (!disk.some(r => r.registrationId === registrationId && new Date(r.scheduledAt).toDateString() === new Date(at).toDateString())) {
        const occurrenceId = options.now === undefined ? `${registrationId}:morning` : `${registrationId}:${at}`;
        disk.push({ ...handoff, alarmId, registrationId, occurrenceId, sessionId: occurrenceId, scheduledAt: at,
          createdAt: options.now ?? 200 + disk.length, source: 'legacy' });
      }
    }, adoptWakeup: async (occurrenceId, sessionId) => {
      adoptions.push([occurrenceId, sessionId]); disk.find(r => r.occurrenceId === occurrenceId).sessionId = sessionId;
    }, logWakeHandoff: (...args) => logs.push(args),
  };
  const adapter = reader(kit, options.timeout, null, 'ios', now);
  return { disk, captures, logs, adoptions, reads: () => reads, read: async () => plain(await adapter.readNativeWakeups({ alarms: saved, wakeSessions: options.wakeSessions, snoozed: options.snoozed })), saved, kit };
}
test('a new active alarm already represented natively remains single and ordered', async () => {
  const h = mixedReader([handoff], [{ id: 'primary', state: 'alerting' }]);
  const result = await h.read();
  assert.deepEqual(result.map(r => r.eventId), [handoff.occurrenceId]); assert.deepEqual(h.captures, []);
});
test('new and older alarms alerting together are independently recovered even with existing pending evidence', async () => {
  const h = mixedReader([handoff], [{ id: 'primary', state: 'alerting' }, { id: 'older-b', state: 'alerting' }]);
  const result = await h.read();
  assert.deepEqual(result.map(r => r.id), ['a', 'b']); assert.deepEqual(h.captures, ['older-b']);
  assert.equal(h.reads(), 2); assert.deepEqual(h.disk[0], handoff);
});
test('all older alerting registrations are captured and keep native queue order', async () => {
  const h = mixedReader([], [{ id: 'older-b', state: 'alerting' }, { id: 'older-c', state: 'alerting' }]);
  const result = await h.read();
  assert.deepEqual(h.captures, ['older-b', 'older-c']); assert.deepEqual(result.map(r => r.id), ['b', 'c']);
});
test('an older registration already represented in pending records is not captured again', async () => {
  const old = { ...handoff, alarmId: 'b', registrationId: 'older-b', occurrenceId: 'older-b:morning', sessionId: 'older-b:morning', source: 'legacy' };
  const h = mixedReader([handoff, old], [{ id: 'older-b', state: 'alerting' }]);
  assert.deepEqual((await h.read()).map(r => r.id), ['a', 'b']); assert.deepEqual(h.captures, []);
});
test('active-registration lookup failure preserves valid pending evidence and emits a diagnostic', async () => {
  const h = mixedReader([handoff], [], { lookupFailure: true });
  assert.deepEqual((await h.read()).map(r => r.eventId), [handoff.occurrenceId]);
  assert.ok(h.logs.some(([event, , reason]) => event === 'handoff.observe.deferred' && reason === 'active_lookup_failed_pending_retained'));
  assert.deepEqual(h.disk, [handoff]);
});
test('without pending evidence an active-registration lookup error remains recoverable rather than resolving empty', async () => {
  await assert.rejects(mixedReader([], [], { lookupFailure: true }).read(), /lookup/);
});
test('duplicate active callbacks and duplicate native records cannot duplicate occurrence/session results', async () => {
  const h = mixedReader([handoff, handoff], [{ id: 'older-b', state: 'alerting' }, { id: 'older-b', state: 'alerting' }]);
  const first = await h.read(), again = await h.read();
  assert.deepEqual(h.captures, ['older-b']); assert.equal(first.length, 2); assert.deepEqual(plain(again), plain(first));
  assert.equal(new Set(first.map(r => r.sessionId)).size, 2);
});
test('deduplication retains distinct occurrences of a repeating registration and the original queue positions', async () => {
  const tomorrow = { ...handoff, occurrenceId: 'primary:tomorrow', sessionId: 'primary:tomorrow', createdAt: 300 };
  const h = mixedReader([handoff, tomorrow, handoff], [{ id: 'older-b', state: 'alerting' }]);
  assert.deepEqual((await h.read()).map(r => r.eventId), [handoff.occurrenceId, tomorrow.occurrenceId, 'older-b:morning']);
});
test('native completion watermarks remain authoritative when a completed older registration is still reported alerting', async () => {
  const h = mixedReader([handoff], [{ id: 'older-b', state: 'alerting' }], { completed: ['older-b'] });
  assert.deepEqual((await h.read()).map(r => r.id), ['a']); assert.deepEqual(h.disk, [handoff]);
});
test('one failed legacy capture cannot hide other genuinely alerting registrations', async () => {
  const h = mixedReader([handoff], [{ id: 'older-b', state: 'alerting' }, { id: 'older-c', state: 'alerting' }], { captureFailure: 'older-b' });
  assert.deepEqual((await h.read()).map(r => r.id), ['a', 'c']); assert.deepEqual(h.captures, ['older-b', 'older-c']);
  assert.ok(h.logs.some(([event]) => event === 'handoff.capture.deferred'));
});
test('a failed post-capture reread retains existing records for processing and can recover on the next check', async () => {
  const options = { rereadFailure: true };
  const h = mixedReader([handoff], [{ id: 'older-b', state: 'alerting' }], options);
  assert.deepEqual((await h.read()).map(r => r.id), ['a']);
  assert.ok(h.logs.some(([, , reason]) => reason === 'capture_read_failed_pending_retained'));
  options.rereadFailure = false;
  assert.deepEqual((await h.read()).map(r => r.id), ['a', 'b']);
});
test('unmatched scheduled registrations and unknown IDs never manufacture a native delivery', async () => {
  const h = mixedReader([handoff], [{ id: 'older-b', state: 'scheduled' }, { id: 'unknown', state: 'alerting' }]);
  assert.deepEqual((await h.read()).map(r => r.id), ['a']); assert.deepEqual(h.captures, []);
});

// Run the real root hook, coordinator, boot page and focused screen error layer
// with an inert router. This verifies the retry UI is wired to durable resolution.
function navigationUI(pathname = '/journal', mode = 'silent') {
  let at = 0, timerId = 0, latestStatus, appListener, nativeListener, hook;
  const timers = new Map(), refs = [], effects = [], calls = [], logs = [], queue = [plain(handoff)];
  const app = { currentState: 'active', addEventListener: (_event, listener) => { appListener = listener; return { remove() {} }; } };
  const clock = { performance: { now: () => at }, setTimeout: (callback, ms) => { const id = ++timerId; timers.set(id, { callback, at: at + ms }); return id; }, clearTimeout: id => timers.delete(id) };
  const Coordinator = load('src/utils/wake-handoff.ts', {}, clock).WakeHandoffCoordinator;
  const react = { createContext: () => ({}), useContext: () => ({ status: latestStatus, retry: () => hook.retry() }),
    useRef: current => { const ref = { current }; refs.push(ref); return ref; },
    useState: value => { latestStatus = value; return [value, next => { latestStatus = typeof next === 'function' ? next(latestStatus) : next; }]; },
    useEffect: fn => effects.push(fn) };
  const jsx = { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const navigate = (kind, destination, options) => {
    calls.push({ kind, destination, options });
    if (mode === 'throw') throw new Error('Navigator unavailable');
    if (mode === 'commit') refs[0].current.route = { pathname: destination.pathname, ...destination.params };
  };
  const module = load('src/components/wake-handoff-router.tsx', {
    react, 'react/jsx-runtime': jsx, 'react-native': { AppState: app, Platform: { OS: 'ios' } },
    'expo-router': { router: { push: (d, o) => navigate('push', d, o), replace: (d, o) => navigate('replace', d, o) },
      useGlobalSearchParams: () => ({}), usePathname: () => pathname, useRootNavigationState: () => ({ key: 'root' }) },
    'expo-notifications': { addNotificationReceivedListener: () => ({ remove() {} }), addNotificationResponseReceivedListener: () => ({ remove() {} }), getLastNotificationResponseAsync: async () => null },
    '@/services/alarm-kit': { addListener: (_event, listener) => { nativeListener = listener; return { remove() {} }; } },
    '@/services/wake-handoff': { acknowledgeWakeup: () => assert.fail('Navigation cannot consume native evidence'), readNativeWakeups: async () => queue.map(r => ({ id: r.alarmId, eventId: r.occurrenceId, sessionId: r.sessionId, createdAt: r.createdAt, durable: true, native: true })), logWakeHandoff: (...args) => logs.push(args) },
    '@/utils/wake-handoff': { WakeHandoffCoordinator: Coordinator }, './ui': { Button: 'Button', T: 'Text' },
  }, { setInterval: () => 1, clearInterval() {} });
  hook = module.useWakeHandoffRouter({ alarms: [alarm] }, true);
  const cleanup = effects.map(effect => effect());
  const appContext = { useApp: () => ({ data: { onboarded: true }, ready: true, error: null, clearError() {} }) };
  const boot = load('src/app/index.tsx', { 'react/jsx-runtime': jsx, 'expo-router': { Redirect: 'Redirect' },
    '@/state/app-state': appContext, '@/components/wake-handoff-router': module, '@/components/ui': { Screen: 'Screen', T: 'Text' } });
  const layer = focused => load('src/components/screen-error-layer.tsx', {
    react: { useState: initial => [initial, () => {}], useEffect() {} }, 'react/jsx-runtime': jsx,
    'react-native': { View: 'View', ScrollView: 'ScrollView', Platform: { OS: 'ios' }, useWindowDimensions: () => ({ height: 844 }) },
    'expo-router/react-navigation': { useIsFocused: () => focused }, 'expo-router': { usePathname: () => pathname },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' } },
    '@/state/app-state': appContext, '@/theme': { colors: {} }, './motion': { useMotion: () => ({ reduced: true }) },
    './ui': { Card: 'Card' }, './wake-handoff-router': module,
  }).ScreenErrorLayer({ children: 'Existing screen' });
  return { queue, calls, logs, boot: () => boot.default(), layer, status: () => latestStatus,
    mode: value => { mode = value; }, retry: () => hook.retry(), native: () => nativeListener(),
    app: state => { app.currentState = state; appListener(state); },
    advance: ms => { const end = at + ms; for (;;) { const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0]; if (!next || next[1].at > end) break; at = next[1].at; timers.delete(next[0]); next[1].callback(); } at = end; },
    dispose: () => cleanup.forEach(fn => fn?.()) };
}
function nodes(tree) {
  if (tree == null || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props));
  return [tree, ...nodes(tree.props?.children)];
}
for (const mode of ['silent', 'throw']) test(`warm ${mode} navigation failure exposes an accessible retry over the focused screen`, async () => {
  const h = navigationUI('/journal', mode); await flush();
  if (mode === 'silent') h.advance(5000);
  assert.equal(h.status().state, 'error'); assert.equal(h.queue.length, 1);
  const tree = nodes(h.layer(true)), hidden = nodes(h.layer(false));
  assert.ok(tree.some(n => n.props.testID === 'wake-handoff-recovery'));
  assert.ok(tree.some(n => n.props.accessibilityRole === 'alert'));
  assert.ok(!hidden.some(n => n.props.testID === 'wake-handoff-recovery'));
  const retry = tree.find(n => n.props.title === 'Open wake-up screen'); assert.ok(retry);
  h.mode('commit'); retry.props.onPress(); await flush(); h.native(); await flush();
  assert.equal(h.status().state, 'pending'); assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].kind, 'replace'); assert.equal(h.queue.length, 1);
  const first = h.calls[0], second = h.calls[1];
  assert.deepEqual(plain(first.destination.params), plain(second.destination.params));
  assert.equal(first.options.dangerouslySingular('ringing', first.destination.params), second.options.dangerouslySingular('ringing', second.destination.params));
  assert.ok(!nodes(h.layer(true)).some(n => n.props.testID === 'wake-handoff-recovery')); h.dispose();
});
test('boot shows progress then a single Open wake-up screen action when the real hook navigation never commits', async () => {
  const h = navigationUI('/', 'silent'); await flush();
  assert.ok(h.boot()); assert.ok(nodes(h.boot()).some(n => String(n.props.children).includes('Opening your wake-up')));
  h.advance(5000);
  assert.equal(nodes(h.boot()).filter(n => n.props.title === 'Open wake-up screen').length, 1);
  assert.ok(!nodes(h.layer(true)).some(n => n.props.testID === 'wake-handoff-recovery'));
  assert.equal(h.queue.length, 1); h.dispose();
});

function datedLegacy(at, patch = {}) {
  const scheduledAt = new Date(at).setHours(0, 0, 0, 0), occurrenceId = `older-b:${scheduledAt}`;
  return { ...handoff, alarmId: 'b', registrationId: 'older-b', occurrenceId, sessionId: occurrenceId,
    scheduledAt, createdAt: at, source: 'legacy', ...patch };
}
test("yesterday's pending legacy handoff cannot hide today's alerting occurrence of the same registration", async () => {
  const now = +new Date(2026, 10, 11, 8), yesterday = datedLegacy(+new Date(2026, 10, 10, 8));
  const h = mixedReader([yesterday], [{ id: 'older-b', state: 'alerting' }, { id: 'older-b', state: 'alerting' }], { now });
  const first = await h.read(), again = await h.read();
  assert.deepEqual(h.captures, ['older-b']); assert.equal(first.length, 2);
  assert.deepEqual(h.disk[0], yesterday); assert.equal(first[0].eventId, yesterday.occurrenceId);
  assert.equal(first[1].eventId, `older-b:${new Date(now).setHours(0, 0, 0, 0)}`);
  assert.notEqual(first[0].sessionId, first[1].sessionId); assert.deepEqual(again, first);
});
test('occurrence coverage uses scheduledAt even if yesterday was only read or stopped today', async () => {
  const now = +new Date(2026, 10, 11, 8), yesterday = datedLegacy(+new Date(2026, 10, 10, 8), { createdAt: now });
  const h = mixedReader([yesterday], [{ id: 'older-b', state: 'alerting' }], { now });
  assert.equal((await h.read()).length, 2); assert.deepEqual(h.captures, ['older-b']);
});
test('the same local occurrence date remains covered across UTC midnight and a long DST day', async () => {
  const now = +new Date(2026, 10, 1, 23, 30), today = datedLegacy(+new Date(2026, 10, 1, 0, 0));
  if (process.env.TZ === 'America/New_York') {
    assert.equal((now - today.scheduledAt) / 3600000, 24.5);
    assert.notEqual(new Date(now).toISOString().slice(0, 10), new Date(today.scheduledAt).toISOString().slice(0, 10));
  }
  const h = mixedReader([today], [{ id: 'older-b', state: 'alerting' }], { now });
  assert.equal((await h.read()).length, 1); assert.deepEqual(h.captures, []);
});
test('crossing local midnight permits recovery even when the pending handoff is less than 24 hours old', async () => {
  const now = +new Date(2026, 10, 11, 0, 30), yesterday = datedLegacy(+new Date(2026, 10, 10, 23, 30));
  yesterday.scheduledAt = +new Date(2026, 10, 10, 23, 30);
  const h = mixedReader([yesterday], [{ id: 'older-b', state: 'alerting' }], { now });
  assert.equal((await h.read()).length, 2); assert.deepEqual(h.captures, ['older-b']);
});
test("today's legacy recovery cannot adopt yesterday's persisted Mystery session", async () => {
  const now = +new Date(2026, 10, 11, 8), at = +new Date(2026, 10, 10, 8);
  const saved = { id: 'v3-yesterday', startedAt: at, occurrenceKey: `b:${at}`, missions: [
    { kind: 'math', difficulty: 'gentle' }, { kind: 'shake', difficulty: 'gentle' },
    { kind: 'supplication', difficulty: 'gentle', duaIds: ['protection', 'waking'] },
  ] };
  const yesterday = datedLegacy(at, { sessionId: saved.id }), wakeSessions = { b: saved }, before = JSON.stringify(wakeSessions);
  const h = mixedReader([yesterday], [{ id: 'older-b', state: 'alerting' }], { now, wakeSessions });
  const result = await h.read();
  assert.equal(result.length, 2); assert.equal(result[0].sessionId, saved.id); assert.notEqual(result[1].sessionId, saved.id);
  assert.deepEqual(h.adoptions, []); assert.equal(JSON.stringify(wakeSessions), before);
});
test('an undated UserDefaults import retains its original Mystery snapshot across a delayed launch', async () => {
  const now = +new Date(2026, 10, 11, 8), saved = { id: 'v3-yesterday', startedAt: +new Date(2026, 10, 10, 8), missions: [] };
  const record = { ...datedLegacy(now), registrationId: 'legacy:b', occurrenceId: 'legacy:b:imported', sessionId: 'legacy:b:imported' };
  const h = mixedReader([record], [], { now, wakeSessions: { b: saved } });
  assert.equal((await h.read())[0].sessionId, saved.id); assert.deepEqual(h.adoptions, [[record.occurrenceId, saved.id]]);
});

for (const kind of ['snooze', 'timeout']) test(`a legacy ${kind} registration after midnight retains its explicitly linked Mystery session`, async () => {
  const now = +new Date(2026, 10, 11, 0, 1), saved = { id: 'v3-yesterday', startedAt: +new Date(2026, 10, 10, 23, 59), missions: [] };
  const registrationId = `legacy-${kind}`, occurrenceId = `${registrationId}:${new Date(now).setHours(0, 0, 0, 0)}`;
  const record = datedLegacy(now, { registrationId, occurrenceId, sessionId: occurrenceId });
  const registration = { kind: 'alarmkit', ids: [registrationId] };
  const options = { now, wakeSessions: { b: saved }, ...(kind === 'snooze' ? {
    snoozed: { alarmId: 'b', at: now, sessionId: saved.id, registration },
  } : { timeout: { alarmId: 'b', deadline: now, registration } }) };
  const h = mixedReader([record], [], options);
  assert.equal((await h.read())[0].sessionId, saved.id); assert.deepEqual(h.adoptions, [[occurrenceId, saved.id]]);
});
