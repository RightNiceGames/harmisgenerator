import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {stringify} from 'yaml';
import {PDFDocument} from 'pdf-lib';
import {asBar, readSong, resolveSongMeters, transposeText} from '../lib/song';
import {PAGE_WIDTH, renderChart} from '../lib/render';

const source = (parts: unknown[] = [{namn:'Vers',takter:['C G7']}], meter='4/4') => stringify({format:1,titel:'Blad',artist:'Test',grundtonart:'C',taktart:meter,delar:parts});
const rects = (svg: string, kind: string) => [...svg.matchAll(new RegExp(`<rect class="${kind}" [^>]+>`,'g'))].map(match=>Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]])));

test('empty scores and empty chord fields round trip and render as SVG and PDF',async()=>{
 for(const parts of [[],[{namn:'Tom del',takter:['',{ackord:'',rytm:[{slag:1,notvarde:4}]}]}]]){
  const song=readSong(source(parts));
  assert.deepEqual(readSong(transposeText(source(parts),'D','#')).delar,song.delar);
  const svg=(await renderChart(song)).pages!;
  assert.ok(svg[0].includes('>Blad</text>'));
  assert.ok(!svg.join('').includes('NaN'));
  assert.equal(rects(svg.join(''),'chord-hit').length,0);
  const pdf=await PDFDocument.load((await renderChart(song,'pdf')).pdf!);
  assert.equal(pdf.getPageCount(),1);
 }
});

test('written parts retain multiple plays without writing duplicate bars',async()=>{
 const song=readSong(source([{namn:'Egen refräng',ganger:2,takter:['C','G7']}]));
 const svg=(await renderChart(song)).pages!.join('');
 assert.ok(svg.includes('Egen refräng × 2'));
 assert.equal(rects(svg,'chord-hit').length,2);
 assert.ok(!svg.includes('>3</text>'));
});

test('forward reuse resolves original bar ranges and definition ending meter',async()=>{
 const text=source([{ateranvand:'A',ganger:2,anvisning:'Utan bas'},{namn:'B',takter:[{ackord:'F',slag:[1,6.5]}]},{namn:'A',takter:[{ackord:'C',taktart:'6/8'}]}]);
 assert.throws(()=>readSong(text),/slag för varje ackord/);
 const song=readSong(text.replace('ackord: F','ackord: F G'));
 assert.equal(resolveSongMeters(song).bars[1][0],'6/8');
 const svg=(await renderChart(song,'svg',{editable:true})).pages!.join('');
 assert.ok(svg.includes('Se A, takt 2–2. Spela 2 gånger.'));
 assert.equal(rects(svg,'reuse-hit')[0]['data-section'],'0');
 assert.equal(rects(svg,'bar-hit')[0]['data-meter'],'6/8');
 assert.throws(()=>readSong(source([{ateranvand:'Saknas'},{namn:'A',takter:['C']} ])),/finns inte/);
 assert.throws(()=>readSong(source([{ateranvand:'A'},{namn:'A',takter:['C']},{namn:'A',takter:['G']} ])),/unika/);
});

test('legacy meter inheritance after backward reuse remains unchanged',()=>{
 const song=readSong(source([{namn:'A',takter:[{ackord:'C',taktart:'3/4'}]},{namn:'B',takter:[{ackord:'F',taktart:'4/4'}]},{ateranvand:'A'},{namn:'C',takter:[{ackord:'C G',slag:[1,3]}]},{ateranvand:'C'},{namn:'D',takter:['G']} ]));
 assert.equal(resolveSongMeters(song).bars[3][0],'3/4');
 assert.equal(resolveSongMeters(song).bars[5][0],'3/4');
});

