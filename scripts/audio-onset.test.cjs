const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function read(file) {
  const b = fs.readFileSync(path.join(root, file));
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  const samples = Array.from({ length: (b.length - 44) / 2 }, (_, i) => b.readInt16LE(44 + i * 2) / 32768);
  return { rate: b.readUInt32LE(24), samples };
}
for (const id of ['adhan', 'adhan_alafasy_fajr']) {
  test(`${id}: full playback and iOS excerpt start audibly at the same point`, () => {
    const full = read(`assets/audio/prepared/refresh_full_${id}.wav`);
    const clip = read(`assets/audio/alarms/daybreak_${id}.wav`);
    assert.ok(full.samples.length / full.rate > 180);
    assert.equal(clip.samples.length / clip.rate, 29);
    const onset = audio => audio.samples.findIndex(s => Math.abs(s) > .0032) / audio.rate;
    assert.ok(onset(full) >= 0 && onset(full) < .2, `onset ${onset(full)}`);
    assert.ok(Math.abs(onset(full) - onset(clip)) < .02);
    const power = full.samples.slice(0, full.rate / 2).reduce((sum, s) => sum + s * s, 0) / (full.rate / 2);
    assert.ok(Math.sqrt(power) > .003, 'opening contains meaningful audio');
  });
}
