import { chromium } from '@playwright/test';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const steps = [
  ['overview','Arbetsytan','Förhandsgranskningen är redigeraren. Textfilen ligger under Fler alternativ.'],
  ['chord','Ändra ett ackord','Klicka på ackordet, skriv eller välj ett förslag. Slag, parentes och variant finns i samma sammanhang.'],
  ['bar','Infoga i vald takt','Klicka i taktens tomma yta. Infoga ackord, upprepa föregående takt eller ändra taktstrukturen.'],
  ['rhythm','Placera byten och anslag','Ackordslag anger när harmoniken byts. Egen rytm anger anslag och notvärden. De redigeras separat.'],
  ['repeats','Öppna repris och hus','Markera takter 19–20 i den befintliga reprisen. A samlar hus bakom en knapp; B visar första, andra och eget hus direkt.'],
  ['house','Välj hus och taktspann','Välj första, andra eller eget hus och kontrollera början och slutet innan du infogar.'],
  ['applied','Se resultatet och ångra','Första huset går över takt 19–20. Reprisslutet ligger i sista takten. Ändringen går att ångra.'],
  ['structure','Bygg låtformen','Återanvänd Vers två gånger efter Refräng. En återkomst följer originaldelen; en kopia kan ändras separat.'],
  ['structure-applied','Återkomsten är infogad','Vers × 2 visas sist i låtformen och på ackordbladet. Originaldelen är fortfarande den som redigeras.'],
  ['song','Ändra låtuppgifter','Titel, artist, grundtonart, taktart, tempo, version och status kan ändras utan textfilen.'],
  ['layout','Ändra layout och lokala byten','Markera takt 9 och välj radbrytning, sidbrytning, taktnummer, kolumn eller musikaliskt byte.'],
];
await mkdir(path.join(root,'screenshots'),{recursive:true});
const browser = await chromium.launch({headless:true,executablePath:'/home/kevin/.cache/ms-playwright/chromium-1246/chrome-linux64/chrome',args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:1512,height:1050},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const screenshotStats=[];
for(const version of ['a','b']){
 for(let i=0;i<steps.length;i++){
  const [state]=steps[i];
  await page.goto('file://'+path.join(root,'prototype.html')+`?version=${version}&state=${state}`);
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForSelector('.bar-hit');
  await page.screenshot({path:path.join(root,'screenshots',`${version}-${String(i+1).padStart(2,'0')}-${state}.png`)});
  const stats=await page.evaluate(()=>{
   const popup=document.querySelector('.floating'),scene=document.querySelector('.scene');
   const r=popup?.getBoundingClientRect(),s=scene?.getBoundingClientRect();
   return {state:window.mockup.getState(),width:document.documentElement.scrollWidth,popup:r?{top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right}:null,scene:s?{top:s.top,bottom:s.bottom}:null};
  });
  screenshotStats.push(stats);
  if(stats.width>1512)throw new Error('Horizontal overflow: '+version+' '+state);
  if(stats.popup&&(stats.popup.bottom>1050||stats.popup.top<0))throw new Error('Panel clipped: '+version+' '+state);
 }
}
// Check the main path by using the UI rather than the screenshot-state selector.
await page.goto('file://'+path.join(root,'prototype.html')+'?version=a&state=overview');
await page.locator('.chord-hit[data-target="1-6"]').click();
await page.locator('#chord-value').fill('Bm');
await page.getByRole('button',{name:'Ändra ackord',exact:true}).click();
if(!await page.evaluate(()=>window.mockup.getState().dirty))throw new Error('Chord change did not set dirty state');
await page.getByRole('button',{name:'Ångra',exact:true}).first().click();
await page.locator('.bar-hit[data-target="2-6"]').click({position:{x:90,y:33}});
await page.locator('.bar-hit[data-target="2-7"]').click({modifiers:['Shift'],position:{x:90,y:33}});
if(await page.evaluate(()=>window.mockup.getState().selected.length)!==2)throw new Error('Range selection failed');
await page.getByRole('button',{name:'Repris & hus',exact:true}).click();
await page.getByRole('button',{name:'Lägg till hus',exact:false}).click();
await page.getByRole('button',{name:'Lägg till första hus',exact:true}).click();
if(await page.evaluate(()=>window.mockup.getState().score)!=='house')throw new Error('House not applied');
await page.getByRole('button',{name:'Spara',exact:true}).click();
if(await page.evaluate(()=>window.mockup.getState().dirty))throw new Error('Save did not clear dirty state');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
if(await page.evaluate(()=>window.mockup.getState().selected.length)!==0)throw new Error('Escape did not clear selection');
for(const version of ['a','b']){
 await page.setViewportSize({width:430,height:932});
 await page.goto('file://'+path.join(root,'prototype.html')+`?version=${version}&state=chord`);
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:path.join(root,'screenshots',`${version}-12-mobile.png`)});
 if(await page.evaluate(()=>document.documentElement.scrollWidth)>430)throw new Error('Horizontal overflow on mobile');
}
const rows=steps.map(([state,title,description],i)=>{
 const number=String(i+1).padStart(2,'0');
 return `<section id="${state}" class="comparison"><div class="step-head"><span class="step-number">${number}</span><div><h2>${title}</h2><p>${description}</p></div></div><div class="pair">${['a','b'].map(v=>`<figure><figcaption>${v==='a'?'A · Nära markeringen':'B · Fast panel'}<a href="prototype.html?version=${v}&state=${state}">Prova steget</a></figcaption><a href="screenshots/${v}-${number}-${state}.png"><img src="screenshots/${v}-${number}-${state}.png" alt="${v.toUpperCase()}: ${title}"></a></figure>`).join('')}</div></section>`;
}).join('');
const gallery=`<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Harmis · två designförslag</title><style>
@font-face{font-family:Harmis;src:url('fonts/DejaVuSans.ttf')}@font-face{font-family:Harmis;src:url('fonts/DejaVuSans-Bold.ttf');font-weight:700}*{box-sizing:border-box}body{margin:0;background:#f4f6ef;color:#233d35;font:14px/1.7 Harmis,sans-serif}a{color:#285b48;text-underline-offset:4px}header{padding:55px 40px 38px;max-width:1512px;margin:auto}header .eyebrow{font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#69776e}h1{font-size:40px;letter-spacing:-1.7px;line-height:1.2;margin:10px 0 20px}header p{max-width:870px;color:#596a5d}nav{display:flex;gap:20px;flex-wrap:wrap;margin-top:24px;font-size:12px}.explain{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:33px;border-top:1px solid #dbe1d7;padding-top:25px}.explain h2{font-size:18px;margin:0}.explain p{font-size:13px;line-height:1.8}.explain span{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#69776e}.comparison{max-width:1512px;margin:0 auto 50px;padding:0 24px}.step-head{display:flex;align-items:baseline;gap:16px;margin:0 0 15px}.step-number{font-size:13px;color:#7d9280}.step-head h2{font-size:22px;letter-spacing:-.5px;margin:0}.step-head p{font-size:12px;color:#69776e;margin:5px 0 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;min-width:0}figcaption{font-size:11px;font-weight:700;display:flex;justify-content:space-between;padding:10px 1px}figcaption a{font-weight:400}img{display:block;width:100%;height:auto;border:1px solid #d5ddce;box-shadow:0 4px 15px #233d3508;border-radius:5px}.comparison:target{scroll-margin-top:20px}.mobile-pair{max-width:920px;margin:auto}footer{border-top:1px solid #dbe1d7;padding:30px 40px;max-width:1512px;margin:auto;color:#69776e;font-size:12px}.notes{max-width:1050px;padding:20px 40px;margin:auto}.notes h2{font-size:20px}.notes td,.notes th{text-align:left;padding:12px;border-bottom:1px solid #dbe1d7;font-size:12px;vertical-align:top}.notes table{border-collapse:collapse;width:100%}.notes p{font-size:13px;color:#596a5d}.compare-capture header,.compare-capture footer,.compare-capture .notes,.compare-capture .comparison:not(.capture-active){display:none}.compare-capture .comparison{margin:0;padding:20px 24px 24px;max-width:none}.compare-capture .step-head p{font-size:13px}.compare-capture img{box-shadow:none}.compare-capture .pair{gap:20px}@media(max-width:800px){header{padding:30px 20px}.explain{grid-template-columns:1fr;gap:12px}h1{font-size:31px}.pair{grid-template-columns:1fr}.comparison{padding:0 16px}.step-head h2{font-size:18px}.notes{padding:10px 20px}}
</style></head><body><header><div style="padding:16px 20px;background:#e6eddf;border-left:3px solid #315f4a;margin-bottom:28px"><strong>Reviderat hybridförslag</strong><br><a href="hybrid/prototype.html">Prova fast panel och direkt skrivning på bladet</a> · <a href="hybrid/index.html">Se de 27 uppdaterade bilderna</a></div><div class="eyebrow">Harmisgeneratorn / designstudie</div><h1>Redigera där musiken syns.</h1><p>Ett huvudförslag och ett alternativ med samma innehåll och tio motsvarande arbetsmoment. Bilderna bygger på ett förenklat Tro-exempel och generatorns befintliga rendering. Detta är en separat mockup, inte en ändring av den nuvarande redigeraren.</p><nav><a href="prototype.html?version=a">Prova huvudförslaget A</a><a href="prototype.html?version=b">Prova alternativet B</a><a href="#overview">Se bilderna</a><a href="#tradeoffs">Jämför valen</a></nav><div class="explain"><div><span>Huvudförslag A</span><h2>Kompakt verktygsrad, redigering vid markeringen</h2><p>Välj ett ackord, en takt eller ett spann. Öppna en liten panel nära urvalet. Infoga, Rytm, Repris & hus, Tecken och Layout står alltid i samma ordning ovanför bladet. Ovanligare val syns först när de behövs.</p></div><div><span>Alternativ B</span><h2>Fast verktygspanel till höger</h2><p>Samma markering och grupper, men med fler synliga val i en panel som stannar på samma plats. Första och andra hus kan väljas direkt. Det kräver mindre sökande men lämnar mindre plats åt ackordbladet.</p></div></div></header>${rows}<section class="comparison" id="mobile"><div class="step-head"><span class="step-number">12</span><div><h2>På en mindre skärm</h2><p>Båda versionerna använder en panel längst ner. Ett permanent sidofält skulle göra bladet för smalt.</p></div></div><div class="pair mobile-pair">${['a','b'].map(v=>`<figure><figcaption>${v.toUpperCase()} · Ackordredigering på mobil</figcaption><a href="screenshots/${v}-12-mobile.png"><img src="screenshots/${v}-12-mobile.png" alt="${v.toUpperCase()}: ackordpanel på mobil"></a></figure>`).join('')}</div></section><section class="notes" id="tradeoffs"><h2>Val, nackdelar och alternativ</h2><table><thead><tr><th>Val i A</th><th>Varför</th><th>Nackdel</th><th>Alternativ i B</th></tr></thead><tbody><tr><td>Panel nära urvalet</td><td>Ändringen och takten kan jämföras utan lång ögonförflyttning.</td><td>Panelen kan täcka närliggande musik och byta position.</td><td>Fast panel med stabil position, men ett mindre ackordblad.</td></tr><tr><td>Samlad knapp för hus</td><td>Första, andra och egna hus fyller inte verktygsraden.</td><td>En extra nivå och ett extra klick.</td><td>Direkta knappar för första och andra hus i panelen.</td></tr><tr><td>Klick på ackord, klick i taktarea för takter</td><td>Ingen separat lägesväxling i de vanligaste arbetsmomenten.</td><td>Det kan vara lätt att välja ackord när man avsåg hela takten.</td><td>Panelen visar urvalet tydligt. Vid behov kan ett explicit markeringsläge läggas till.</td></tr><tr><td>Låtbiblioteket öppnas vid behov</td><td>Vänsterspalten används för låtformen under redigeringen.</td><td>Det tar ett extra klick att byta låt.</td><td>Behåll biblioteket öppet om täta låtbyten är viktigare än arbetet med formen.</td></tr><tr><td>Textfil under Fler alternativ</td><td>Vanliga ändringar kräver inga filkunskaper.</td><td>Stora mängdändringar kan gå långsammare.</td><td>Avancerat textläge eller en tillfällig delad vy för vana användare.</td></tr></tbody></table><p>Den föreslagna ordningen utgår från att ackord och taktstruktur används oftare än navigeringstecken och layout. Det är en designhypotes, inte uppmätt användningsdata. B passar bättre om många olika musikmarkeringar läggs in i varje arbetspass.</p><p>Mockupen demonstrerar ackordändring, markering, hus, återkomst och sparstatus i minnet. Övriga kontroller illustrerar den föreslagna interaktionen. De är inte en fullständig ersättning för generatorns redigeringsfunktioner.</p></section><footer>24 screenshots · 11 desktopsteg per version + 2 mobilbilder. Klicka på en bild för full storlek. Originalfilerna i songs och det befintliga gränssnittet är oförändrade.</footer></body></html>`;
await writeFile(path.join(root,'index.html'),gallery);
await page.setViewportSize({width:3024,height:1300});
await page.goto('file://'+path.join(root,'index.html'));
await page.evaluate(()=>document.fonts.ready);
for(const [state] of steps){
 await page.evaluate(state=>{document.body.classList.add('compare-capture');document.querySelectorAll('.comparison').forEach(el=>el.classList.toggle('capture-active',el.id===state));},state);
 const element=page.locator('#'+state);
 await element.screenshot({path:path.join(root,'screenshots',`compare-${state}.png`)});
}
await writeFile(path.join(root,'screenshot-checks.json'),JSON.stringify({errors,screenshotStats,interactiveChecks:'chord edit, undo, range selection, house, save, Escape, mobile overflow passed'},null,2));
await browser.close();
// Remove only superseded screenshots generated by earlier passes of this task.
for (const version of ['a','b']) for (const name of ['09-song','10-layout','11-mobile']) {
  await unlink(path.join(root,'screenshots',`${version}-${name}.png`)).catch(error=>{if(error.code!=='ENOENT')throw error;});
}
if(errors.length)throw new Error(errors.join('\n'));
console.log('24 individual screenshots and 11 matched comparisons created. Interaction checks passed.');
