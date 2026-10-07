import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { asBar, readSong, transposeText } from '../lib/song';
import { renderChart } from '../lib/render';
const source = await readFile('songs/medley-anglamark-vintersaga-du-maste-finnas-tro.yaml', 'utf8');

// Expectations describe the stored arrangement, including its inherited meter.
test('medley preserves stored meters, key changes and transitions through export', async () => {
  const song = readSong(source);
  assert.equal(song.taktart, '6/8');
  const changes = song.delar.flatMap(part => part.takter.map(asBar)).filter(bar => bar.tonart);
  assert.deepEqual(changes.map(bar => [bar.tonart, bar.taktart]), [['Bb','6/8'],['F#m',undefined],['Eb','4/4'],['D','4/4']]);
  const guitar = song.delar.find(part => part.namn === 'Du måste finnas · Gitarrövergång')!;
  assert.deepEqual(guitar.takter.map(raw => asBar(raw).ackord), ['C#m B','A','G#7','F#m B7']);
  const solo = song.delar.find(part => part.namn === 'Vintersaga · Solo på cue')!;
  assert.equal(solo.takter.length, 4);
  assert.equal(asBar(solo.takter[0]).repris_start, true);
  assert.equal(asBar(solo.takter[3]).repris_slut, true);
  assert.match(asBar(solo.takter[3]).anvisning!, /cue/);
  assert.equal(song.delar.find(part => part.namn === 'Tro · Stick / solo')!.takter.length, 8);
  const svg = (await renderChart(song)).pages!.join('');
  for (const label of ['6/8','>4</text>','Rubato','Vidare på cue','BREAK','SLUT']) assert.ok(svg.includes(label), label);
  const pdf = await renderChart(song, 'pdf');
  assert.ok(pdf.pdf!.length > 1000);
});

test('transposing the medley shifts every local key and preserves the meter change', () => {
  const song = readSong(transposeText(source, 'C', 'b'));
  const changes = song.delar.flatMap(part => part.takter.map(asBar)).filter(bar => bar.tonart);
  assert.deepEqual(changes.map(bar => [bar.tonart, bar.taktart]), [['C','6/8'],['Abm',undefined],['F','4/4'],['E','4/4']]);
});

test('chord timing follows 6/8 then 4/4 within the same document', () => {
  const text = `format: 1\ntitel: Taktartsbyte\nartist: Test\ngrundtonart: Bb\ntaktart: 6/8\ndelar:\n  - namn: A\n    takter:\n      - ackord: Bb F\n        slag: [1, 6]\n      - ackord: Fm Eb\n        taktart: 4/4\n        slag: [1, 4]\n      - ackord: Fm Eb\n        slag: [1, 4]\n`;
  assert.doesNotThrow(() => readSong(text));
  assert.throws(() => readSong(text.replaceAll('slag: [1, 4]', 'slag: [1, 6]')), /4\/4/);
});
