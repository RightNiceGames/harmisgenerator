import test from 'node:test';
import assert from 'node:assert/strict';
import {parseChord,readSong,transposeText,transposeChord,asBar} from '../lib/song';
import {replaceExistingChord} from '../lib/edit';
import {renderChart} from '../lib/render';
import {stringify} from 'yaml';
const text=stringify({format:1,titel:'Test',artist:'Test',grundtonart:'C',taktart:'4/4',delar:[{namn:'Vers',takter:[{ackord:'C (G7/B)',slag:[1,4],varianter:[{gang:2,ackord:'(F6/9/A)'}]}]}]});
test('whole-chord parentheses coexist with extension parentheses and slash bass',()=>{
 assert.deepEqual(parseChord('(G7/B)'),{root:'G',extension:'7',bass:'B',parenthesized:true});
 assert.equal(parseChord('Fm(maj9)').parenthesized,undefined);
 assert.equal(parseChord('(Fm(maj9)/Ab)').extension,'m(maj9)');
 assert.equal(transposeChord('(Fm(maj9)/Ab)',2,'b'),'(Gm(maj9)/Bb)');
 for(const chord of ['(G7','G7)','((G7))','(C F)','()','C(maj7'])assert.throws(()=>parseChord(chord));
 assert.equal(transposeChord('(N.C.)',3,'#'),'(N.C.)');assert.equal(transposeChord('(%)',3,'#'),'(%)');
});
test('transposition and preview editing retain parentheses and chord timing',()=>{
 const song=readSong(transposeText(text,'D','#')),bar=asBar(song.delar[0].takter[0]);
 assert.equal(bar.ackord,'D (A7/C#)');assert.deepEqual(bar.slag,[1,4]);assert.equal(bar.varianter![0].ackord,'(G6/9/B)');
 const edited=readSong(replaceExistingChord(text,{section:0,bar:0,chord:1},'(Bb7/F)'));
 assert.equal(asBar(edited.delar[0].takter[0]).ackord,'C (Bb7/F)');
});
test('SVG and PDF enclose complete chords, including variant chords',async()=>{
 const song=readSong(text),svg=(await renderChart(song)).pages![0];
 assert.equal((svg.match(/>\(<\/text>/g)||[]).length,2);assert.equal((svg.match(/>\)<\/text>/g)||[]).length,2);
 assert.ok(svg.includes('Ändra (G7/B), Vers, takt 1'));assert.ok((await renderChart(song,'pdf')).pdf!.length>1000);
});
