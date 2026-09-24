// Reuse the existing artwork without redrawing or cropping its composition.
const fs = require('node:fs/promises');
const path = require('node:path');
const { generateImageAsync } = require('@expo/image-utils');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  for (const [name, size] of [['icon.png', 1024], ['favicon.png', 64]]) {
    const { source } = await generateImageAsync({ projectRoot }, {
      src: path.join(projectRoot, 'assets/art/moon.png'),
      width: size,
      height: size,
      resizeMode: 'contain',
      backgroundColor: '#090C18',
      removeTransparency: true,
    });
    await fs.writeFile(path.join(projectRoot, 'assets', name), source);
    console.log(`${name}: ${size} × ${size}`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
