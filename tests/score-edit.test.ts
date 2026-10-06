import test from 'node:test';
import assert from 'node:assert/strict';
import {stringify} from 'yaml';
import {asBar,readSong,resolveSongMeters} from '../lib/song';
import {addVariant,clearHouse,copySection,deleteBars,deleteChord,duplicateBars,insertBar,insertChord,moveChord,moveSection,normalizeChordLine,patchBar,patchFormInstruction,patchSong,removeSection,removeVariant,reorderChord,reuseSection,setChordLine,setHouse,VariantChoiceError} from '../lib/score-edit';

const source=stringify({format:1,titel:'Bladtest',artist:'Artist',grundtonart:'C',taktart:'4/4',kallor:[{url:'https://example.com',beskrivning:'Behåll källan'}],anteckningar:['Orörd arbetsanteckning'],delar:[{namn:'Vers',takter:[{ackord:'C G',slag:[1,3.5],fermat:1,synkop:{typ:'offbeat',ackord:2},repris_start:true,varianter:[{gang:2,ackord:'F Am',slag:[1,2],ackord_nr:1,rytm:[{slag:1,notvarde:8,text:'Bas'}],stamma:'bas'}]},'D','Am','G']},{namn:'Coda',takter:['C']} ]})+'# behåll slutkommentaren\n';
const bar=(text:string,index=0)=>asBar(readSong(text).delar[0].takter[index]);

