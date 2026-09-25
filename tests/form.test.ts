import test from 'node:test';
import assert from 'node:assert/strict';
import { stringify } from 'yaml';
import { readSong, parseChord, transposeText, asBar } from '../lib/song';
import { appendFormStep, insertFeature, selectedBar } from '../lib/edit';
import { renderChart } from '../lib/render';
const source=stringify({format:1,titel:'Test',artist:'Test',grundtonart:'C',taktart:'4/4',delar:[{namn:'Vers',takter:['C','G7']},{namn:'Refräng',takter:['F','G7']}]});
test('form references existing parts, survives transposition and renders music only once',async()=>{
 const text=appendFormStep(appendFormStep(source,'Vers',1),'Refräng',2);
 const song=readSong(text);
 assert.deepEqual(song.spelordning,[{del:'Vers',ganger:1},{del:'Refräng',ganger:1},{del:'Vers',ganger:1},{del:'Refräng',ganger:2}]);
 assert.deepEqual(readSong(transposeText(text,'D','#')).spelordning,song.spelordning);
 const svg=(await renderChart(song)).pages!.join('');
 assert.ok(svg.includes('Refräng × 2 → SLUT'));assert.ok(svg.includes('>4</text>'));assert.ok(!svg.includes('>5</text>'));
 assert.throws(()=>appendFormStep(source,'Saknas',1),/finns inte/);
 assert.throws(()=>appendFormStep(source,'Vers',0));
 assert.throws(()=>readSong(text.replace('namn: Refräng','namn: Vers')),/unika namn/);
 const added=readSong(insertFeature(text,0,'del').text);
 assert.equal(added.spelordning?.at(-1)?.del,'Ny del');
});
test('N.C aliases and bare percent work in text, insertion and transposition',()=>{
 for(const name of ['N.C','N.C.','NC','nc']) assert.equal(parseChord(name).root,'N.C.');
 const text=source.replace('      - C','      - N.C').replace('      - G7','      - % # upprepa');
 const withNotes=text+'anteckningar:\n  - |\n    - %\n';
 assert.deepEqual(readSong(transposeText(withNotes,'D','#')).anteckningar,['- %\n']);
 assert.throws(()=>readSong(source.replace('      - C','      - @fel')));
 const song=readSong(text);assert.equal(song.delar[0].takter[1],'%');
 const shifted=transposeText(text,'D','#');assert.ok(shifted.includes('# upprepa'));assert.equal(readSong(shifted).delar[0].takter[1],'%');
 assert.deepEqual(selectedBar(text,text.lastIndexOf('G7')),{section:1,bar:1});
 assert.equal(asBar(readSong(insertFeature(text,text.indexOf('%'),'repris_slut').text).delar[0].takter[1]).repris_slut,true);
 assert.equal(asBar(readSong(insertFeature(source,source.indexOf('      - C')+8,'repeat_bar').text).delar[0].takter[0]).ackord,'%');
 const object=source.replace('      - C','      - ackord: %');assert.equal(asBar(readSong(object).delar[0].takter[0]).ackord,'%');
});
test('special-symbol buttons remove incompatible chord positions but keep form markings',()=>{
 const text=source.replace('      - C','      - ackord: C G7\n        slag: [1, 4]\n        fermat: 2\n        repris_start: true');
 for(const action of ['nc','repeat_bar'] as const){
  const edited=readSong(insertFeature(text,text.indexOf('C G7'),action).text);
  assert.deepEqual(asBar(edited.delar[0].takter[0]),{ackord:action==='nc'?'N.C.':'%',repris_start:true});
 }
});
test('N.C. and percent are visible in SVG and export as PDF',async()=>{
 const song=readSong(source.replace('      - C','      - N.C').replace('      - G7','      - %'));
 const result=await renderChart(song);assert.ok(result.pages![0].includes('>N.C.</text>'));assert.ok(result.pages![0].includes('>%</text>'));
 const pdf=await renderChart(song,'pdf');assert.ok(pdf.pdf!.length>1000);
});
