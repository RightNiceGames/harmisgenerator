import {createRequire} from 'node:module';
const require=createRequire('/home/kevin/ai/workspaces/harmisgenerator/package.json');
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({executablePath:'/home/kevin/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome',args:['--no-sandbox']});
const p=await browser.newPage({viewport:{width:1512,height:1050}});
const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('file:///home/kevin/ai/workspaces/harmisgenerator/design/mockups/hybrid/prototype.html');
await p.evaluate(()=>document.fonts.ready);
p.setDefaultTimeout(3500);
const state=()=>p.evaluate(()=>window.hybrid.getState());
const results=[];
async function closeParameters(){if((await state()).contextView)await p.keyboard.press('Escape');}
async function parameter(view){const st=await state();if(st.draft)await p.locator('#score-edit').press('Enter');if(['variant','add','order'].includes(view)&&!(await state()).chordId){const z=await state(),b=z.model.sections.flatMap(x=>x.bars).find(b=>b.id===z.selected[0]);if(b?.chords.length)await p.locator(`[data-chord="${b.chords[0].id}"]`).click();}if((await state()).contextView!==view)await p.locator(`button[data-action="context:${view}"]`).filter({visible:true}).first().click();}

async function fresh(){await p.reload();await p.evaluate(()=>document.fonts.ready);}
async function clickChord(section,index,chordIndex=0){await closeParameters();const s=await state();const b=s.model.sections.find(x=>x.id===section).bars[index];await p.locator(`[data-chord="${b.chords[chordIndex].id}"]`).click();}
async function test(name,fn){try{await fresh();await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,error:e.message});}}
function assert(condition,msg){if(!condition)throw Error(msg);}

const tool=async name=>{if(name==='chord')await parameter('order');else if(name==='rhythm')await parameter('rhythm');else if(name==='insert')await parameter('changes');};
const source=s=>s.model.sections.find(x=>x.id==='verse');
async function range(first,last){await closeParameters();const bars=(source(await state())).bars;await p.locator(`[data-select-bar="${bars[first].id}"]`).click({position:{x:3,y:5}});for(let i=first+1;i<=last;i++)await p.locator(`[data-bar-check="${bars[i].id}"]`).check();}
async function makeHouse(a,b){await range(a,b);await p.locator('[data-action="context-house:1"]').click();}
await test('Partially overlapping houses await explicit choice without data loss',async()=>{await makeHouse(2,4);await range(3,5);await p.locator('[data-action="context-house:2"]').click();let s=await state();assert(s.pendingHouse&&source(s).bars[2].houseSpan.number==='1'&&!source(s).bars[3].houseSpan,'overlap corrupted old house');});
await test('Removing house from selected continuation removes owning house',async()=>{await makeHouse(2,4);await range(3,3);await p.locator('[data-action="house-remove"]').click();assert(!source(await state()).bars.some(b=>b.houseSpan),'owner house remains');});
await test('Inserting a bar inside house preserves its continuous span',async()=>{await makeHouse(2,4);const before=source(await state()).bars.map(b=>b.id);await range(3,3);await tool('insert');await p.locator('[data-action="context-insert-bar"]').click();const bars=source(await state()).bars,newBar=bars.find(b=>!before.includes(b.id));assert(bars[2].houseSpan.barIds.includes(newBar.id),'inserted bar is excluded from surrounding house');assert(await p.locator('.marker').count()===2,'house continuation disappears after insertion');});
await test('House bracket follows manual row break without crossing empty cells',async()=>{await makeHouse(0,4);await range(2,2);await p.locator('[data-action="break:row"]').click();const markers=await p.locator('#section-verse .marker').evaluateAll(ms=>ms.map(m=>({bar:m.closest('.bar').getAttribute('data-bar'),width:m.style.width})));const bars=source(await state()).bars;assert(markers.length===2&&markers[0].width.includes('200%')&&markers[1].bar===String(bars[2].id)&&markers[1].width.includes('300%'),'manual row break cuts house incorrectly: '+JSON.stringify(markers));});
await test('Form reorder blocks invalid inherited meter',async()=>{await clickChord('verse',0);await tool('insert');await p.locator('#local-meter').selectOption('6/8');await p.locator('[data-action="local-apply"]').click();await clickChord('chorus',0);await tool('rhythm');await p.locator('[data-action="resolution:16"]').click();await p.locator('[data-action="attack:6.5"]').click();await p.locator('button[data-action="tab:form"]').filter({visible:true}).first().click();await p.locator('[data-action="block:f3"]').click();await p.locator('[data-action="move:f3:-1"]').click();const s=await state();assert(s.model.form[2].source==='chorus'&&s.error,'invalid meter move committed');});
await test('Mobile shorter viewport keeps popup within available height',async()=>{await p.setViewportSize({width:375,height:580});await fresh();await p.locator('.toolbar [data-action="tab:form"]').click();await p.waitForTimeout(220);const r=await p.locator('.panel').boundingBox();assert(r.y>=0&&r.y+r.height<=580,'popup clipped at keyboard-sized viewport');assert(await p.evaluate(()=>document.documentElement.scrollWidth)<=375,'small mobile overflow');await p.setViewportSize({width:1512,height:1050});});
console.log(JSON.stringify({errors,results},null,2));await (await import('node:fs/promises')).writeFile(new URL('independent-review-edge.json',import.meta.url),JSON.stringify({errors,results},null,2));await browser.close();
