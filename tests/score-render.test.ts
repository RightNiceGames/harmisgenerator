import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {stringify} from 'yaml';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {asBar, readSong, resolveSongMeters, transposeText} from '../lib/song';
import {PAGE_HEIGHT, PAGE_WIDTH, renderChart} from '../lib/render';

const source = (parts: unknown[] = [{namn:'Vers',takter:['C G7']}], meter='4/4') => stringify({format:1,titel:'Blad',artist:'Test',grundtonart:'C',taktart:meter,delar:parts});
const rects = (svg: string, kind: string) => [...svg.matchAll(new RegExp(`<(?:rect|g) class="${kind}" [^>]+>`,'g'))].map(match=>Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]])));

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


const visibleSvg = (svg: string) => svg.replace(/<g class="rhythm-hit"[^>]*>[\s\S]*?<\/g>/g,'').replace(/<rect\b[^>]*fill="transparent"[^>]*>[\s\S]*?<\/rect>/g,'');
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

test('instruction and rhythm targets identify their exact source and sit above chord and bar targets',async()=>{
 const song=readSong(source([{namn:'A',anvisning:'Lugnt',takter:[
  {ackord:'C G',anvisning:'Bas',rytm:[{slag:1,notvarde:8,text:'Kort'}],varianter:[{gang:2,ackord_nr:1,ackord:'F',rytm:[{slag:1.5,notvarde:8}]}]},
  {ackord:'C G',anvisning:'Solo',tonart:'C',synkop:{typ:'offbeat',ackord:2}},
  {ackord:'C',synkop:{typ:'foruttag',ackord:1}},
  {ackord:'G',radbrytning:true,synkop:{typ:'foruttag',ackord:1}},
 ]},{ateranvand:'A',anvisning:'Utan bas'}]));
 await samePrintedScore(song);
 const svg=(await renderChart(song,'svg',{editable:true})).pages!.join('');
 const instructions=rects(svg,'instruction-hit'),rhythms=rects(svg,'rhythm-hit');
 assert.ok(instructions.some(h=>h['data-scope']==='section' && h['data-section']==='0' && h['data-bar']===undefined));
 assert.ok(instructions.some(h=>h['data-scope']==='reuse' && h['data-section']==='1'));
 assert.deepEqual(instructions.filter(h=>h['data-scope']==='bar').map(h=>h['data-bar']),['0','1']);
 assert.equal(rhythms.filter(h=>h['data-rhythm-kind']==='rytm').length,2);
 assert.ok(rhythms.some(h=>h['data-rhythm-kind']==='rytm' && h['data-variant']==='0' && h['data-section']==='0' && h['data-bar']==='0'));
 assert.equal(rhythms.filter(h=>h['data-rhythm-kind']==='offbeat').length,1);
 assert.equal(rhythms.filter(h=>h['data-rhythm-kind']==='foruttag').length,2);
 const anticipation=rhythms.find(h=>h['data-rhythm-kind']==='foruttag' && h['data-bar']==='2')!;
 const bar=rects(svg,'bar-hit').find(h=>h['data-bar']==='2')!;
 assert.ok(Number(anticipation.x)<Number(bar.x),'anticipation still belongs to the next bar when drawn in the preceding bar');
 assert.ok(svg.lastIndexOf('class="chord-hit"')<svg.indexOf('class="rhythm-hit"'));
 assert.ok(svg.lastIndexOf('class="rhythm-hit"')<svg.indexOf('class="instruction-hit"'));
 assert.ok(svg.lastIndexOf('class="chord-area-hit"')<svg.indexOf('class="instruction-hit"'));
 const legacy=readSong(source([{namn:'A',takter:['C']}])+'spelordning:\n  - del: A\n    anvisning: Solo\n');
 const legacyHit=rects((await renderChart(legacy,'svg',{editable:true})).pages!.join(''),'instruction-hit')[0];
 assert.equal(legacyHit['data-form-step'],'0');
 assert.equal(legacyHit['data-scope'],'reuse');
});

