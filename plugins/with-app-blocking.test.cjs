const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const xcode = require('xcode');
const plist = require('@expo/plist').default;

test('iOS prebuild embeds one Screen Time extension with matching signing and shared files', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-app-block-'));
  try {
    const root = path.resolve(__dirname, '..');
    const projectPath = path.join(temp, 'project.pbxproj');
    fs.writeFileSync(projectPath, execFileSync('tar', ['-xOf', path.join(root, 'node_modules/expo/template.tgz'), 'package/ios/HelloWorld.xcodeproj/project.pbxproj']));
    const project = xcode.project(projectPath).parseSync();
    const callbacks = {};
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'with-app-blocking.cjs'), 'utf8'), { module, require(id) {
      if (id === 'expo/config-plugins') return {
        withEntitlementsPlist(config, fn) { callbacks.entitlements = fn; return config; },
        withXcodeProject(config, fn) { callbacks.project = fn; return config; },
      };
      return require(id);
    } });
    const config = { ios: { bundleIdentifier: 'com.yacoobali.alarm', appleTeamId: 'TESTTEAM' }, version: '1.2.3' };
    for (let i = 0; i < 2; i++) {
      module.exports(config);
      callbacks.project({ modResults: project, modRequest: { projectRoot: root, platformProjectRoot: temp } });
    }
    const targets = Object.values(project.pbxNativeTargetSection()).filter(t => t.name === '"RefreshAppBlockMonitor"');
    assert.equal(targets.length, 1);
    assert.equal(config.extra.eas.build.experimental.ios.appExtensions.length, 1);
    const entitlements = callbacks.entitlements({ modResults: { 'com.apple.security.application-groups': ['group.existing'] } }).modResults;
    assert.ok(entitlements['com.apple.security.application-groups'].includes('group.existing'));
    assert.equal(entitlements['com.apple.developer.family-controls'], true);
    const info = plist.parse(fs.readFileSync(path.join(temp, 'RefreshAppBlockMonitor/RefreshAppBlockMonitor-Info.plist'), 'utf8'));
    assert.equal(info.NSExtension.NSExtensionPointIdentifier, 'com.apple.deviceactivity.monitor-extension');
    assert.equal(info.CFBundleShortVersionString, '1.2.3');
    const build = project.writeSync();
    assert.match(build, /RefreshAppBlockShared.swift in Sources/);
    assert.match(build, /RefreshAppBlockMonitor.appex in Copy Files/);
    assert.match(build, /DEVELOPMENT_TEAM = TESTTEAM/);
    // A real parse/write round-trip catches malformed Xcode object references.
    fs.writeFileSync(projectPath, build);
    assert.doesNotThrow(() => xcode.project(projectPath).parseSync());
  } finally {
    const resolved = path.resolve(temp);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('refresh-app-block-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