test('owned variants validate chord starts and rhythm in their base chord interval',()=>{
 const bar={ackord:'C G',slag:[2,4],varianter:[{gang:2,ackord_nr:1,ackord:'Dm F',slag:[2.5,3.5],rytm:[{slag:2.5,notvarde:8,text:'Bas'}]},{gang:2,ackord_nr:2,ackord:'G7',slag:[4],rytm:[{slag:4.5,notvarde:8}]}]};
 assert.doesNotThrow(()=>readSong(source([{namn:'A',takter:[bar]}])));
 for(const variant of [
  {...bar.varianter[0],ackord_nr:3},
  {...bar.varianter[0],slag:[1,3]},
  {...bar.varianter[0],slag:[2,4]},
  {...bar.varianter[0],rytm:[{slag:3.75,notvarde:8}]},
  {...bar.varianter[0],rytm:[{slag:2,notvarde:4},{slag:2.5,notvarde:8}]},
 ])assert.throws(()=>readSong(source([{namn:'A',takter:[{...bar,varianter:[variant]}]}])));
 const shifted=asBar(readSong(transposeText(source([{namn:'A',takter:[bar]}]),'D','#')).delar[0].takter[0]);
 assert.equal(shifted.varianter![0].ackord,'Em G');
 assert.deepEqual(shifted.varianter![0].rytm,bar.varianter[0].rytm);
 assert.doesNotThrow(()=>readSong(source([{namn:'A',takter:[{ackord:'C G',slag:[2,4],varianter:[{gang:2,ackord:'F',slag:[1],rytm:[{slag:1,notvarde:4}]}]}]}])));
});

test('editable targets distinguish number strips, main area and full variant stack',async()=>{
 const song=readSong(source([{namn:'A',takter:[{ackord:'C G',rytm:[{slag:1,notvarde:8,text:'Anslag'}],varianter:[{gang:2,ackord_nr:2,ackord:'G7',rytm:[{slag:3,notvarde:8,text:'Bas'}]},{gang:3,och_foljande:true,ackord:'F G'}]},'']} ]));
 const svg=(await renderChart(song,'svg',{editable:true})).pages!.join('');
 const bars=rects(svg,'bar-hit'),numbers=rects(svg,'bar-number-hit'),areas=rects(svg,'chord-area-hit'),variants=rects(svg,'variant-area-hit');
 assert.equal(bars.length,2);assert.equal(numbers.length,2);assert.equal(areas.length,2);assert.equal(variants.length,2);
 assert.equal(numbers[0].height,'24');
 assert.equal(Number(numbers[0].y)-Number(bars[0].y),56);
 assert.equal(bars[0]['data-number'],'1');assert.equal(bars[0]['data-section'],'0');assert.equal(bars[0]['data-bar'],'0');
 assert.ok(Number(numbers[0].y)+Number(numbers[0].height)<=Number(areas[0].y));
 for(const variant of variants){
  assert.ok(Number(variant.y)>Number(areas[0].y)+Number(areas[0].height));
  assert.ok(Number(variant.y)+Number(variant.height)<=Number(bars[0].y)+Number(bars[0].height)-48);
 }
 assert.equal(variants[1]['data-variant'],'1');
 assert.equal(areas[0].height,'60');assert.equal(variants[0].height,'60');
 const annotationY=(label:string)=>Number([...svg.matchAll(/<text[^>]* y="([\d.]+)"[^>]*>(.*?)<\/text>/g)].find(m=>m[2]===label)?.[1]);
 assert.ok(annotationY('Anslag')<Number(areas[0].y));
 assert.ok(annotationY('Bas')<Number(variants[0].y));
 assert.ok(svg.includes('>3:e+</text>'));
 assert.ok(svg.indexOf('class="bar-hit"')<svg.indexOf('class="chord-area-hit"'));
 assert.ok(svg.indexOf('class="chord-area-hit"')<svg.indexOf('class="chord-hit"'));
 const rootHits=rects(svg,'chord-hit').filter(r=>r['data-variant']===undefined);
 assert.ok(Number(rootHits[1].x)-Number(rootHits[0].x)>Number(bars[0].width)*.4);
});

test('owned variant rhythm and empty chord variants also render in ordinary export',async()=>{
 const song=readSong(source([{namn:'A',takter:[{ackord:'C G',slag:[1,3],varianter:[{gang:2,ackord_nr:2,ackord:'',rytm:[{slag:3,notvarde:8,text:'Kort'}]},{gang:3,ackord_nr:1,ackord:'Dm',slag:[1]}]}]}]));
 const plain=(await renderChart(song)).pages!.join('');
 assert.ok(plain.includes('>Kort</text>'));
 assert.ok(plain.includes('<ellipse'));
 assert.equal(rects(plain,'variant-area-hit').length,0);
 assert.ok((await renderChart(song,'pdf')).pdf!.length>1000);
});

