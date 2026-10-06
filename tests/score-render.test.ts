import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {stringify} from 'yaml';
import {PDFDocument} from 'pdf-lib';
import {asBar, readSong, resolveSongMeters, transposeText} from '../lib/song';
import {PAGE_HEIGHT, PAGE_WIDTH, renderChart} from '../lib/render';

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

test('owned variant rhythm and empty chord variants also render in ordinary export',async()=>{
 const song=readSong(source([{namn:'A',takter:[{ackord:'C G',slag:[1,3],varianter:[{gang:2,ackord_nr:2,ackord:'',rytm:[{slag:3,notvarde:8,text:'Kort'}]},{gang:3,ackord_nr:1,ackord:'Dm',slag:[1]}]}]}]));
 const plain=(await renderChart(song)).pages!.join('');
 assert.ok(plain.includes('>Kort</text>'));
 assert.ok(plain.includes('<ellipse'));
 assert.equal(rects(plain,'variant-area-hit').length,0);
 assert.ok((await renderChart(song,'pdf')).pdf!.length>1000);
});


const visibleSvg = (svg: string) => svg.replace(/<rect\b[^>]*fill="transparent"[^>]*>[\s\S]*?<\/rect>/g,'');
const samePrintedScore = async (song: ReturnType<typeof readSong>, label='score') => {
 const printed=(await renderChart(song)).pages!;
 for(const options of [{editable:true},{editable:true,columns:2 as const},{editable:true,columns:4 as const}]){
  const editor=(await renderChart(song,'svg',options)).pages!;
  assert.equal(editor.length,printed.length,label);
  assert.deepEqual(editor.map(visibleSvg),printed.map(visibleSvg),label);
  for(const page of editor)assert.ok(page.includes(`viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}"`),label);
 }
 return printed;
};

test('editable targets use the printed bar, number row and independent variant chord rows',async()=>{
 const song=readSong(source([{namn:'A',takter:[{ackord:'C G',rytm:[{slag:1,notvarde:8,text:'Anslag'}],varianter:[{gang:2,ackord_nr:2,ackord:'G7',rytm:[{slag:3,notvarde:8,text:'Bas'}]},{gang:3,och_foljande:true,ackord:'F G'}]},'']} ]));
 await samePrintedScore(song);
 const svg=(await renderChart(song,'svg',{editable:true})).pages!.join('');
 const bars=rects(svg,'bar-hit'),numbers=rects(svg,'bar-number-hit'),areas=rects(svg,'chord-area-hit'),variants=rects(svg,'variant-area-hit');
 assert.equal(bars.length,2);assert.equal(numbers.length,2);assert.equal(areas.length,2);assert.equal(variants.length,2);
 assert.equal(numbers[0].height,'11');
 assert.equal(Number(numbers[0].y)-Number(bars[0].y),-5);
 assert.equal(bars[0]['data-number'],'1');assert.equal(bars[0]['data-section'],'0');assert.equal(bars[0]['data-bar'],'0');
 assert.ok(Number(numbers[0].y)+Number(numbers[0].height)<=Number(areas[0].y));
 for(const variant of variants){
  assert.ok(Number(variant.y)>Number(areas[0].y)+Number(areas[0].height));
  assert.ok(Number(variant.y)+Number(variant.height)<=Number(bars[0].y)+Number(bars[0].height));
 }
 assert.equal(variants[1]['data-variant'],'1');
 assert.equal(areas[0].height,'22');assert.equal(variants[0].height,'17');
 const annotationY=(label:string)=>Number([...svg.matchAll(/<text[^>]* y="([\d.]+)"[^>]*>(.*?)<\/text>/g)].find(m=>m[2]===label)?.[1]);
 assert.ok(annotationY('Anslag')<Number(areas[0].y));
 assert.ok(annotationY('Bas')<Number(variants[0].y));
 assert.ok(svg.includes('Fr.o.m. 3:e gången'));
 assert.ok(svg.indexOf('class="bar-hit"')<svg.indexOf('class="chord-area-hit"'));
 assert.ok(svg.indexOf('class="chord-area-hit"')<svg.indexOf('class="chord-hit"'));
 for(const hit of rects(svg,'chord-hit')){
  const area=hit['data-variant']===undefined?areas[0]:variants[Number(hit['data-variant'])];
  assert.ok(Number(hit.y)>=Number(area.y));
  assert.ok(Number(hit.y)+Number(hit.height)<=Number(area.y)+Number(area.height));
 }
});

