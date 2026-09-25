import test from 'node:test';
import assert from 'node:assert/strict';
import { stringify } from 'yaml';
import { readSong } from '../lib/song';
import { renameSection } from '../lib/edit';
import { renderChart } from '../lib/render';
const text=stringify({format:1,titel:'Test',artist:'Test',grundtonart:'C',taktart:'4/4',delar:[{namn:'Vers',takter:['C']},{namn:'Refräng',takter:['F','G7']}],spelordning:[{del:'Vers'},{del:'Refräng'},{del:'Refräng',ganger:2,visa_block:true}]})+'# behåll\n';
test('rename updates all references, preserving chords, repeat counts and comments',()=>{
 const result=renameSection(text,1,'Sista refrängen');const song=readSong(result);
 assert.equal(song.delar[1].namn,'Sista refrängen');assert.deepEqual(song.delar[1].takter,['F','G7']);
 assert.deepEqual(song.spelordning?.map(step=>step.del),['Vers','Sista refrängen','Sista refrängen']);
 assert.equal(song.spelordning?.at(-1)?.ganger,2);assert.equal(song.spelordning?.at(-1)?.visa_block,true);assert.ok(result.includes('# behåll'));
 for(const name of ['','Vers','a'.repeat(81),'A\nB'])assert.throws(()=>renameSection(text,1,name));
 assert.throws(()=>renameSection(text,9,'Ny'));
});
test('reuse block refers to existing bars and has a clickable section name',async()=>{
 const svg=(await renderChart(readSong(text))).pages!.join('');
 assert.ok(svg.includes('ÅTERANVÄND DEL · AVSLUTNING'));assert.ok(svg.includes('Refräng × 2'));
 assert.ok(svg.includes('takt 2–3. Spela 2 gånger, sedan SLUT.'));assert.ok(!svg.includes('>4</text>'));
 assert.equal((svg.match(/class="section-hit"/g)||[]).length,3);
 const song=readSong(text);song.delar[0].takter=Array.from({length:55},()=> 'C');
 const result=await renderChart(song);assert.ok(result.pages!.length>1);
 for(const page of result.pages!)for(const m of page.matchAll(/<text x="[\d.]+" y="([\d.]+)"/g))assert.ok(Number(m[1])<830);
 assert.ok((await renderChart(song,'pdf')).pdf!.length>1000);
});

test('all remaining reused sections get blocks in performance order by default',async()=>{
 const song=readSong(text);
 song.spelordning=[{del:'Vers',ganger:1},{del:'Refräng',ganger:1},{del:'Vers',ganger:1},{del:'Refräng',ganger:2}];
 const svg=(await renderChart(song)).pages!.join('');
 assert.ok(svg.includes('Se Vers, takt 1–1. Spela 1 gång.'));
 assert.ok(svg.indexOf('Se Vers, takt')<svg.indexOf('Se Refräng, takt'));
 assert.equal((svg.match(/ÅTERANVÄND DEL/g)||[]).length,2);
 song.spelordning[2].visa_block=false;
 assert.ok(!(await renderChart(song)).pages!.join('').includes('Se Vers, takt'));
});
test('instructions belong to the specific return and survive renaming and pagination',async()=>{
 const song=readSong(text);
 song.spelordning![2].anvisning='Instrumentalt (solo). Utan bas till takt 8 i versen. Bas in på II–V–I.';
 const changed=readSong(renameSection(stringify(song),1,'Ref'));
 assert.equal(changed.spelordning![1].anvisning,undefined);
 assert.equal(changed.spelordning![2].anvisning,song.spelordning![2].anvisning);
 assert.equal(changed.delar[1].anvisning,undefined);
 const svg=(await renderChart(changed)).pages!.join('');
 assert.ok(svg.includes('Instrumentalt (solo).'));assert.ok(svg.includes('II–V–I.'));
 changed.spelordning=Array.from({length:20},()=>({del:'Ref',ganger:1,visa_block:true,anvisning:'En lång anvisning om instrumentalt solo och basens insats. '.repeat(3)}));
 const pages=(await renderChart(changed)).pages!;assert.ok(pages.length>1);
 for(const page of pages)for(const m of page.matchAll(/<text x="[\d.]+" y="([\d.]+)"/g))assert.ok(Number(m[1])<830);
});
