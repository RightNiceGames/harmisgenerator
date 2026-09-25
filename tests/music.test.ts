import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { asBar, parseChord, readSong, SongError, transposeChord, transposeText } from '../lib/song';
import { insertFeature } from '../lib/edit';
import { listSongs, loadSong } from '../lib/storage';
const reference = await readFile('songs/flykten-fran-vardagen.yaml','utf8');

test('extensions containing slash are not mistaken for bass notes',()=>{
  assert.deepEqual(parseChord('Abm6/9/Gb'),{root:'Ab',extension:'m6/9',bass:'Gb'});
  assert.equal(transposeChord('Abm6/9/Gb',-1,'#'),'Gm6/9/F');
  assert.equal(transposeChord('Eb7#9#5',-1,'b'),'D7#9#5');
  assert.equal(transposeChord('Fm(maj9)',2,'b'),'Gm(maj9)');
  assert.equal(transposeChord('Fø7',1,'#'),'F#ø7');
  assert.equal(transposeChord('N.C.',5,'#'),'N.C.');
  assert.throws(()=>parseChord('H7'));
});
test('transposition preserves form, comments and source prose',()=>{
  const before=readSong(reference),afterText=transposeText(reference,'Gm','#'),after=readSong(afterText);
  assert.equal(after.grundtonart,'Gm');
  assert.equal(asBar(after.delar[0].takter[0]).ackord,'Gm6 Gm6/F');
  assert.deepEqual(after.anteckningar,before.anteckningar);
  assert.ok(afterText.includes('# Harmis format 1.'));
  before.delar.forEach((section,si)=>section.takter.forEach((raw,bi)=>{
    const {ackord:_,...rest}=asBar(raw),{ackord:__,...restAfter}=asBar(after.delar[si].takter[bi]);
    assert.deepEqual(restAfter,rest);
  }));
  assert.throws(()=>transposeText(reference,'G','#'),/dur eller moll/);
});
test('all twelve transpositions round trip to the same sounding pitches',()=>{
  const chords=['Abm6/Gb','F6/9','B7alt','C#ø7','Eb7b9#5','G°7'];
  for(let shift=0;shift<12;shift++)for(const chord of chords)assert.equal(transposeChord(transposeChord(chord,shift,'#'),-shift,'b'),transposeChord(chord,0,'b'));
});
test('parser reports the musical error line and rejects unknown schema fields',()=>{
  const wrong=reference.replace('Abm6 Abm6/Gb','H7');
  assert.throws(()=>readSong(wrong),(e:unknown)=>e instanceof SongError && e.line>10 && /H7/.test(e.message));
  assert.throws(()=>readSong(reference+'typo: true\n'),/Unrecognized key/);
  assert.throws(()=>readSong(reference.replace('fermat: 1','fermat: 9')+'titel: Dublett\n'),/unique|unique keys/i);
});
test('all musical buttons generate valid YAML at the selected bar',()=>{
  const actions=['takt','del','repris_start','repris_slut','hus1','hus2','hus_slut','foruttag','offbeat','fermat','break','coda','coda_hopp','segno','anvisning','slut','radbrytning','sidbrytning','nummer','taktart','tonart'] as const;
  for(const action of actions){
    const result=insertFeature(reference,reference.indexOf('Abm6 Abm6/Gb'),action);
    assert.doesNotThrow(()=>readSong(result.text),action);
    assert.ok(result.cursor>0,action);
  }
});
test('the library contains all fourteen readable song files',async()=>{
  const songs=await listSongs();assert.equal(songs.length,14);
  for(const entry of songs){assert.equal(entry.error,undefined,entry.id);readSong((await loadSong(entry.id)).text);}
});