test('editable owned variants enlarge their own time interval and display owner and actual beats',async()=>{
 const song=readSong(source([{namn:'A',takter:[{ackord:'C D E F',varianter:[{gang:2,ackord_nr:3,ackord:'G Am',slag:[3,3.5],rytm:[{slag:3.5,notvarde:8,text:'Kort'}]}]}]}]));
 const editor=(await renderChart(song,'svg',{editable:true})).pages!.join('');
 const printed=(await renderChart(song)).pages!.join('');
 const body=rects(editor,'bar-hit')[0],variant=rects(editor,'variant-area-hit')[0];
 assert.ok(Math.abs(Number(variant.width)-(Number(body.width)-8))<.001);
 assert.ok(editor.includes('>2:a · E</text>'));
 assert.ok(editor.includes('>3.5</text>'));
 const ownHits=(svg:string)=>rects(svg,'chord-hit').filter(r=>r['data-variant']==='0');
 const editHits=ownHits(editor),printHits=ownHits(printed);
 const distance=(hits:ReturnType<typeof rects>)=>Number(hits[1].x)-Number(hits[0].x);
 assert.ok(distance(editHits)>distance(printHits)*3.9);
 assert.ok(distance(editHits)>Number(body.width)*.4);
 assert.ok(!printed.includes('>2:a · E</text>'));
 assert.deepEqual(asBar(song.delar[0].takter[0]).varianter![0].slag,[3,3.5]);
});

test('mobile editor fonts and variant fields remain readable without changing export sizes',async()=>{
 const song=readSong(source([{namn:'A',takter:[{ackord:'C D E F',varianter:[{gang:2,ackord_nr:3,ackord:'G Am',slag:[3,3.5]}]}]}]));
 const mobile=(await renderChart(song,'svg',{editable:true,columns:2})).pages!.join('');
 const desktop=(await renderChart(song,'svg',{editable:true,columns:4})).pages!.join('');
 const printed=(await renderChart(song)).pages!.join('');
 const text=(svg:string,label:string)=>{
  const match=[...svg.matchAll(/<text[^>]* y="([\d.]+)"[^>]* font-size="([\d.]+)"[^>]*>(.*?)<\/text>/g)].find(m=>m[3]===label)!;
  return {y:Number(match[1]),size:Number(match[2])};
 };
 assert.equal(text(mobile,'Blad').size,30);
 assert.equal(text(mobile,'Test').size,16);
 assert.equal(text(mobile,'A').size,17);
 assert.equal(text(mobile,'2:a · E').size,16);
 assert.ok(text(mobile,'C').size>=27);
 assert.equal(text(mobile,'G').size,text(mobile,'C').size);
 assert.equal(text(desktop,'G').size,23);
 assert.ok(text(printed,'G').size<=16.1);
 assert.ok(text(mobile,'2:a · E').y-text(mobile,'2:a · E').size-text(mobile,'C').y>=18);
 for(const svg of [mobile,desktop]){
  const area=rects(svg,'variant-area-hit')[0];
  assert.ok(Number(area.height)>=60);
  for(const hit of rects(svg,'chord-hit').filter(h=>h['data-variant']==='0')){
   assert.ok(Number(hit.y)>=Number(area.y));
   assert.ok(Number(hit.y)+Number(hit.height)<=Number(area.y)+Number(area.height));
  }
 }
});

