import test from 'node:test';
import assert from 'node:assert/strict';
import { stringify } from 'yaml';
import { asBar, readSong, transposeText } from '../lib/song';
import { PAGE_HEIGHT, renderChart } from '../lib/render';
import { PDFDocument } from 'pdf-lib';

const source = (texts: (string | undefined)[] = []) => stringify({
  format: 1, titel: 'Nottext', artist: 'Test', grundtonart: 'C', taktart: '4/4',
  delar: [{namn: 'Vers', takter: [{ackord: 'C', anvisning: 'Bas',
    rytm: [1, 1.5, 2.5].map((slag, i) => ({slag, notvarde: 8, ...(texts[i] === undefined ? {} : {text: texts[i]})})),
  }, 'F', 'G', 'C', 'Am']}],
});
const textsIn = (svg: string) => [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>(.*?)<\/text>/g)]
  .map(m => ({x: Number(m[1]), y: Number(m[2]), value: m[3]}));

test('note text is optional free text and survives transposition unchanged', () => {
  const value = source(['Eb', 'kort', '<&>']);
  const bar = asBar(readSong(transposeText(value, 'D', '#')).delar[0].takter[0]);
  assert.equal(bar.ackord, 'D');
  assert.deepEqual(bar.rytm?.map(n => n.text), ['Eb', 'kort', '<&>']);
  assert.throws(() => readSong(source(['a'.repeat(81)])));
});

test('absent, empty and whitespace-only annotations produce identical layout', async () => {
  const plain = await renderChart(readSong(source()));
  const empty = await renderChart(readSong(source(['', '  ', '\n\t'])));
  assert.deepEqual(empty.pages, plain.pages);
});

test('annotations sit beneath their notes and reserve height before chords', async () => {
  const plain = textsIn((await renderChart(readSong(source()))).pages![0]);
  const svg = (await renderChart(readSong(source(['Eb', 'F', 'G'])))).pages![0];
  const text = textsIn(svg);
  const heads = [...svg.matchAll(/<ellipse cx="([\d.]+)" cy="([\d.]+)"/g)].map(m => ({x: +m[1], y: +m[2]}));
  for (const [i, value] of ['Eb', 'F', 'G'].entries()) {
    const label = text.find(t => t.value === value && t.x === heads[i].x - 2)!;
    assert.ok(label);
    assert.equal(label.y, heads[i].y + 9);
    assert.ok(label.y < text.find(t => t.value === 'C')!.y - 17);
  }
  assert.equal(text.find(t => t.value === 'C')!.y - plain.find(t => t.value === 'C')!.y, 10);
  assert.equal(text.find(t => t.value === 'A')!.y - plain.find(t => t.value === 'A')!.y, 10);
  assert.equal(text.find(t => t.value === 'Bas')!.y, plain.find(t => t.value === 'Bas')!.y);
});

test('long annotations wrap, escape XML and paginate consistently in SVG and PDF', async () => {
  const song = readSong(source(['ta ka', '<&>', 'F']));
  const bar = song.delar[0].takter[0];
  song.delar[0].takter = Array.from({length: 48}, () => structuredClone(bar));
  const svg = await renderChart(song);
  assert.ok(svg.pages!.length > 1);
  assert.ok(svg.pages!.join('').includes('&lt;&amp;&gt;'));
  const text = textsIn(svg.pages![0]);
  assert.ok(text.some(t => t.value === 'ta'));
  assert.ok(text.some(t => t.value === 'ka'));
  for (const page of svg.pages!) for (const item of textsIn(page)) {
    if (/^\d+ \/ \d+$/.test(item.value)) continue; // Page footer sits below the chart.
    assert.ok(item.y < PAGE_HEIGHT - 20);
  }
  const pdf = await PDFDocument.load((await renderChart(song, 'pdf')).pdf!);
  assert.equal(pdf.getPageCount(), svg.pages!.length);
});