test('the whole-line writer accepts grouped parentheses and extended slash chords',()=>{assert.equal(normalizeChordLine('(D A) Fm(maj9)/Ab'),'(D) (A) Fm(maj9)/Ab');assert.throws(()=>normalizeChordLine('(D A'));assert.throws(()=>normalizeChordLine('C D E F G'));});
test('whole-line edits require an explicit variant decision and preserve unrelated source fields',()=>{assert.throws(()=>setChordLine(source,{section:0,bar:0},'D A'),VariantChoiceError);const next=setChordLine(source,{section:0,bar:0},'D A','keep');assert.deepEqual(bar(next).slag,[1,3.5]);assert.deepEqual(bar(next).varianter,bar(source).varianter);assert.ok(next.includes('# behåll slutkommentaren'));assert.deepEqual(readSong(next).kallor,readSong(source).kallor);assert.deepEqual(readSong(next).anteckningar,readSong(source).anteckningar);});
test('parentheses are a presentation edit and do not discard an owned variant',()=>{const next=setChordLine(source,{section:0,bar:0},'(C) G');assert.equal(bar(next).ackord,'(C) G');assert.deepEqual(bar(next).varianter,bar(source).varianter);});
test('variant text keeps its own manual timing, rhythm text and legacy voice',()=>{const next=setChordLine(source,{section:0,bar:0,variant:0},'Dm E');assert.deepEqual(bar(next).varianter?.[0].slag,[1,2]);assert.deepEqual(bar(next).varianter?.[0].rytm,bar(source).varianter?.[0].rytm);assert.equal(bar(next).varianter?.[0].stamma,'bas');assert.equal(bar(next).ackord,'C G');});
test('moving a base chord carries relative variant starts and attacks and refuses invalid spans',()=>{const next=moveChord(source,{section:0,bar:0},0,1.25);assert.deepEqual(bar(next).varianter?.[0].slag,[1.25,2.25]);assert.equal(bar(next).varianter?.[0].rytm?.[0].slag,1.25);assert.throws(()=>moveChord(source,{section:0,bar:0},0,3),/spann/);});
test('reordering chords keeps owned variants and index-bound signs attached to their chord',()=>{const next=reorderChord(source,{section:0,bar:0},1,-1);assert.equal(bar(next).ackord,'G C');assert.equal(bar(next).fermat,2);assert.equal(bar(next).synkop?.ackord,1);assert.equal(bar(next).varianter?.[0].ackord_nr,2);assert.deepEqual(bar(next).varianter?.[0].slag,[3.5,4.5]);});
test('changed chord counts remap metadata for surviving named chords',()=>{const initial=patchBar(source,{section:0,bar:1},{ackord:'C G A',slag:[1,2,3],fermat:3,synkop:{typ:'offbeat',ackord:3},varianter:[{gang:2,ackord:'Am',ackord_nr:3,slag:[3]}]});const next=setChordLine(initial,{section:0,bar:1},'C A','keep');assert.equal(bar(next,1).fermat,2);assert.equal(bar(next,1).synkop?.ackord,2);assert.equal(bar(next,1).varianter?.[0].ackord_nr,2);assert.deepEqual(bar(next,1).slag,[1,3]);});
test('empty rows remove invalid chord indexes but retain rhythm and form signs',()=>{const initial=patchBar(source,{section:0,bar:0},{synkop:undefined,rytm:[{slag:1,notvarde:4,text:'Behåll'}]});const next=setChordLine(initial,{section:0,bar:0},'','remove');assert.equal(bar(next).ackord,'');assert.equal(bar(next).slag,undefined);assert.equal(bar(next).fermat,undefined);assert.equal(bar(next).varianter,undefined);assert.deepEqual(bar(next).rytm,bar(initial).rytm);assert.equal(bar(next).repris_start,true);});
test('new variants can be empty while retaining an explicit chord owner',()=>{const next=addVariant(source,{section:0,bar:0},2);assert.equal(next.variant,1);assert.equal(bar(next.text).varianter?.[1].ackord_nr,2);assert.equal(bar(next.text).varianter?.[1].ackord,'');});
test('gapped duplication copies just the requested bars and strips copied repeat boundaries',()=>{const next=duplicateBars(source,0,[0,2]),bars=readSong(next).delar[0].takter;assert.equal(bars.length,6);assert.equal(asBar(bars[3]).ackord,'C G');assert.equal(asBar(bars[4]).ackord,'Am');assert.equal(asBar(bars[3]).repris_start,undefined);assert.deepEqual(asBar(bars[3]).varianter,bar(source).varianter);});
test('gapped deletion transfers repeat signs to the next surviving bar',()=>{const next=deleteBars(source,0,[0,2]),bars=readSong(next).delar[0].takter;assert.equal(bars.length,2);assert.deepEqual(bars.map(v=>asBar(v).ackord),['D','G']);assert.equal(asBar(bars[0]).repris_start,true);});
test('inserting a blank bar and a contiguous house preserves source comments',()=>{const next=setHouse(insertBar(source,0,1),0,[1,2],'1, 2');assert.equal(bar(next,2).ackord,'');assert.equal(bar(next,1).hus,'1, 2.');assert.equal(bar(next,2).hus_slut,true);assert.ok(next.includes('# behåll slutkommentaren'));assert.throws(()=>setHouse(source,0,[0,2],'1'),/sammanhängande/);});
test('reuse can precede its definition and detached copies retain their count and music',()=>{const reused=reuseSection(source,0),moved=moveSection(reused,2,-1),first=moveSection(moved,1,-1);assert.equal(readSong(first).delar[0].ateranvand,'Vers');const counted=first.replace('ganger: 1','ganger: 3'),detached=copySection(counted,0,false,true),part=readSong(detached).delar[0];assert.equal(part.ateranvand,undefined);assert.equal(part.ganger,3);assert.equal(asBar(part.takter[0]).ackord,'C G');assert.equal(resolveSongMeters(readSong(detached)).bars[0][0],'4/4');});
test('removing the last section leaves a valid empty score with a path to add new music',()=>{const single=stringify({...readSong(source),delar:[readSong(source).delar[0]]}),empty=removeSection(single,0);assert.deepEqual(readSong(empty).delar,[]);const next=copySection(empty,0,true);assert.equal(readSong(next).delar[0].takter.length,4);assert.ok(readSong(next).delar[0].takter.every(b=>asBar(b).ackord===''));});
test('keep never silently drops a variant whose owner was removed',()=>{const initial=patchBar(source,{section:0,bar:1},{ackord:'C G',varianter:[{gang:2,ackord:'G Am',ackord_nr:2,slag:[3,4]}]});assert.throws(()=>setChordLine(initial,{section:0,bar:1},'C','keep'),/borttaget grundackord/);assert.equal(bar(initial,1).varianter?.[0].ackord,'G Am');});
test('deleting a chord preserves other timings and removes only its owned rows',()=>{const next=deleteChord(source,{section:0,bar:0},0);assert.equal(bar(next).ackord,'G');assert.deepEqual(bar(next).slag,[3.5]);assert.equal(bar(next).synkop?.ackord,1);assert.equal(bar(next).varianter,undefined);assert.equal(bar(next).fermat,undefined);});
test('deleting house endpoints shrinks a house to its surviving bars',()=>{const initial=setHouse(source,0,[0,1,2],'1'),next=deleteBars(initial,0,[0,2]);assert.equal(bar(next).ackord,'D');assert.equal(bar(next).hus,'1.');assert.equal(bar(next).hus_slut,true);assert.equal(bar(next,1).hus_slut,undefined);});
test('house removal from a middle bar clears the full existing span',()=>{const initial=setHouse(source,0,[0,1,2],'1'),next=clearHouse(initial,0,[1]);assert.ok(readSong(next).delar[0].takter.every(raw=>!asBar(raw).hus&&!asBar(raw).hus_slut));});
test('legacy form editing keeps the chosen definition and its original meter',()=>{const initial=stringify({format:1,titel:'Legacy',artist:'',grundtonart:'C',taktart:'4/4',delar:[{namn:'A',takter:[{ackord:'C G',slag:[1,4]}]},{namn:'B',takter:[{ackord:'D',taktart:'3/4'}]}],spelordning:[{del:'B'},{del:'A'}]}),next=reuseSection(initial,0),song=readSong(next);assert.equal(song.delar.at(-1)?.ateranvand,'A');const a=song.delar.findIndex(p=>p.namn==='A');assert.equal(resolveSongMeters(song).bars[a][0],'4/4');assert.deepEqual(asBar(song.delar[a].takter[0]).slag,[1,4]);});
test('blank artist is valid, blank title is rejected and unchanged fields keep exact source text',()=>{assert.equal(readSong(patchSong(source,{artist:''})).artist,'');assert.throws(()=>patchSong(source,{titel:''}),/Ge låten en titel/);assert.equal(patchSong(source,{titel:'Bladtest'}),source);assert.equal(patchBar(source,{section:0,bar:0},{fermat:1}),source);});
test('recent chords use a free grid slot without moving existing starts or signs',()=>{const initial=patchBar(source,{section:0,bar:1},{ackord:'C G7',slag:[1,4],fermat:2,synkop:{typ:'offbeat',ackord:2}}),next=insertChord(initial,{section:0,bar:1},0,'Am',4);assert.equal(next.chord,1);assert.equal(next.start,2);assert.equal(bar(next.text,1).ackord,'C Am G7');assert.deepEqual(bar(next.text,1).slag,[1,2,4]);assert.equal(bar(next.text,1).fermat,3);assert.equal(bar(next.text,1).synkop?.ackord,3);});
test('adding a chord preserves implicit variant timing and refuses filled intervals',()=>{const initial=patchBar(source,{section:0,bar:1},{ackord:'C',varianter:[{gang:2,ackord:'F Am',ackord_nr:1}]}),next=insertChord(initial,{section:0,bar:1},0,'G',4);assert.equal(next.start,4);assert.deepEqual(bar(next.text,1).varianter?.[0].slag,[1,3]);const filled=patchBar(source,{section:0,bar:1},{ackord:'C D E F',slag:[1,2,3,4]});assert.throws(()=>insertChord(filled,{section:0,bar:1},0,'Am'),/Högst fyra/);});
test('timing and variant mutations retain nested YAML comments, including surviving rows',()=>{const initial=`format: 1
titel: Kommentarer
artist: ''
grundtonart: C
taktart: 4/4
delar:
  - namn: A
    takter:
      - ackord: C G
        slag: [1, 3]
        varianter:
          - gang: 2 # omgången
            ackord_nr: 1
            ackord: F Am # alternativharmonik
            slag: [1, 2] # flytta tillsammans
            rytm:
              - slag: 1 # attackkommentar
                notvarde: 8
                text: Bas # nottextkommentar
          - gang: 3 # kvarvarandeomgång
            ackord_nr: 2
            ackord: G7 # kvarvaranderad
`;const moved=moveChord(initial,{section:0,bar:0},0,1.25);for(const comment of ['omgången','alternativharmonik','flytta tillsammans','attackkommentar','nottextkommentar','kvarvarandeomgång','kvarvaranderad'])assert.ok(moved.includes('# '+comment),comment);const removed=removeVariant(moved,{section:0,bar:0,variant:0});assert.ok(removed.includes('# kvarvarandeomgång'));assert.ok(removed.includes('# kvarvaranderad'));assert.equal(bar(removed).varianter?.[0].gang,3);});

test('legacy form instruction changes only its occurrence while preserving source comments',()=>{
  const text=stringify({format:1,titel:'Formtest',artist:'Test',grundtonart:'C',taktart:'4/4',delar:[{namn:'Vers',anvisning:'Original',takter:['C']}],spelordning:[{del:'Vers',ganger:1},{del:'Vers',ganger:2,anvisning:'Solo'}]}).replace('anvisning: Solo','anvisning: Solo # återkomstkommentar');
  const updated=patchFormInstruction(text,1,'  Utan bas  '),song=readSong(updated);
  assert.equal(song.delar[0].anvisning,'Original');assert.equal(song.spelordning![0].anvisning,undefined);assert.equal(song.spelordning![1].anvisning,'Utan bas');assert.ok(updated.includes('# återkomstkommentar'));
  assert.equal(readSong(patchFormInstruction(updated,1,'  ')).spelordning![1].anvisning,undefined);assert.throws(()=>patchFormInstruction(text,4,'Fel'),/finns inte/);
});
