import { readFile, writeFile } from 'node:fs/promises';
import { readSong } from '../../lib/song';
import { renderChart } from '../../lib/render';

// A deliberately shortened design example. The original song is never edited.
const original = readSong(await readFile('songs/tro.yaml', 'utf8'));
const base = {...original, version: 'Designexempel', kallor: [], anteckningar: [],
  delar: [original.delar[0], {...original.delar[2], takter: original.delar[2].takter.slice(0, 8)},
    {...original.delar[1], takter: original.delar[1].takter.slice(0, 8)}]};
base.delar[2].takter[0] = {ackord:'D',repris_start:true};
base.delar[2].takter[7] = {ackord:'G',repris_slut:true};
const rhythm = structuredClone(base);
rhythm.delar[1].takter[6] = {ackord:'D A', slag:[1,3], rytm:[{slag:1,notvarde:8},{slag:1.5,notvarde:8},{slag:3,notvarde:4}]};
const house = structuredClone(base);
house.delar[2].takter[0] = {ackord:'D',repris_start:true};
house.delar[2].takter[6] = {ackord:'G',hus:'1.'};
house.delar[2].takter[7] = {ackord:'G',hus_slut:true,repris_slut:true};
const structure = structuredClone(base);
structure.delar.push({namn:'',ateranvand:'Vers',ganger:2,takter:[],anvisning:'Instrumentalt'});
const scores:Record<string,string> = {};
for (const [key,song] of Object.entries({base,rhythm,house,structure})) {
  const output = await renderChart(song);
  if (output.pages) scores[key] = output.pages[0];
}
await writeFile('design/mockups/scores.js', 'window.SCORES = '+JSON.stringify(scores)+';\n');
