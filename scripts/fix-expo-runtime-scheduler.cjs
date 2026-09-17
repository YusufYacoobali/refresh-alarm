const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const HEADER_PATH = 'apple/Sources/ExpoModulesJSI-Cxx/include/RuntimeScheduler.h';

/**
 * Work around Expo SDK 57's invalid Swift ownership annotations on constructors.
 * Keep the class's SWIFT_SHARED_REFERENCE and its retain/release functions intact.
 * Upstream: https://github.com/expo/expo/issues/49214
 * Reproduction: https://github.com/expo/expo/issues/50067
 * This becomes a no-op once Expo ships a header without the invalid annotations.
 */
function patchRuntimeSchedulerHeader(source) {
  if (!/\bclass\s+RuntimeScheduler\b/.test(source)) {
    throw new Error('Unexpected RuntimeScheduler.h format; review the Expo JSI workaround.');
  }

  // Match only constructor declarations, not valid annotations on factory methods.
  const annotation = /^([ \t]*)SWIFT_RETURNS_(?:UN)?RETAINED[ \t\r\n]+(?=RuntimeScheduler[ \t]*\()/gm;
  let removed = 0;
  const patched = source.replace(annotation, (_match, indentation) => {
    removed += 1;
    return indentation;
  });

  if (removed > 2) {
    throw new Error('Found more than two annotated constructors; review the Expo JSI workaround.');
  }

  return patched;
}

function fixRuntimeScheduler(projectRoot = path.resolve(__dirname, '..')) {
  let packagePath;
  try {
    // Follow Expo's actual dependency chain, including non-hoisted installations.
    const appRequire = createRequire(path.resolve(projectRoot, 'package.json'));
    const expoRequire = createRequire(appRequire.resolve('expo/package.json'));
    const coreRequire = createRequire(expoRequire.resolve('expo-modules-core/package.json'));
    packagePath = coreRequire.resolve('expo-modules-jsi/package.json');
  } catch (cause) {
    throw new Error(
      'Cannot resolve expo -> expo-modules-core -> expo-modules-jsi. Install dependencies and check the Expo dependency tree.',
      { cause },
    );
  }

  const headerPath = path.join(path.dirname(packagePath), HEADER_PATH);
  let source;
  try {
    source = fs.readFileSync(headerPath, 'utf8');
  } catch (cause) {
    throw new Error(`Cannot read ${headerPath}; review the Expo JSI workaround.`, { cause });
  }

  const patched = patchRuntimeSchedulerHeader(source);
  const changed = patched !== source;
  if (changed) {
    fs.writeFileSync(headerPath, patched, 'utf8');
  }
  return { changed, headerPath };
}

if (require.main === module) {
  try {
    const { changed, headerPath } = fixRuntimeScheduler();
    console.log(`[expo-jsi] ${changed ? 'Patched constructor annotations' : 'No patch needed'}: ${headerPath}`);
  } catch (error) {
    console.error(`[expo-jsi] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { fixRuntimeScheduler, patchRuntimeSchedulerHeader };