test('blank instructions and rhythm note text draw nothing and add no spacing in any view',async()=>{
 const parts=[{namn:'A',takter:[{ackord:'C',rytm:[{slag:1,notvarde:8}],varianter:[{gang:2,ackord:'F',rytm:[{slag:1,notvarde:8}]}]},{ackord:'G',tonart:'C'}]},{ateranvand:'A'}];
 const original=readSong(source(parts));
 for(const blank of ['', '  ', '\n\t  ']){
  const altered=structuredClone(original);
  altered.delar.forEach(part=>part.anvisning=blank);
  altered.delar[0].takter.forEach(raw=>{const bar=asBar(raw);bar.anvisning=blank;bar.rytm?.forEach(n=>n.text=blank);bar.varianter?.forEach(v=>v.rytm?.forEach(n=>n.text=blank));});
  for(const options of [{},{editable:true}]){
   const before=(await renderChart(original,'svg',options)).pages!;
   const after=(await renderChart(altered,'svg',options)).pages!;
   assert.deepEqual(after,before,JSON.stringify(blank));
   assert.equal(rects(after.join(''),'instruction-hit').length,0);
  }
  const legacyBase=readSong(source([{namn:'A',takter:['C']}])+'spelordning:\n  - del: A\n');
  const legacyBlank=structuredClone(legacyBase);legacyBlank.spelordning![0].anvisning=blank;
  assert.deepEqual((await renderChart(legacyBlank)).pages,(await renderChart(legacyBase)).pages);
 }
 await samePrintedScore(original);
});

test('sync targets cover upper note stems while leaving actual number glyphs clickable',async()=>{
 const song=readSong(source([{namn:'A',takter:[{ackord:'C',synkop:{typ:'offbeat',ackord:1}}]}]));
 await samePrintedScore(song);
 const svg=(await renderChart(song,'svg',{editable:true})).pages![0];
 const group=svg.match(/<g class="rhythm-hit"[^>]*>[\s\S]*?<\/g>/)![0];
 const pieces=[...group.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map(m=>({x:Number(m[1]),y:Number(m[2]),w:Number(m[3]),h:Number(m[4])}));
 const number=rects(svg,'bar-number-hit')[0],chord=rects(svg,'chord-hit')[0];
 const rowY=Number(number.y)+1;
 const contains=(x:number,y:number)=>pieces.some(r=>x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h);
 const attack=Number(chord.x)+3;
 assert.equal(contains(attack+2,rowY+8),true,'stem above the notehead');
 assert.equal(contains(Number(number.x)+7,rowY+7.5),false,'actual measure digit');
 assert.ok(svg.indexOf('class="bar-number-hit"')<svg.indexOf('class="rhythm-hit"'));
});

test('fermatas avoid actual measure number bounds without an editor-only layout change',async()=>{
 const metrics=await PDFDocument.create();metrics.registerFontkit(fontkit);
 const regular=await metrics.embedFont(await readFile('fonts/DejaVuSans.ttf'));
 for(const [number,chords,fermat] of [[1,'C',1],[10,'C G',1],[100,'C G Am F',1],[100,'C G Am F',2],[100,'C G Am F',4]] as const){
  const song=readSong(source([{namn:'A',takter:[{ackord:chords,nummer:number,fermat}]}]));
  await samePrintedScore(song);
  const svg=(await renderChart(song)).pages!.join('');
  const numberText=[...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="6.8"[^>]*>(.*?)<\/text>/g)].find(m=>m[3]===String(number))!;
  const [nx,ny]=[Number(numberText[1]),Number(numberText[2])];
  const numberWidth=regular.widthOfTextAtSize(numberText[3],6.8);
  const path=[...svg.matchAll(/<path d="([^"]+)"[^>]*stroke-width="1.15"/g)][0];
  assert.ok(path,'one fermata arch');
  const values=path[1].match(/-?[\d.]+/g)!.map(Number);
  const xs=values.filter((_,i)=>i%2===0),ys=values.filter((_,i)=>i%2===1);
  const left=Math.min(...xs)-.575,right=Math.max(...xs)+.575,top=Math.min(...ys)-.575,bottom=Math.max(...ys)+.575;
  const overlaps=left<nx+numberWidth && right>nx && top<ny+2 && bottom>ny-6.8;
  assert.equal(overlaps,false,'number '+number+', chord '+fermat);
  assert.ok(right<PAGE_WIDTH-31);
 }
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
