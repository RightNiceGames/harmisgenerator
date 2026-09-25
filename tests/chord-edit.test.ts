import test from 'node:test';
import assert from 'node:assert/strict';
import { readSong, asBar } from '../lib/song';
import { replaceExistingChord } from '../lib/edit';
import { renderChart } from '../lib/render';
const text=`format: 1
titel: Test
artist: Test
grundtonart: C
taktart: 4/4
delar:
  - namn: Vers
    takter:
      - C G7 # behåll
      - ackord: C G7
        slag: [1, 4]
        rytm: [{slag: 1, notvarde: 8}]
        varianter:
          - gang: 2
            ackord: C/E F
            stamma: bas
`;
test('preview edit changes exactly one existing token, preserving comments and music fields',()=>{
 const changed=replaceExistingChord(text,{section:0,bar:1,chord:1},'Bb7/D');
 const before=readSong(text), after=readSong(changed);
 assert.deepEqual(asBar(after.delar[0].takter[1]),{...asBar(before.delar[0].takter[1]),ackord:'C Bb7/D'});
 assert.equal(after.delar[0].takter[0],before.delar[0].takter[0]);assert.ok(changed.includes('# behåll'));
 const variant=readSong(replaceExistingChord(text,{section:0,bar:1,chord:0,variant:0},'Eb11'));
 assert.equal(asBar(variant.delar[0].takter[1]).varianter![0].ackord,'Eb11 F');
 const percent=readSong(replaceExistingChord(text,{section:0,bar:0,chord:0},'%'));
 assert.equal(percent.delar[0].takter[0],'% G7');
});
test('preview edit rejects extra chords, invalid chords and missing targets',()=>{
 for (const chord of ['C G7','','H7']) assert.throws(()=>replaceExistingChord(text,{section:0,bar:0,chord:0},chord));
 for (const target of [{section:0,bar:0,chord:2},{section:4,bar:0,chord:0},{section:0,bar:1,chord:0,variant:3},{section:0,bar:-1,chord:0}]) assert.throws(()=>replaceExistingChord(text,target,'C'));
});
test('SVG includes one accessible target per existing chord with correct source indexes',async()=>{
 const svg=(await renderChart(readSong(text))).pages![0];
 assert.equal((svg.match(/class="chord-hit"/g)||[]).length,6);
 assert.ok(svg.includes('data-section="0" data-bar="1" data-chord="1" data-variant="0"'));
 assert.ok(svg.includes('aria-label="Ändra G7, Vers, takt 2"'));
 assert.ok((await renderChart(readSong(text),'pdf')).pdf!.length>1000);
});