test('editable rhythm uses readable stems and beams within simple and compound beat groups',async()=>{
 const lines=(svg:string)=>[...svg.matchAll(/<line [^>]+>/g)].map(m=>Object.fromEntries([...m[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]])));
 for(const [meter,starts] of [['4/4',[1,1.5,2,2.5]],['6/8',[1,2,3,4,5,6]]] as const){
  const song=readSong(source([{namn:'A',takter:[{ackord:'C',rytm:starts.map(slag=>({slag,notvarde:8}))}]}],meter));
  const editor=(await renderChart(song,'svg',{editable:true,columns:2})).pages!.join('');
  const printed=(await renderChart(song)).pages!.join('');
  const editorLines=lines(editor);
  assert.equal(editorLines.filter(l=>l['stroke-width']==='2.4').length,2,meter);
  assert.equal(editorLines.filter(l=>l['stroke-width']==='1.1' && Number(l.y1)-Number(l.y2)===22).length,starts.length,meter);
  assert.equal(lines(printed).filter(l=>l['stroke-width']==='2.4').length,0,meter);
  const area=rects(editor,'chord-area-hit')[0];
  for(const stem of editorLines.filter(l=>l['stroke-width']==='1.1'))assert.ok(Number(stem.y1)<Number(area.y));
 }
 const song=readSong(source([{namn:'A',takter:[{ackord:'C G',varianter:[{gang:2,ackord_nr:1,ackord:'C',rytm:[{slag:1,notvarde:16},{slag:1.25,notvarde:16},{slag:1.5,notvarde:16},{slag:1.75,notvarde:16,text:'Kort'}]}]}]}]));
 const svg=(await renderChart(song,'svg',{editable:true,columns:2})).pages!.join('');
 assert.equal(lines(svg).filter(l=>l['stroke-width']==='2.4').length,4);
 assert.equal(lines(svg).filter(l=>l['stroke-width']==='1.1').length,4);
 const area=rects(svg,'variant-area-hit')[0];
 assert.ok(lines(svg).filter(l=>l['stroke-width']==='1.1').every(l=>Number(l.y1)<Number(area.y)));
});

test('two-column edit layout does not alter printed column settings or plain export',async()=>{
 const song=readSong(source([{namn:'A',takter:[{ackord:'C',kolumn:3},'D','E','F']} ]));
 const original=JSON.stringify(song);
 const svg=(await renderChart(song,'svg',{editable:true,columns:2})).pages!.join('');
 const hits=rects(svg,'bar-hit');
 assert.equal(hits.length,4);
 assert.ok(hits.every(h=>Number(h.x)+Number(h.width)<=PAGE_WIDTH-31+.001));
 assert.ok(Math.abs(Number(hits[0].width)-(PAGE_WIDTH-62)/2)<.001);
 assert.equal(rects(svg,'bar-number-hit')[0].height,'24');
 assert.equal(Number(rects(svg,'bar-number-hit')[0].y)-Number(hits[0].y),206);
 const lastArea=rects(svg,'chord-area-hit').at(-1)!;
 assert.ok(Number(hits.at(-1)!.y)+Number(hits.at(-1)!.height)-Number(lastArea.y)-Number(lastArea.height)>=115);
 assert.equal(JSON.stringify(song),original);
 const plain=(await renderChart(song)).pages!;
 assert.deepEqual((await renderChart(song,'svg',{editable:false,columns:2})).pages,plain);
 const normalPdf=await PDFDocument.load((await renderChart(song,'pdf')).pdf!);
 const editorPdf=await PDFDocument.load((await renderChart(song,'pdf',{editable:true,columns:2})).pdf!);
 assert.equal(editorPdf.getPageCount(),normalPdf.getPageCount());
});

test('editable sheets grow continuously and split only at explicit page breaks',async()=>{
 const song=readSong(source([{namn:'A',takter:Array.from({length:80},()=>'C')} ]));
 const editor=(await renderChart(song,'svg',{editable:true,columns:2})).pages!;
 const printed=(await renderChart(song)).pages!;
 assert.equal(editor.length,1);
 assert.ok(printed.length>1);
 const height=Number(editor[0].match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)![1]);
 assert.ok(height>10000);
 assert.equal(rects(editor[0],'bar-hit').length,80);
 const last=rects(editor[0],'bar-hit').at(-1)!;
 assert.ok(Number(last.y)+Number(last.height)+20<=height);
 assert.ok(!editor[0].includes('>1 / 1</text>'));
 song.delar[0].takter[40]={ackord:'C',sidbrytning:true};
 const split=(await renderChart(song,'svg',{editable:true,columns:2})).pages!;
 assert.equal(split.length,2);
 assert.equal(rects(split[0],'bar-hit').length,40);
 assert.equal(rects(split[1],'bar-hit').length,40);
 assert.ok(split[1].includes('A (forts.)'));
});

test('every checked-in song validates and renders in printed and editable modes',async()=>{
 for(const name of (await readdir('songs')).filter(name=>name.endsWith('.yaml'))){
  const song=readSong(await readFile('songs/'+name,'utf8'));
  for(const options of [{},{editable:true},{editable:true,columns:2 as const}]){
   const svg=(await renderChart(song,'svg',options)).pages!;
   assert.ok(svg.length>0,name);
   assert.ok(!svg.join('').includes('NaN'),name);
  }
 }
});
