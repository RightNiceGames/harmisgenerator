import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { renderChart, PAGE_HEIGHT, PAGE_WIDTH } from '../lib/render';
import { readSong } from '../lib/song';
const reference=readSong(await readFile('songs/flykten-fran-vardagen.yaml','utf8'));
test('reference remains one A4 with all printed bars and original chord size',async()=>{
  const svg=await renderChart(reference);
  assert.equal(svg.pages?.length,1);
  assert.ok(svg.pages![0].includes('font-size="23"'));
  assert.ok(svg.pages![0].includes('>57</text>'));
  assert.ok(svg.pages![0].includes('>22</text>'));
  assert.ok(svg.pages![0].includes('>BREAK</text>'));
  const result=await renderChart(reference,'pdf');
  const pdf=await PDFDocument.load(result.pdf!);
  assert.equal(pdf.getPageCount(),1);
  assert.equal(pdf.getPage(0).getWidth(),PAGE_WIDTH);
  assert.equal(pdf.getPage(0).getHeight(),PAGE_HEIGHT);
});
test('long charts page break without shrinking chords or losing bars',async()=>{
  const song=structuredClone(reference);
  song.delar=[{namn:'Lång del',takter:Array.from({length:120},()=> 'C')}];
  const result=await renderChart(song);
  assert.ok(result.pages!.length>=2);
  const all=result.pages!.join('');
  for(let number=1;number<=120;number++)assert.ok(all.includes(`>${number}</text>`),String(number));
  for(const page of result.pages!)assert.ok(page.includes('font-size="23"'));
});
test('explicit page breaks and unsafe title text are rendered safely',async()=>{
  const song=structuredClone(reference);song.titel='<script>alert(1)</script>';
  song.delar=[{namn:'A',takter:['C']},{namn:'B',sidbrytning:true,takter:['F']}];
  const result=await renderChart(song);
  assert.equal(result.pages!.length,2);
  assert.ok(!result.pages!.join('').includes('<script>'));
});
