import test from 'node:test';
import assert from 'node:assert/strict';
import {stringify} from 'yaml';
import {readSong,transposeText,asBar} from '../lib/song';
import {insertReuse,insertFeature,renameSection,inlineLegacyForm,selectedBar} from '../lib/edit';
import {renderChart} from '../lib/render';
const base=stringify({format:1,titel:'Test',artist:'Test',grundtonart:'C',taktart:'4/4',delar:[{namn:'Vers',takter:['C G7']},{namn:'Brygga',takter:['F']}]})+'# behåll\n';
test('reuse appears between written parts; new music may follow without a playlist',async()=>{
 const text=insertReuse(base,'Vers',2,'Utan bas.',0),song=readSong(text);
 assert.doesNotThrow(()=>readSong(stringify(song)));
 assert.equal(song.spelordning,undefined);assert.deepEqual(song.delar.map(p=>p.ateranvand||p.namn),['Vers','Vers','Brygga']);
 const svg=(await renderChart(song)).pages!.join('');
 assert.ok(svg.indexOf('ÅTERANVÄND DEL')<svg.indexOf('>Brygga</text>'));assert.ok(!svg.includes('sedan SLUT'));
 assert.ok(svg.includes('>2</text>'));assert.ok(svg.includes('data-section="2" data-bar="0"'));
 const renamed=renameSection(text,0,'A');assert.equal(readSong(renamed).delar[1].ateranvand,'A');assert.ok(renamed.includes('# behåll'));
 const shifted=readSong(transposeText(renamed,'D','#'));assert.equal(shifted.delar[1].ateranvand,'A');assert.equal(shifted.delar[0].takter[0],'D A7');
 const cursor=text.indexOf('ateranvand:');assert.equal(selectedBar(text,cursor),undefined);
 const added=readSong(insertFeature(text,cursor,'del').text);assert.deepEqual(added.delar.map(p=>p.ateranvand||p.namn),['Vers','Vers','Ny del','Brygga']);
});
test('references must point backward to a unique written section',()=>{
 assert.throws(()=>insertReuse(base,'Brygga',1,'',0),/tidigare|före/);
 assert.throws(()=>readSong(base.replace('namn: Vers\n    takter:\n      - C G7','ateranvand: Brygga')),/tidigare/);
 const valid=insertReuse(base,'Vers',1);
 assert.throws(()=>readSong(valid.replace('ateranvand: Vers','ateranvand: Saknas')),/tidigare/);
 assert.throws(()=>readSong(valid.replace('namn: Brygga','namn: Vers')),/unika/);
 assert.throws(()=>readSong(valid.replace('ateranvand: Vers','ateranvand: Vers\n    takter: [C]')),/bara/);
 assert.throws(()=>insertReuse(base,'Vers',0));
});
test('legacy conversion preserves source chords and instructions without copying returns',()=>{
 const original=base+'spelordning:\n  - del: Vers\n  - del: Brygga\n  - del: Vers\n    ganger: 2\n    anvisning: Solo\n';
 const converted=inlineLegacyForm(original),song=readSong(converted);
 assert.equal(song.spelordning,undefined);assert.equal(song.delar[2].ateranvand,'Vers');assert.equal(song.delar[2].ganger,2);assert.equal(song.delar[2].anvisning,'Solo');assert.ok(converted.includes('# behåll'));
});
test('meter after reuse follows the referenced section',()=>{
 const text=stringify({format:1,titel:'Meter',artist:'Test',grundtonart:'C',taktart:'4/4',delar:[{namn:'A',takter:[{ackord:'C',taktart:'3/4'}]},{namn:'B',takter:[{ackord:'F',taktart:'4/4'}]},{ateranvand:'A'},{namn:'Coda',takter:[{ackord:'C G',slag:[1,3]}]}]});
 assert.doesNotThrow(()=>readSong(text));assert.throws(()=>readSong(text.replace('- 3\n','- 4\n')));
 const result=insertFeature(text,text.lastIndexOf('ackord: C G'),'slag');assert.deepEqual(asBar(readSong(result.text).delar[3].takter[0]).slag,[1,3]);
});