test('mobile column hints cannot reflow the score or change explicit print column positions',async()=>{
 const song=readSong(source([{namn:'A',takter:[{ackord:'C',kolumn:3},'D','E','F']} ]));
 const original=JSON.stringify(song);
 await samePrintedScore(song);
 const svg=(await renderChart(song,'svg',{editable:true,columns:2})).pages!.join('');
 const hits=rects(svg,'bar-hit');
 assert.equal(hits.length,4);
 assert.ok(Math.abs(Number(hits[0].width)-(PAGE_WIDTH-62)/4)<.001);
 assert.ok(Math.abs(Number(hits[0].x)-(31+3*(PAGE_WIDTH-62)/4))<.001);
 assert.equal(JSON.stringify(song),original);
 const printedPdf=await PDFDocument.load((await renderChart(song,'pdf')).pdf!);
 const editablePdf=await PDFDocument.load((await renderChart(song,'pdf',{editable:true,columns:2})).pdf!);
 assert.equal(editablePdf.getPageCount(),printedPdf.getPageCount());
});

test('rich notation and forward reuse have exactly the same printed and editable SVG primitives',async()=>{
 const first={ackord:'C G',taktart:'4/4',slag:[1,3],rytm:[{slag:1,notvarde:8,text:'C'},{slag:1.5,notvarde:8,text:'kort'},{slag:2.5,notvarde:16}],repris_start:true,
  varianter:[{gang:2,ackord_nr:1,ackord:'F6/9',slag:[1.5],rytm:[{slag:1.5,notvarde:8,text:'Bas'}]},{gang:3,ackord_nr:2,och_foljande:true,stamma:'gitarr',ackord:'G Am',slag:[3,4],rytm:[{slag:3,notvarde:4},{slag:4,notvarde:16}]}]};
 const bars:unknown[]=[first,{ackord:'F',hus:'1.'},{ackord:'G7',hus_slut:true,repris_slut:true},''];
 for(let i=4;i<50;i++)bars.push(i===7?{ackord:'C',sidbrytning:true}:i===10?{ackord:'C',taktart:'3/4',tonart:'Bb'}:i===18?{ackord:'C',radbrytning:true,kolumn:2}:i===22?{ackord:'G',synkop:{typ:'offbeat',ackord:1},break:true}:i===25?{ackord:'C',segno:true,coda:'hopp'}:'C');
 const song=readSong(source([{ateranvand:'A',ganger:2,anvisning:'Utan bas'},{namn:'A',takter:bars},{namn:'B',ganger:2,sidbrytning:true,takter:[{ackord:'N.C.',anvisning:'Rubato',coda:'mal',slut:true},{ackord:'%',fermat:1}]},{ateranvand:'A',sidbrytning:true,anvisning:'Instrumentalt'}]));
 const printed=await samePrintedScore(song);
 assert.ok(printed.length>=4);
 assert.ok(printed.join('').includes('Se A, takt 1–50.'));
 assert.ok(printed.join('').includes('Fr.o.m. 3:e gången'));
 assert.ok(printed.join('').includes('>Bas</text>'));
 assert.ok(printed.join('').includes('>BREAK</text>'));
 assert.equal(rects((await renderChart(song,'svg',{editable:true})).pages!.join(''),'reuse-hit').length,2);
});

test('automatic A4 pagination, explicit page breaks and headers are identical while editing',async()=>{
 const song=readSong(source([{namn:'A',takter:Array.from({length:80},()=>'C')} ]));
 let printed=await samePrintedScore(song);
 assert.ok(printed.length>1);
 for(let i=0;i<printed.length;i++)assert.ok(printed[i].includes(`>${i+1} / ${printed.length}</text>`));
 song.delar[0].takter[40]={ackord:'C',sidbrytning:true};
 printed=await samePrintedScore(song);
 assert.ok(printed.length>1);
 assert.ok(printed.slice(1).some(svg=>svg.includes('A (forts.)')));
});

test('empty sheets and every checked-in song have exact printed and editable visible output',async()=>{
 await samePrintedScore(readSong(source([])),'empty sheet');
 for(const name of (await readdir('songs')).filter(name=>name.endsWith('.yaml'))){
  const song=readSong(await readFile('songs/'+name,'utf8'));
  const printed=await samePrintedScore(song,name);
  assert.ok(printed.length>0,name);
  assert.ok(!printed.join('').includes('NaN'),name);
 }
});
