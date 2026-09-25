import test from 'node:test';
import assert from 'node:assert/strict';
import { stringify } from 'yaml';
import { readSong, asBar, transposeText } from '../lib/song';
import { insertFeature } from '../lib/edit';
import { renderChart } from '../lib/render';
const bar = {ackord:'Bbsus4 Bb7',slag:[1,4],rytm:[{slag:1,notvarde:8},{slag:1.5,notvarde:8},{slag:2.5,notvarde:8}],varianter:[{gang:2,stamma:'bas',ackord:'Eb11/Bb'}]};
const source = (value:unknown=bar,meter='4/4') => stringify({format:1,titel:'Rytmtest',artist:'Test',grundtonart:'Eb',taktart:meter,delar:[{namn:'Vers',takter:[value]}]});
test('transposition includes variants while preserving timing and comments',()=>{
  const result=transposeText(source()+'# Behåll kommentaren\n','F','b');
  const shifted=asBar(readSong(result).delar[0].takter[0]);
  assert.equal(shifted.ackord,'Csus4 C7');
  assert.deepEqual(shifted.varianter,[{gang:2,stamma:'bas',ackord:'F11/C'}]);
  assert.deepEqual(shifted.slag,[1,4]);assert.deepEqual(shifted.rytm,bar.rytm);
  assert.ok(result.includes('# Behåll kommentaren'));
});
test('rhythms and chord starts respect meter, sequence and note duration',()=>{
  assert.doesNotThrow(()=>readSong(source()));
  for(const invalid of [
    {...bar,slag:[1]}, {...bar,slag:[1,5]}, {...bar,slag:[2,4]},
    {...bar,rytm:[{slag:4.75,notvarde:8}]},
    {...bar,rytm:[{slag:1,notvarde:4},{slag:1.5,notvarde:8}]},
    {...bar,synkop:{typ:'offbeat',ackord:2}},
    {...bar,varianter:[...bar.varianter,...bar.varianter]},
    {...bar,varianter:[{gang:2,ackord:'H11'}]},
    {...bar,varianter:[{gang:2,ackord:'C F',slag:[1,5]}]},
  ]) assert.throws(()=>readSong(source(invalid)));
  assert.doesNotThrow(()=>readSong(source({ackord:'C',rytm:[{slag:6,notvarde:8}]},'6/8')));
  assert.throws(()=>readSong(source({ackord:'C',rytm:[{slag:6,notvarde:4}]},'6/8')));
});
test('feature buttons add editable timing and consecutive variants at the selected bar',()=>{
  let text=source({ackord:'C G'});
  for(const action of ['slag','rytm','variant','variant'] as const) text=insertFeature(text,text.indexOf('ackord: C'),action).text;
  const result=asBar(readSong(text).delar[0].takter[0]);
  assert.deepEqual(result.slag,[1,3]); assert.deepEqual(result.rytm,bar.rytm);
  assert.deepEqual(result.varianter?.map(v=>v.gang),[2,3]);
  assert.throws(()=>insertFeature(text,text.indexOf('ackord: C'),'offbeat'),/Ta bort rytm/);
});
test('preview places beat-four chord after all three rhythm attacks and labels variants',async()=>{
  const svg=(await renderChart(readSong(source()))).pages![0];
  assert.ok(svg.includes('2:a gången · bas'));assert.ok(svg.includes('>1å</text>'));assert.ok(svg.includes('>2å</text>'));
  const heads=[...svg.matchAll(/<ellipse cx="([\d.]+)"/g)].map(m=>Number(m[1]));
  const roots=[...svg.matchAll(/<text x="([\d.]+)"[^>]*>B♭<\/text>/g)].map(m=>Number(m[1]));
  assert.equal(heads.length,3); assert.equal(roots.length,2);
  assert.equal(roots[0],heads[0]);assert.ok(roots[1]>heads[2]);
  assert.ok(Math.abs((roots[1]-roots[0])/(heads[1]-heads[0])-6)<.001);
});
test('expanded variant rows paginate with every text inside the page',async()=>{
  const song=readSong(source());song.delar[0].takter=Array.from({length:60},()=>structuredClone(song.delar[0].takter[0]));
  const pages=(await renderChart(song)).pages!;assert.ok(pages.length>1);
  assert.equal(pages.join('').split('2:a gången · bas').length-1,60);
  for(const page of pages) for(const m of page.matchAll(/<text x="[\d.]+" y="([\d.]+)"/g)) assert.ok(Number(m[1])<830);
});
