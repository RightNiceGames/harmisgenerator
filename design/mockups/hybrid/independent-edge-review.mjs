import {createRequire} from 'node:module';
const require=createRequire('/home/kevin/ai/workspaces/harmisgenerator/package.json');
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({executablePath:'/home/kevin/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome',args:['--no-sandbox']});
const p=await browser.newPage({viewport:{width:1512,height:1050}});
const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('file:///home/kevin/ai/workspaces/harmisgenerator/design/mockups/hybrid/prototype.html');
await p.evaluate(()=>document.fonts.ready);
const state=()=>p.evaluate(()=>window.hybrid.getState());
const results=[];
async function fresh(){await p.reload();await p.evaluate(()=>document.fonts.ready);}
async function clickChord(section,index,chordIndex=0){const s=await state();const b=s.model.sections.find(x=>x.id===section).bars[index];await p.locator(`[data-chord="${b.chords[chordIndex].id}"]`).click();}
async function test(name,fn){try{await fresh();await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
function assert(condition,msg){if(!condition)throw Error(msg);}

const tool=name=>p.locator(`.toolbar [data-action="tool:${name}"]`).click();
const source=s=>s.model.sections.find(x=>x.id==='verse');
async function range(a,b){let s=await state(),bars=source(s).bars;await p.locator(`[data-bar="${bars[a].id}"]`).click({position:{x:70,y:78}});await p.locator(`[data-bar="${bars[b].id}"]`).click({modifiers:['Shift'],position:{x:70,y:78}});}
async function makeHouse(a,b){await range(a,b);await tool('repeats');await p.locator('[data-action="house:1"]').click();await p.locator('[data-action="house-apply"]').click();}
await test('Partially overlapping houses await explicit choice without data loss',async()=>{await makeHouse(2,4);await range(3,5);await tool('repeats');await p.locator('[data-action="house:2"]').click();await p.locator('[data-action="house-apply"]').click();let s=await state();assert(s.pendingHouse&&source(s).bars[2].houseSpan.number==='1'&&!source(s).bars[3].houseSpan,'overlap corrupted old house');});
await test('Removing house from selected continuation removes owning house',async()=>{await makeHouse(2,4);await range(3,3);await tool('repeats');await p.locator('[data-action="house-remove"]').click();assert(!source(await state()).bars.some(b=>b.houseSpan),'owner house remains');});
await test('Inserting a bar inside house preserves its continuous span',async()=>{await makeHouse(2,4);const before=source(await state()).bars.map(b=>b.id);await range(3,3);await tool('insert');await p.locator('[data-action="insert-bar"]').click();const bars=source(await state()).bars,newBar=bars.find(b=>!before.includes(b.id));assert(bars[2].houseSpan.barIds.includes(newBar.id),'inserted bar is excluded from surrounding house');assert(await p.locator('.marker').count()===2,'house continuation disappears after insertion');});
await test('House bracket follows manual row break without crossing empty cells',async()=>{await makeHouse(0,4);await range(2,2);await tool('layout');await p.locator('[data-action="break:row"]').click();const markers=await p.locator('#section-verse .marker').evaluateAll(ms=>ms.map(m=>({bar:m.closest('.bar').getAttribute('data-bar'),width:m.style.width})));const bars=source(await state()).bars;assert(markers.length===2&&markers[0].width.includes('200%')&&markers[1].bar===String(bars[2].id)&&markers[1].width.includes('300%'),'manual row break cuts house incorrectly: '+JSON.stringify(markers));});
await test('Form reorder blocks invalid inherited meter',async()=>{await clickChord('verse',0);await tool('insert');await p.locator('#local-meter').selectOption('6/8');await p.locator('[data-action="local-apply"]').click();await clickChord('chorus',0);await tool('rhythm');await p.locator('[data-action="resolution:16"]').click();await p.locator('[data-action="attack:6.5"]').click();await p.locator('.panel-nav [data-action="tab:form"]').click();await p.locator('[data-action="move:f3:-1"]').click();const s=await state();assert(s.model.form[2].source==='chorus'&&s.error,'invalid meter move committed');});
await test('Mobile shorter viewport keeps popup within available height',async()=>{await p.setViewportSize({width:375,height:580});await fresh();await p.locator('.toolbar [data-action="tab:form"]').click();await p.waitForTimeout(220);const r=await p.locator('.panel').boundingBox();assert(r.y>=0&&r.y+r.height<=580,'popup clipped at keyboard-sized viewport');assert(await p.evaluate(()=>document.documentElement.scrollWidth)<=375,'small mobile overflow');await p.setViewportSize({width:1512,height:1050});});
console.log(JSON.stringify({errors,results},null,2));await (await import('node:fs/promises')).writeFile(new URL('independent-review-edge.json',import.meta.url),JSON.stringify({errors,results},null,2));await browser.close();
