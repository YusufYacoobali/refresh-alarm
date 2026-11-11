const { withEntitlementsPlist, withXcodeProject } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist');

const TARGET = 'RefreshAppBlockMonitor';
const GROUP = 'group.com.yacoobali.alarm.appblocking';
module.exports = function withAppBlocking(config) {
  const bundle = `${config.ios.bundleIdentifier}.appblock`;
  const entitlements = { 'com.apple.developer.family-controls': true, 'com.apple.security.application-groups': [GROUP] };
  config.extra ??= {};
  config.extra.eas ??= {};
  config.extra.eas.build ??= {};
  config.extra.eas.build.experimental ??= {};
  config.extra.eas.build.experimental.ios ??= {};
  const extensions = config.extra.eas.build.experimental.ios.appExtensions ??= [];
  if (!extensions.some(e => e.targetName === TARGET)) extensions.push({ targetName: TARGET, bundleIdentifier: bundle, entitlements });
  config = withEntitlementsPlist(config, mod => {
    mod.modResults['com.apple.developer.family-controls'] = true;
    mod.modResults['com.apple.security.application-groups'] = [...new Set([...(mod.modResults['com.apple.security.application-groups'] ?? []), GROUP])];
    return mod;
  });
  return withXcodeProject(config, mod => {
    const root = mod.modRequest.projectRoot;
    const output = path.join(mod.modRequest.platformProjectRoot, TARGET);
    fs.mkdirSync(output, { recursive: true });
    fs.copyFileSync(path.join(root, 'plugins/app-blocking/RefreshAppBlockMonitor.swift'), path.join(output, 'RefreshAppBlockMonitor.swift'));
    fs.copyFileSync(path.join(root, 'modules/daybreak-alarm-kit/ios/RefreshAppBlockShared.swift'), path.join(output, 'RefreshAppBlockShared.swift'));
    fs.writeFileSync(path.join(output, `${TARGET}.entitlements`), plist.default.build(entitlements));
    fs.writeFileSync(path.join(output, `${TARGET}-Info.plist`), plist.default.build({
      CFBundleDisplayName: 'Refresh app blocking', CFBundleExecutable: '$(EXECUTABLE_NAME)',
      CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)', CFBundleName: '$(PRODUCT_NAME)',
      CFBundlePackageType: 'XPC!', CFBundleShortVersionString: config.version ?? '1.0.0',
      CFBundleVersion: config.ios.buildNumber ?? '1',
      NSExtension: { NSExtensionPointIdentifier: 'com.apple.deviceactivity.monitor-extension', NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).RefreshAppBlockMonitor' },
    }));
    const project = mod.modResults;
    const targets = project.pbxNativeTargetSection();
    let targetId = Object.keys(targets).find(key => !key.endsWith('_comment') && targets[key].name?.replaceAll('"', '') === TARGET);
    if (!targetId) {
      // node-xcode expects these sections to exist before adding dependencies.
      project.hash.project.objects.PBXTargetDependency ??= {};
      project.hash.project.objects.PBXContainerItemProxy ??= {};
      const target = project.addTarget(TARGET, 'app_extension', TARGET, bundle);
      targetId = target.uuid;
      project.addBuildPhase([`${TARGET}/RefreshAppBlockMonitor.swift`, `${TARGET}/RefreshAppBlockShared.swift`], 'PBXSourcesBuildPhase', 'Sources', targetId);
      project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', targetId);
    }
    const configurations = project.pbxXCConfigurationList()[targets[targetId].buildConfigurationList].buildConfigurations;
    for (const ref of configurations) {
      const settings = project.pbxXCBuildConfigurationSection()[ref.value].buildSettings;
      Object.assign(settings, {
        SWIFT_VERSION: '5.0', IPHONEOS_DEPLOYMENT_TARGET: '16.4',
        CODE_SIGN_ENTITLEMENTS: `"${TARGET}/${TARGET}.entitlements"`,
        APPLICATION_EXTENSION_API_ONLY: 'YES', TARGETED_DEVICE_FAMILY: '"1,2"',
        GENERATE_INFOPLIST_FILE: 'NO', CODE_SIGN_STYLE: 'Automatic',
      });
      if (config.ios.appleTeamId) settings.DEVELOPMENT_TEAM = config.ios.appleTeamId;
    }
    return mod;
  });
};
