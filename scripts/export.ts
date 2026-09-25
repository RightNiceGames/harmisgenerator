import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readSong } from '../lib/song';
import { renderChart } from '../lib/render';
const [source = 'songs/flykten-fran-vardagen.yaml', dest] = process.argv.slice(2);
try {
  const song = readSong(await readFile(source, 'utf8'));
  const output = dest || path.join('outputs', path.basename(source).replace(/\.ya?ml$/, '') + '.pdf');
  if (!output.endsWith('.pdf')) throw new Error('Målfilen måste sluta med .pdf.');
  const result = await renderChart(song, 'pdf');
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, result.pdf!);
  console.log(`${output} (${result.pageCount} sidor)`);
} catch (e) { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }
