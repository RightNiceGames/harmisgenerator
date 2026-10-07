import test from 'node:test';
import assert from 'node:assert/strict';
import {stringify} from 'yaml';
import {asBar,readSong} from '../lib/song';
import {patchBar,setHighlight,duplicateBars,reorderChord,deleteChord,moveSection} from '../lib/score-edit';
import {renderChart} from '../lib/render';
import {highlightColors,type HighlightTarget} from '../lib/highlight';
import {PDFDocument} from 'pdf-lib';
const source=stringify({format:1,titel:'Markerad låt',artist:'Test',grundtonart:'C',taktart:'4/4',delar:[{namn:'Vers',takter:[{ackord:'C G',fermat:1},'Am']},{ateranvand:'Vers',anvisning:'Bara sista ordet'}]})+'# Behåll kommentaren\n';
const decode=(s:string)=>s.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const targets=(svg:string)=>[...svg.matchAll(/data-highlight-target="([^"]+)"/g)].map(m=>JSON.parse(decode(m[1])) as HighlightTarget);
test('highlights move with measures and chords, duplicate, erase and keep YAML comments',()=>{
 let marked=setHighlight(source,{section:0,bar:0},'ackord:0','rod');
 marked=setHighlight(marked,{section:0,bar:0},'ackord:1','bla');
 const reordered=reorderChord(marked,{section:0,bar:0},0,1);
 assert.deepEqual(asBar(readSong(reordered).delar[0].takter[0]).markeringar?.map(m=>[m.element,m.farg]),[['ackord:1','rod'],['ackord:0','bla']]);
 const deleted=deleteChord(reordered,{section:0,bar:0},0);
 assert.deepEqual(asBar(readSong(deleted).delar[0].takter[0]).markeringar,[{element:'ackord:0',farg:'rod'}]);
 const copied=duplicateBars(marked,0,[0]);
 assert.deepEqual(asBar(readSong(copied).delar[0].takter[1]).markeringar,asBar(readSong(marked).delar[0].takter[0]).markeringar);
 assert.ok(copied.includes('# Behåll kommentaren'));
 const moved=moveSection(marked,0,1);assert.equal(asBar(readSong(moved).delar[1].takter[0]).markeringar?.length,2);
 const cleared=setHighlight(setHighlight(marked,{section:0,bar:0},'ackord:0',null),{section:0,bar:0},'ackord:1',null);
 assert.equal(asBar(readSong(cleared).delar[0].takter[0]).markeringar,undefined);
});
test('symbols and partial text highlights have identical screen print and PDF drawing data',async()=>{
 const svg=(await renderChart(readSong(source),'svg',{editable:true})).pages![0],all=targets(svg);
 const word=all.find(t=>t.owner.section===1&&t.text==='Bara sista ordet')!;
 const symbol=all.find(t=>t.element.startsWith('Fermat:'))!;
 assert.ok(word.positions);assert.ok(symbol);
 let marked=setHighlight(source,word.owner,word.element,'gul',{fran:11,till:16});
 marked=setHighlight(marked,symbol.owner,symbol.element,'gron');
 marked=setHighlight(marked,{section:0,bar:0},'ackord:0','rod');
 marked=setHighlight(marked,{section:1},'text:Vers:0','bla');
 const plain=(await renderChart(readSong(marked))).pages![0],editable=(await renderChart(readSong(marked),'svg',{editable:true})).pages![0];
 for(const color of Object.values(highlightColors))assert.ok(plain.includes(`fill="${color}"`));
 const rectangles=(s:string)=>[...s.matchAll(/<rect class="score-highlight"[^>]+\/>/g)].map(m=>m[0]);
 assert.deepEqual(rectangles(plain),rectangles(editable));
 assert.ok(!plain.includes('highlight-hit'));
 const pdf=await PDFDocument.load((await renderChart(readSong(marked),'pdf')).pdf!);assert.equal(pdf.getPageCount(),1);
 assert.throws(()=>setHighlight(source,word.owner,word.element,'gul',{fran:5,till:2}));
});
test('time signatures stack at the start of measures with room before the chord',async()=>{
 const text=patchBar(source,{section:0,bar:1},{taktart:'3/4'});
 const svg=(await renderChart(readSong(text),'svg',{editable:true})).pages![0];
 assert.ok(targets(svg).some(t=>t.element==='taktart'&&t.owner.bar===0));
 const marked=setHighlight(text,{section:0,bar:0},'taktart','bla');
 assert.ok((await renderChart(readSong(marked))).pages![0].includes(highlightColors.bla));
 const digits=[...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="11"[^>]*>(\d+)<\/text>/g)];
 assert.ok(digits.length>=2);assert.equal(digits[0][1],digits[1][1]);assert.ok(+digits[0][2]<+digits[1][2]);
});

test('recoloring part of a text keeps the color on both remaining sides',()=>{
 const first=setHighlight(source,{section:1},'text:Bara sista ordet:0','gul',{fran:0,till:16});
 const next=setHighlight(first,{section:1},'text:Bara sista ordet:0','rod',{fran:5,till:10});
 assert.deepEqual(readSong(next).delar[1].markeringar?.map(m=>[m.farg,m.fran,m.till]),[['gul',0,5],['gul',10,16],['rod',5,10]]);
});
