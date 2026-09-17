const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { fixRuntimeScheduler, patchRuntimeSchedulerHeader } = require('./fix-expo-runtime-scheduler.cjs');

// Relevant declarations from Expo's RuntimeScheduler.h, including valid ARC annotations.
const brokenHeader = `class RuntimeScheduler {
public:
  SWIFT_RETURNS_RETAINED RuntimeScheduler(void *scheduler, ScheduleFn fn) noexcept
      : nativeScheduler(scheduler), scheduleFn(fn) {}
  SWIFT_RETURNS_RETAINED RuntimeScheduler() {}
  RuntimeScheduler(const RuntimeScheduler &) = delete;
  SWIFT_RETURNS_RETAINED static RuntimeScheduler *create();
  void retain() { refCount.fetch_add(1, std::memory_order_relaxed); }
  void release() { if (refCount.fetch_sub(1, std::memory_order_acq_rel) == 1) delete this; }
} SWIFT_SHARED_REFERENCE(retainRuntimeScheduler, releaseRuntimeScheduler);
`;
const fixedHeader = brokenHeader
  .replace('SWIFT_RETURNS_RETAINED RuntimeScheduler(void', 'RuntimeScheduler(void')
  .replace('SWIFT_RETURNS_RETAINED RuntimeScheduler()', 'RuntimeScheduler()');
const headerRelativePath = 'apple/Sources/ExpoModulesJSI-Cxx/include/RuntimeScheduler.h';

function installFixture(t, nested = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-expo-jsi-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true }));
  const expo = path.join(root, 'node_modules', 'expo');
  const core = path.join(nested ? expo : root, 'node_modules', 'expo-modules-core');
  const jsi = path.join(nested ? core : root, 'node_modules', 'expo-modules-jsi');
  for (const directory of [expo, core, jsi]) {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({
      name: path.basename(directory), version: '57.1.0',
    }));
  }
  const headerPath = path.join(jsi, headerRelativePath);
  fs.mkdirSync(path.dirname(headerPath), { recursive: true });
  fs.writeFileSync(headerPath, brokenHeader);
  return { root, headerPath };
}

test('removes only the two invalid annotations and preserves constructors and ARC', () => {
  assert.equal(patchRuntimeSchedulerHeader(brokenHeader), fixedHeader);
});

test('is idempotent and accepts an already fixed upstream header', () => {
  assert.equal(patchRuntimeSchedulerHeader(fixedHeader), fixedHeader);
  assert.equal(patchRuntimeSchedulerHeader(patchRuntimeSchedulerHeader(brokenHeader)), fixedHeader);
});

test('repairs a header with only one remaining annotated constructor', () => {
  const partial = brokenHeader.replace('SWIFT_RETURNS_RETAINED RuntimeScheduler()', 'RuntimeScheduler()');
  assert.equal(patchRuntimeSchedulerHeader(partial), fixedHeader);
});

test('preserves Windows CRLF line endings', () => {
  assert.equal(
    patchRuntimeSchedulerHeader(brokenHeader.replaceAll('\n', '\r\n')),
    fixedHeader.replaceAll('\n', '\r\n'),
  );
});

test('handles an annotation on a separate line', () => {
  const multiline = brokenHeader.replace('SWIFT_RETURNS_RETAINED RuntimeScheduler()', 'SWIFT_RETURNS_RETAINED\n  RuntimeScheduler()');
  assert.equal(patchRuntimeSchedulerHeader(multiline), fixedHeader);
});

test('also removes an invalid unretained constructor annotation', () => {
  const unretained = brokenHeader.replace('SWIFT_RETURNS_RETAINED RuntimeScheduler()', 'SWIFT_RETURNS_UNRETAINED RuntimeScheduler()');
  assert.equal(patchRuntimeSchedulerHeader(unretained), fixedHeader);
});

test('refuses unrecognized headers and unexpected extra annotated constructors', () => {
  assert.throws(() => patchRuntimeSchedulerHeader('unrelated header'), /Unexpected RuntimeScheduler/);
  assert.throws(
    () => patchRuntimeSchedulerHeader(brokenHeader + '  SWIFT_RETURNS_RETAINED RuntimeScheduler(int other) {}\n'),
    /more than two annotated constructors/,
  );
});

for (const nested of [false, true]) {
  test(`patches a ${nested ? 'nested' : 'hoisted'} install without rewriting it on a second run`, (t) => {
    const { root, headerPath } = installFixture(t, nested);
    assert.deepEqual(fixRuntimeScheduler(root), { changed: true, headerPath });
    assert.equal(fs.readFileSync(headerPath, 'utf8'), fixedHeader);
    fs.utimesSync(headerPath, 1234567890, 1234567890);
    const modified = fs.statSync(headerPath).mtimeMs;
    assert.deepEqual(fixRuntimeScheduler(root), { changed: false, headerPath });
    assert.equal(fs.statSync(headerPath).mtimeMs, modified);
  });
}

test('reports missing dependencies and missing headers instead of silently succeeding', (t) => {
  const { root, headerPath } = installFixture(t);
  fs.unlinkSync(headerPath);
  assert.throws(() => fixRuntimeScheduler(root), /Cannot read .*RuntimeScheduler\.h/);
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-no-expo-'));
  t.after(() => fs.rmSync(emptyRoot, { recursive: true, force: true }));
  assert.throws(() => fixRuntimeScheduler(emptyRoot), /Cannot resolve expo ->/);
});

test('does not write a header when validation fails', (t) => {
  const { root, headerPath } = installFixture(t);
  fs.writeFileSync(headerPath, 'unexpected header');
  assert.throws(() => fixRuntimeScheduler(root), /Unexpected RuntimeScheduler/);
  assert.equal(fs.readFileSync(headerPath, 'utf8'), 'unexpected header');
});

test('CLI locates the project relative to the script, not the current directory', (t) => {
  const { root, headerPath } = installFixture(t);
  const scriptPath = path.join(root, 'scripts', 'fix-expo-runtime-scheduler.cjs');
  fs.mkdirSync(path.dirname(scriptPath));
  fs.copyFileSync(path.join(__dirname, 'fix-expo-runtime-scheduler.cjs'), scriptPath);
  const result = spawnSync(process.execPath, [scriptPath], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Patched constructor annotations/);
  assert.equal(fs.readFileSync(headerPath, 'utf8'), fixedHeader);
  fs.unlinkSync(headerPath);
  const failed = spawnSync(process.execPath, [scriptPath], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /Cannot read/);
});

test('package scripts apply the workaround after install and before an iOS run', () => {
  const { scripts } = require('../package.json');
  const command = 'node scripts/fix-expo-runtime-scheduler.cjs';
  assert.equal(scripts.postinstall, command);
  assert.equal(scripts.preios, command);
  assert.equal(scripts['fix:ios-jsi'], command);
  assert.match(scripts['test:unit'], /scripts\/fix-expo-runtime-scheduler\.test\.cjs/);
});
