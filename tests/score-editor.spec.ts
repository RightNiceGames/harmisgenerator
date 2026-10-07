import {test,expect,type Page,type Locator} from '@playwright/test';
import {mkdir,writeFile,unlink,readdir,readFile} from 'node:fs/promises';
import {parse} from 'yaml';

let created=false;
const fixtureId=`score-editor-e2e-${process.pid}.yaml`,fixture=`songs/${fixtureId}`,fixtureTitle=`Bladredigering test ${process.pid}`;
const content=`# Arrangemangskommentar före låten
format: 1
titel: ${fixtureTitle}
artist: Testartist
grundtonart: C
taktart: 4/4
tempo: 96
status: utkast
kallor:
  - url: https://example.com/chart
    beskrivning: Underlag för arrangemanget
anteckningar:
  - Eget arrangementsbeslut
delar:
  - namn: Vers # Kommentar om låtdelen
    takter:
      - ackord: C G # Kommentar om grundackorden
        slag: [1, 3]
        repris_start: true
        rytm:
          - slag: 1
            notvarde: 4 # Kommentar om huvudnotens längd
        varianter:
          - gang: 2
            ackord: F Am # Kommentar om variantharmonik
            ackord_nr: 1
            slag: [1, 2]
            rytm:
              - slag: 1.5
                notvarde: 8 # Kommentar om variantnotens längd
      - Dm # Kommentar om en enkel takt
      - ""
      - F
  - ateranvand: Vers
    ganger: 2
    anvisning: Solo
  - namn: Coda
    sidbrytning: true
    takter: [C]
# Arrangemangskommentar efter låten
`;

test.beforeAll(async()=>{await mkdir('work/cache',{recursive:true});await writeFile(fixture,content,{flag:'wx'});created=true;});
test.beforeEach(async()=>{if(created)await writeFile(fixture,content);});
test.afterAll(async()=>{
 if(!created)return;
 await unlink(fixture).catch(e=>{if(e.code!=='ENOENT')throw e;});
 for(const name of await readdir('work/backups').catch(()=>[]))if(name.startsWith(fixtureId+'.')&&name.endsWith('.bak'))await unlink('work/backups/'+name);
});
async function openFixture(page:Page){
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');const library=page.getByRole('button',{name:'Visa bibliotek',exact:true});if(await library.isVisible())await library.click();await page.getByRole('button',{name:/Alla låtar/}).click();await page.getByRole('button',{name:new RegExp(fixtureTitle)}).click();
 await expect(page.locator('.paper').first()).toContainText(fixtureTitle);await expect(page.locator('.live-label')).toHaveText('Uppdaterad');return errors;
}
async function sourceText(page:Page){
 const show=page.getByRole('button',{name:'Visa låtfil',exact:true});if(await show.count())await show.click();
 return page.getByRole('textbox',{name:'Låtfilens text'}).inputValue();
}
const barData=(raw:string|{ackord:string})=>typeof raw==='string'?{ackord:raw}:raw;
const main=(page:Page,bar=0,chord=0)=>page.locator(`.chord-hit[data-section="0"][data-bar="${bar}"][data-chord="${chord}"]:not([data-variant])`).first();
const variant=(page:Page,chord=0)=>page.locator(`.chord-hit[data-section="0"][data-bar="0"][data-chord="${chord}"][data-variant="0"]`).first();
async function editLine(target:Locator,page:Page){await target.click();await expect(page.locator('#score-edit,#variant-edit')).toHaveCount(0);await target.click();}

test('score is the default editor and the advanced source file is opt in',async({page})=>{
 const errors=await openFixture(page);
 await expect(page.getByRole('textbox',{name:'Låtfilens text'})).toHaveCount(0);
 await expect(page.locator('.song-header')).toHaveCount(0);
 await expect(main(page)).toBeVisible();await expect(page.locator('.bar-number-hit').first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Spara',exact:true})).toBeVisible();
 expect(await sourceText(page)).toBe(content);await expect(page.locator('.musical-tools')).toBeVisible();expect(errors).toEqual([]);
});
test('first chord click selects and second edits the full main line with a caret',async({page})=>{
 await openFixture(page);await editLine(main(page),page);
 const input=page.locator('#score-edit');await expect(input).toHaveValue('C G');await expect(input).toBeFocused();
 expect(await input.evaluate((el:HTMLInputElement)=>el.selectionStart===el.selectionEnd)).toBe(true);
 await expect(page.getByRole('dialog',{name:'Ändra ackord',exact:true})).toHaveCount(0);
 await input.press('Escape');await expect(input).toHaveCount(0);expect(await sourceText(page)).toBe(content);
});
test('whole main line accepts multiple parenthesized chords and one undo restores it',async({page})=>{
 await openFixture(page);await editLine(main(page,1),page);
 await page.locator('#score-edit').fill('(Dm7) (G7)');await page.locator('#score-edit').press('Enter');
 await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const changed=parse(await sourceText(page));expect(barData(changed.delar[0].takter[1]).ackord).toBe('(Dm7) (G7)');
 await page.getByRole('button',{name:'Ångra',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Låtfilens text'})).toHaveValue(content);
});
test('invalid main text stays editable and Escape leaves source unchanged',async({page})=>{
 await openFixture(page);await editLine(main(page,1),page);const input=page.locator('#score-edit');
 await input.fill('H7');await input.press('Enter');await expect(input).toBeVisible();await expect(page.getByRole('alert').filter({visible:true}).first()).toBeVisible();
 await input.press('Escape');expect(await sourceText(page)).toBe(content);
});
test('blank chord area opens directly and an empty measure can gain chords',async({page})=>{
 await openFixture(page);await page.locator('.chord-area-hit[data-section="0"][data-bar="2"]').click();
 const input=page.locator('#score-edit');await expect(input).toHaveValue('');await input.fill('Am Dm');await input.press('Enter');
 await expect(page.locator('.live-label')).toHaveText('Uppdaterad');expect(barData(parse(await sourceText(page)).delar[0].takter[2]).ackord).toBe('Am Dm');
});
test('variant selection and editing retain base music independent starts and rhythm',async({page})=>{
 await openFixture(page);await editLine(variant(page,1),page);const input=page.locator('#variant-edit');await expect(input).toHaveValue('F Am');
 await input.fill('G Bm');await input.press('Enter');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const b=parse(await sourceText(page)).delar[0].takter[0];expect(b.ackord).toBe('C G');expect(b.slag).toEqual([1,3]);expect(b.varianter[0]).toMatchObject({ackord:'G Bm',ackord_nr:1,slag:[1,2],rytm:[{slag:1.5,notvarde:8}]});expect(b.rytm).toEqual([{slag:1,notvarde:4}]);
});
test('switching from variant to its base selects first and edits on second click',async({page})=>{
 await openFixture(page);await variant(page).click();await main(page).click();await expect(page.locator('#score-edit,#variant-edit')).toHaveCount(0);
 await main(page).click();await expect(page.locator('#score-edit')).toHaveValue('C G');await page.locator('#score-edit').press('Escape');
 await variant(page).click();await expect(page.locator('#score-edit,#variant-edit')).toHaveCount(0);await variant(page).click();await expect(page.locator('#variant-edit')).toHaveValue('F Am');
});
test('preview editing preserves YAML comments source links and arrangement notes',async({page})=>{
 await openFixture(page);await editLine(main(page,0,1),page);await page.locator('#score-edit').fill('C Am');await page.locator('#score-edit').press('Enter');
 await expect(page.locator('.live-label')).toHaveText('Uppdaterad');const changed=await sourceText(page);
 for(const comment of ['Arrangemangskommentar före låten','Kommentar om låtdelen','Kommentar om grundackorden','Kommentar om en enkel takt','Arrangemangskommentar efter låten'])expect(changed).toContain(comment);
 const song=parse(changed);expect(song.kallor).toEqual(parse(content).kallor);expect(song.anteckningar).toEqual(parse(content).anteckningar);expect(song.delar[0].takter[0].repris_start).toBe(true);expect(song.delar[1].ateranvand).toBe('Vers');
});
test('save flushes the active main line and reload restores its saved source',async({page})=>{
 await openFixture(page);await editLine(main(page,1),page);await page.locator('#score-edit').fill('Dm7');
 await expect(page.getByRole('button',{name:'Spara',exact:true})).toBeEnabled();await page.locator('#score-edit').press('Control+s');await expect(page.getByRole('status').filter({hasText:'Sparad i låtbiblioteket'})).toHaveText('Sparad i låtbiblioteket');
 expect(barData(parse(await readFile(fixture,'utf8')).delar[0].takter[1]).ackord).toBe('Dm7');
 await sourceText(page);await page.getByRole('button',{name:'Läs in på nytt',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');expect(barData(parse(await sourceText(page)).delar[0].takter[1]).ackord).toBe('Dm7');
});
test('print preview and PDF use the plain score without editor targets',async({page})=>{
 await openFixture(page);await expect(page.locator('.bar-number-hit').first()).toBeVisible();
 const toggle=page.getByRole('button',{name:'Visa två sidor sida vid sida',exact:true});await toggle.click();
 await expect(page.locator('.bar-number-hit,.chord-area-hit,.variant-area-hit,.reuse-hit')).toHaveCount(0);
 await expect(page.locator('.paper').first()).toContainText('Bladredigering test');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportera PDF',exact:true}).click();
 const download=await downloadPromise;expect(download.suggestedFilename()).toBe(fixtureId.replace('.yaml','.pdf'));
 const path=await download.path();expect(path).not.toBeNull();expect((await readFile(path!)).subarray(0,5).toString()).toBe('%PDF-');
 await toggle.click();await expect(page.locator('.bar-number-hit').first()).toBeVisible();
});
for(const width of [375,430])test(`mobile ${width}: direct input and selection stay within viewport`,async({page})=>{
 await page.setViewportSize({width,height:844});const errors=await openFixture(page);await editLine(main(page,1),page);
 const input=page.locator('#score-edit');const bounds=await input.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
 await input.fill('Dm7');await input.press('Enter');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('measure duplicate preserves musical contents and omits repeat boundaries',async({page})=>{
 await openFixture(page);await page.locator('.bar-number-hit[data-section="0"][data-bar="0"]').click();
 await expect(page.locator('#score-edit,#variant-edit')).toHaveCount(0);await page.locator('.paper .bar-number-hit[data-section="0"][data-bar="0"]').hover();await page.getByRole('button',{name:'Duplicera takt 1',exact:true}).click();
 await expect(page.locator('.live-label')).toHaveText('Uppdaterad');const song=parse(await sourceText(page)),bars=song.delar[0].takter;
 expect(bars).toHaveLength(5);expect(bars[1].ackord).toBe('C G');expect(bars[1].varianter).toEqual(bars[0].varianter);expect(bars[1].rytm).toEqual(bars[0].rytm);expect(bars[0].repris_start).toBe(true);expect(bars[1].repris_start).toBeUndefined();
 await page.getByRole('button',{name:'Ångra',exact:true}).click();expect(parse(await page.getByRole('textbox',{name:'Låtfilens text'}).inputValue()).delar[0].takter).toHaveLength(4);
});
test('clear measure removes chords and owned variants while preserving signs and rhythm',async({page})=>{
 await openFixture(page);await page.locator('.bar-number-hit[data-section="0"][data-bar="0"]').click();
 await page.getByRole('button',{name:'Mer',exact:true}).click();await page.getByRole('button',{name:'Töm ackordraden',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const cleared=parse(await sourceText(page)).delar[0].takter[0];expect(cleared.ackord).toBe('');expect(cleared.varianter).toBeUndefined();expect(cleared.repris_start).toBe(true);expect(cleared.rytm).toEqual([{slag:1,notvarde:4}]);
 await page.getByRole('button',{name:'Ångra',exact:true}).click();const restored=parse(await page.getByRole('textbox',{name:'Låtfilens text'}).inputValue()).delar[0].takter[0];expect(restored.ackord).toBe('C G');expect(restored.varianter[0].ackord).toBe('F Am');
});
test('Ctrl-click subset duplicates only the selected measures in source order',async({page})=>{
 await openFixture(page);await page.locator('.bar-number-hit[data-section="0"][data-bar="0"]').click();
 await page.locator('.paper .bar-number-hit[data-section="0"][data-bar="1"]').click({modifiers:['Control']});await page.locator('.paper .bar-number-hit[data-section="0"][data-bar="3"]').click({modifiers:['Control']});
 await expect(page.locator('.score-selected-number')).toHaveCount(3);
 await page.getByRole('button',{name:'Duplicera valda takter',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const bars=parse(await sourceText(page)).delar[0].takter;expect(bars).toHaveLength(7);expect(bars.slice(4).map((b:string|{ackord:string})=>barData(b).ackord)).toEqual(['C G',barData(bars[1]).ackord,'F']);
 await page.getByRole('button',{name:'Ångra',exact:true}).click();expect(parse(await page.getByRole('textbox',{name:'Låtfilens text'}).inputValue()).delar[0].takter).toHaveLength(4);
});
test('invalid active draft blocks saving and PDF export without writing the fixture',async({page})=>{
 await openFixture(page);await editLine(main(page,1),page);await page.locator('#score-edit').fill('Dm9');await page.locator('#score-edit').press('Enter');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 await page.locator('.bar-number-hit[data-section="0"][data-bar="1"]').click();await editLine(main(page,1),page);await page.locator('#score-edit').fill('H7');
 const before=await readFile(fixture,'utf8'),writes:string[]=[];
 page.on('request',request=>{if(request.method()==='PUT'&&request.url().endsWith('/api/songs/'+fixtureId))writes.push('save');if(request.method()==='POST'&&request.url().endsWith('/api/render')&&request.postDataJSON()?.format==='pdf')writes.push('pdf');});
 const pdf=page.getByRole('button',{name:'Exportera PDF',exact:true});if(await pdf.isEnabled())await pdf.click();else await page.locator('#score-edit').press('Enter');await expect(page.getByRole('alert').filter({visible:true}).first()).toBeVisible();await expect(page.locator('#score-edit')).toHaveValue('H7');
 const save=page.getByRole('button',{name:'Spara',exact:true});if(await save.isEnabled())await save.click();else await expect(save).toBeDisabled();await expect(page.locator('#score-edit')).toHaveValue('H7');expect(await readFile(fixture,'utf8')).toBe(before);expect(writes).toEqual([]);
 await page.locator('#score-edit').press('Escape');
});
test('Live flushes a valid pending score edit and uses its unsaved source',async({page})=>{
 await page.route('**/api/setlists',route=>route.fulfill({json:{lists:[{id:'c11ec221-69c8-43fb-a9a2-0282928e9a53',name:'Bladtest live',songs:[fixtureId]}],revision:'0'}}));
 await openFixture(page);const saved=await readFile(fixture,'utf8');await page.getByRole('button',{name:'Setlistor',exact:true}).click();await page.getByRole('button',{name:/Bladtest live/}).click();await editLine(main(page,1),page);await page.locator('#score-edit').fill('Dm9');
 await page.getByRole('button',{name:'Live',exact:true}).dispatchEvent('click');
 const live=page.getByRole('dialog',{name:'Live: Bladtest live',exact:true});await expect(live.locator('figure').first()).toContainText('Dm9');await page.keyboard.press('Escape');
 await expect(live).toHaveCount(0);expect(barData(parse(await sourceText(page)).delar[0].takter[1]).ackord).toBe('Dm9');expect(await readFile(fixture,'utf8')).toBe(saved);
});
test('Song fields and displayed score reflect undo of a global title edit',async({page})=>{
 await openFixture(page);await page.locator('.global-nav').getByRole('button',{name:'Låt',exact:true}).click();
 const title=page.getByRole('textbox',{name:'Titel',exact:true});await expect(title).toHaveValue(fixtureTitle);await title.fill('Kontrollerad titel');await title.press('Tab');
 await expect(page.locator('.live-label')).toHaveText('Uppdaterad');await expect(page.locator('.paper').first()).toContainText('Kontrollerad titel');
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(title).toHaveValue(fixtureTitle);await expect(page.locator('.live-label')).toHaveText('Uppdaterad');await expect(page.locator('.paper').first()).toContainText(fixtureTitle);
 expect(parse(await sourceText(page)).titel).toBe(fixtureTitle);
});
test('measure number remains clickable while contextual chord tools are shown',async({page})=>{
 await openFixture(page);await main(page,0,1).click();await expect(page.getByRole('group',{name:'Ackordverktyg',exact:true})).toBeVisible();
 const strip=page.locator('.paper .bar-number-hit[data-section="0"][data-bar="0"]');const point=await strip.evaluate(el=>{const r=el.getBoundingClientRect(),number=el.getAttribute('data-number');const text=[...el.closest('svg')!.querySelectorAll('text')].find(t=>{const b=t.getBoundingClientRect();return t.textContent===number&&b.x>=r.x&&b.x+b.width<=r.right+1&&b.y>=r.y-1&&b.y+b.height<=r.bottom+1;});if(!text)throw Error('Visible measure-number glyph missing');const b=text.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};});await page.mouse.click(point.x,point.y);
 await expect(page.locator('#score-edit,#variant-edit')).toHaveCount(0);await expect(page.getByRole('group',{name:'Ackordverktyg',exact:true})).toHaveCount(0);await expect(page.getByRole('group',{name:'Taktverktyg',exact:true})).toBeVisible();
});
test('external valid source edit removes a selected measure without leaving a stale target or crash',async({page})=>{
 const errors=await openFixture(page);await page.locator('.bar-number-hit[data-section="0"][data-bar="3"]').click();
 const original=await sourceText(page),editor=page.getByRole('textbox',{name:'Låtfilens text'});await editor.fill(original.replace('      - F\n',''));
 await expect(page.locator('.live-label')).toHaveText('Uppdaterad');await expect(page.locator('.paper').first()).toContainText(fixtureTitle);await expect(page.locator('.paper .bar-number-hit[data-section="0"][data-bar="3"]')).toHaveCount(0);
 await expect(page.getByRole('group',{name:'Taktverktyg',exact:true})).toHaveCount(0);expect(parse(await editor.inputValue()).delar[0].takter).toHaveLength(3);expect(errors).toEqual([]);
});
test('invalid title remains blocked after other valid Song fields change until that title is corrected',async({page})=>{
 await openFixture(page);await page.locator('.global-nav').getByRole('button',{name:'Låt',exact:true}).click();
 const title=page.getByRole('textbox',{name:'Titel',exact:true}),artist=page.getByRole('textbox',{name:'Artist',exact:true}),saved=await readFile(fixture,'utf8'),requests:string[]=[];
 page.on('request',request=>{if(request.method()==='PUT'&&request.url().endsWith('/api/songs/'+fixtureId))requests.push('save');if(request.method()==='POST'&&request.url().endsWith('/api/render')&&request.postDataJSON()?.format==='pdf')requests.push('pdf');});
 await title.fill('');await artist.focus();await expect(title).toHaveAttribute('aria-invalid','true');
 await artist.fill('');await title.focus();await expect(artist).not.toHaveAttribute('aria-invalid','true');await expect(title).toHaveAttribute('aria-invalid','true');
 await artist.fill('Ändrad artist');await page.getByRole('button',{name:'Spara',exact:true}).dispatchEvent('click');await expect(title).toHaveAttribute('aria-invalid','true');await expect(page.getByRole('alert').filter({visible:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'Exportera PDF',exact:true}).dispatchEvent('click');await expect(title).toHaveAttribute('aria-invalid','true');expect(requests).toEqual([]);expect(await readFile(fixture,'utf8')).toBe(saved);
 await title.fill(fixtureTitle);await title.press('Tab');await expect(title).not.toHaveAttribute('aria-invalid','true');await page.getByRole('button',{name:'Spara',exact:true}).dispatchEvent('click');
 await expect(page.getByRole('status').filter({hasText:'Sparad i låtbiblioteket'})).toHaveText('Sparad i låtbiblioteket');expect(requests).toEqual(['save']);expect(parse(await readFile(fixture,'utf8'))).toMatchObject({titel:fixtureTitle,artist:'Ändrad artist'});
});
test('deleting an owned main chord asks first and preserves remaining start rhythm and one undo',async({page})=>{
 await openFixture(page);await main(page).click();await page.getByRole('button',{name:'Mer',exact:true}).click();page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Ta bort ackord',exact:true}).click();expect(await sourceText(page)).toBe(content);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Ta bort ackord',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const b=parse(await sourceText(page)).delar[0].takter[0];expect(b).toMatchObject({ackord:'G',slag:[3],rytm:[{slag:1,notvarde:4}],repris_start:true});expect(b.varianter).toBeUndefined();
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(page.getByRole('textbox',{name:'Låtfilens text'})).toHaveValue(content);
});
test('deleting a middle chord preserves remaining starts and remaps fermata and syncopation',async({page})=>{
 await openFixture(page);const original=await sourceText(page),editor=page.getByRole('textbox',{name:'Låtfilens text'});
 await editor.fill(original.replace('      - Dm # Kommentar om en enkel takt','      - ackord: Dm G Bm # Kommentar om en enkel takt\n        slag: [1, 2, 4]\n        synkop: { typ: offbeat, ackord: 3 }\n        fermat: 3'));await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const before=await editor.inputValue();await main(page,1,1).click();await page.getByRole('button',{name:'Mer',exact:true}).click();await page.getByRole('button',{name:'Ta bort ackord',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const song=parse(await editor.inputValue());expect(song.delar[0].takter[1]).toMatchObject({ackord:'Dm Bm',slag:[1,4],fermat:2,synkop:{typ:'offbeat',ackord:2}});expect(song.delar[0].takter[0].rytm).toEqual([{slag:1,notvarde:4}]);
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(editor).toHaveValue(before);
});
test('keeping a typed-away final owner is rejected and explicit removal preserves other variants',async({page})=>{
 await openFixture(page);await main(page,0,1).click();await page.getByRole('group',{name:'Ackordverktyg',exact:true}).getByRole('button',{name:'Variantackord',exact:true}).click();
 await page.locator('#variant-edit').fill('Dm');await page.locator('#variant-edit').press('Enter');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');const withVariant=await sourceText(page);
 await page.locator('.bar-number-hit[data-section="0"][data-bar="0"]').click();await editLine(main(page),page);await page.locator('#score-edit').fill('C');await page.locator('#score-edit').press('Enter');
 const dialog=page.locator('.variant-confirm');await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Behåll varianter',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('borttaget');
 await expect(page.locator('textarea[aria-label="Låtfilens text"]')).toHaveValue(withVariant);await dialog.getByRole('button',{name:'Ta bort berörda varianter',exact:true}).click();await expect(dialog).toHaveCount(0);
 const b=parse(await page.locator('textarea[aria-label="Låtfilens text"]').inputValue()).delar[0].takter[0];expect(b.ackord).toBe('C');expect(b.varianter).toHaveLength(1);expect(b.varianter[0]).toMatchObject({ackord:'F Am',ackord_nr:1,slag:[1,2]});expect(b.rytm).toEqual([{slag:1,notvarde:4}]);
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(page.locator('textarea[aria-label="Låtfilens text"]')).toHaveValue(withVariant);
});
test('recent chord inserts after selection on a free grid slot without moving existing chords or variants',async({page})=>{
 await openFixture(page);await main(page).click();await page.getByLabel('Notvärde för ackordets placeringssteg',{exact:true}).selectOption('8');await page.getByRole('button',{name:'Lägg till ackord',exact:true}).click();
 await page.locator('.score-recent').getByRole('button',{name:'Dm',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 await expect(page.getByRole('group',{name:'Ackordverktyg',exact:true})).toContainText('Dm');await expect(page.locator('.paper .score-selected-hit[data-section="0"][data-bar="0"][data-chord="1"]:not([data-variant])')).toHaveCount(1);
 const changed=await sourceText(page),b=parse(changed).delar[0].takter[0],original=parse(content).delar[0].takter[0];expect(b.ackord).toBe('C Dm G');expect(b.slag).toEqual([1,2.5,3]);expect(b.varianter).toEqual(original.varianter);expect(b.rytm).toEqual(original.rytm);
 for(const comment of ['Kommentar om huvudnotens längd','Kommentar om variantharmonik','Kommentar om variantnotens längd'])expect(changed).toContain(comment);
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(page.getByRole('textbox',{name:'Låtfilens text'})).toHaveValue(content);
});
test('Plus measure opens and focuses its new blank row after rendering while Escape retains insertion',async({page})=>{
 await openFixture(page);await page.locator('.bar-number-hit[data-section="0"][data-bar="3"]').click();await page.locator('.paper .bar-number-hit[data-section="0"][data-bar="3"]').hover();await page.getByRole('button',{name:'Ny tom takt efter takt 4',exact:true}).click();
 const input=page.locator('#score-edit');await expect(input).toHaveValue('');await expect(input).toBeFocused();await input.press('Escape');await expect(input).toHaveCount(0);await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const bars=parse(await sourceText(page)).delar[0].takter;expect(bars).toHaveLength(5);expect(barData(bars[1]).ackord).toBe('Dm');expect(barData(bars[2]).ackord).toBe('');expect(barData(bars[3]).ackord).toBe('F');expect(barData(bars[4]).ackord).toBe('');
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(page.getByRole('textbox',{name:'Låtfilens text'})).toHaveValue(content);
});
test('pending save disables Song fields and displays exactly the saved metadata afterward',async({page})=>{
 await openFixture(page);await page.locator('.global-nav').getByRole('button',{name:'Låt',exact:true}).click();const title=page.getByRole('textbox',{name:'Titel',exact:true}),artist=page.getByRole('textbox',{name:'Artist',exact:true});await artist.fill('Sparad artist');
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);await page.route('**/api/songs/'+fixtureId,async route=>{if(route.request().method()==='PUT')await gate;await route.continue();});
 const request=page.waitForRequest(r=>r.method()==='PUT'&&r.url().endsWith('/api/songs/'+fixtureId));await page.getByRole('button',{name:'Spara',exact:true}).click();await request;
 let failure:unknown;try{await expect(title).toBeDisabled();await expect(artist).toBeDisabled();await expect(page.locator('.bottom-status')).not.toHaveText('Sparad i låtbiblioteket');await artist.focus();await page.keyboard.type('Osparad artist');await expect(artist).toHaveValue('Sparad artist');}catch(e){failure=e;}finally{release();}
 await expect(page.getByRole('status').filter({hasText:'Sparad i låtbiblioteket'})).toHaveText('Sparad i låtbiblioteket');await expect(title).toBeEnabled();await expect(artist).toBeEnabled();await expect(artist).toHaveValue('Sparad artist');expect(parse(await readFile(fixture,'utf8'))).toMatchObject({titel:fixtureTitle,artist:'Sparad artist'});if(failure)throw failure;
});
test('inline form drag reorders written and reused parts and one undo restores the source',async({page})=>{
 await openFixture(page);const blocks=page.locator('.score-form li');await expect(blocks.locator('strong')).toHaveText(['Vers','Vers × 2','Coda']);await expect(blocks.nth(2)).toHaveAttribute('draggable','true');
 await blocks.nth(2).dragTo(blocks.nth(0));await expect(blocks.locator('strong')).toHaveText(['Coda','Vers','Vers × 2']);await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const source=await sourceText(page),song=parse(source);expect(song.delar.map((part:{namn?:string;ateranvand?:string})=>part.ateranvand??part.namn)).toEqual(['Coda','Vers','Vers']);expect(song.delar[2].ganger).toBe(2);expect(song.delar[2].anvisning).toBe('Solo');
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(blocks.locator('strong')).toHaveText(['Vers','Vers × 2','Coda']);await expect(page.getByRole('textbox',{name:'Låtfilens text'})).toHaveValue(content);
});
test('Ctrl Cmd Shift and keyboard select measures without checkboxes',async({page})=>{
 await openFixture(page);const number=(bar:number)=>page.locator(`.paper .bar-number-hit[data-section="0"][data-bar="${bar}"]`);
 await expect(page.locator('.score-bar-tools input')).toHaveCount(0);
 await number(0).click();await number(3).click({modifiers:['Shift']});await expect(page.locator('.score-selected-number')).toHaveCount(4);
 await number(1).click({modifiers:['Control']});await expect(page.locator('.score-selected-number')).toHaveCount(3);
 await number(2).click({modifiers:['Meta']});await expect(page.locator('.score-selected-number')).toHaveCount(2);
 await number(1).focus();await page.keyboard.press('Control+Space');await expect(page.locator('.score-selected-number')).toHaveCount(3);
 await expect(page.getByRole('button',{name:'Duplicera valda takter',exact:true})).toBeVisible();
});
test('new variant keeps its writing field focused when the new small row reaches the renderer',async({page})=>{
 await openFixture(page);await main(page,0,1).click();await page.getByRole('group',{name:'Ackordverktyg',exact:true}).getByRole('button',{name:'Variantackord',exact:true}).click();const input=page.locator('#variant-edit');await expect(input).toHaveValue('');await expect(input).toBeFocused();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');await expect(page.locator('.paper .variant-area-hit[data-section="0"][data-bar="0"][data-variant="1"]')).toHaveCount(1);await expect(input).toBeFocused();
 await input.pressSequentially('Dm Em');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');await expect(input).toBeFocused();await expect(input).toHaveValue('Dm Em');await input.press('Enter');const b=parse(await sourceText(page)).delar[0].takter[0];expect(b.varianter[1]).toMatchObject({ackord_nr:2,ackord:'Dm Em',slag:[3,4]});expect(b.varianter[0]).toEqual(parse(content).delar[0].takter[0].varianter[0]);
});
test.describe('touch measure selection',()=>{
 test.use({hasTouch:true,isMobile:true,viewport:{width:375,height:844}});
 test('number taps toggle a same-part subset without checkboxes',async({page})=>{
  await openFixture(page);await expect(page.locator('.score-bar-tools input')).toHaveCount(0);
  const tap=async(bar:number)=>{const hit=page.locator(`.paper .bar-number-hit[data-section="0"][data-bar="${bar}"]`),box=await hit.boundingBox();await hit.tap({position:{x:3,y:box!.height/2}});};
  await tap(0);await tap(1);await expect(page.locator('.score-selected-number')).toHaveCount(2);await expect(page.getByRole('button',{name:'Duplicera valda takter',exact:true})).toBeVisible();
  await tap(0);await expect(page.locator('.score-selected-number')).toHaveCount(1);await expect(page.locator('.score-selected-number')).toHaveAttribute('data-bar','1');await expect(page.locator('#score-edit,#variant-edit')).toHaveCount(0);
 });
});
test('mobile Zoom100 confines the writing field to the visible viewport and preserves Escape and saving',async({page})=>{
 await page.setViewportSize({width:375,height:844});await openFixture(page);await page.getByLabel('Zoom',{exact:true}).selectOption('100');expect((await page.locator('.paper').first().boundingBox())!.width).toBeCloseTo(794,0);
 const area=page.locator('.paper-scroll'),before=await area.evaluate(el=>el.scrollLeft);await editLine(main(page,1),page);const input=page.locator('#score-edit');await expect(input).toBeFocused();await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));const bounds=await input.boundingBox(),viewport=await area.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(viewport!.x-1);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(viewport!.x+viewport!.width+1);
 await input.press('Escape');await expect(input).toHaveCount(0);expect(await area.evaluate(el=>el.scrollLeft)).toBe(before);
 await editLine(main(page,1),page);await input.fill('Dm7');await input.press('Control+s');await expect(page.getByRole('status').filter({hasText:'Sparad i låtbiblioteket'})).toHaveText('Sparad i låtbiblioteket');expect(barData(parse(await readFile(fixture,'utf8')).delar[0].takter[1]).ackord).toBe('Dm7');expect((await page.locator('.paper').first().boundingBox())!.width).toBeCloseTo(794,0);
});
test('same click point near the lower viewport edge still edits without dock resizing the canvas',async({page})=>{
 await openFixture(page);const target=page.locator('.paper .chord-hit[data-section="2"][data-bar="0"][data-chord="0"]:not([data-variant])');
 await target.evaluate(el=>{const area=el.closest('.paper-stack')!.closest('.paper-scroll')!;const box=el.getBoundingClientRect(),view=area.getBoundingClientRect();area.scrollTop+=box.y+box.height/2-(view.bottom-22);});
 const area=page.locator('.paper-scroll'),height=await area.evaluate(el=>el.clientHeight),box=await target.boundingBox(),point={x:box!.x+box!.width/2,y:box!.y+box!.height/2};
 await page.mouse.click(point.x,point.y);await expect(page.getByRole('group',{name:'Ackordverktyg',exact:true})).toBeVisible();expect(await area.evaluate(el=>el.clientHeight)).toBe(height);const selected=await target.boundingBox();expect(selected!.x+selected!.width/2).toBeCloseTo(point.x,0);expect(selected!.y+selected!.height/2).toBeCloseTo(point.y,0);await expect(page.locator('.score-context-dock')).toHaveAttribute('data-placement','top');
 await page.mouse.click(point.x,point.y);await expect(page.locator('#score-edit')).toHaveValue('C');await expect(page.locator('#score-edit')).toBeFocused();expect(await area.evaluate(el=>el.clientHeight)).toBe(height);await page.locator('#score-edit').press('Escape');await expect(page.getByRole('group',{name:'Taktverktyg',exact:true})).toBeVisible();expect(await area.evaluate(el=>el.clientHeight)).toBe(height);
});
test('direct Liveläge flushes the current unsaved line and returns to the editor without saving the song',async({page})=>{
 await openFixture(page);const saved=await readFile(fixture,'utf8');await expect(page.getByRole('button',{name:'Förhandsgranska utskrift',exact:true})).toHaveCount(0);await editLine(main(page,1),page);await page.locator('#score-edit').fill('Dm9');await page.getByRole('button',{name:'Liveläge',exact:true}).dispatchEvent('click');
 const live=page.locator('.live-view');await expect(live).toBeVisible();await expect(live.locator('figure').first()).toContainText('Dm9');await page.keyboard.press('Escape');await expect(live).toHaveCount(0);expect(barData(parse(await sourceText(page)).delar[0].takter[1]).ackord).toBe('Dm9');expect(await readFile(fixture,'utf8')).toBe(saved);
});
test('direct Liveläge rejects an invalid active line and retains the writing field',async({page})=>{
 await openFixture(page);await editLine(main(page,1),page);await page.locator('#score-edit').fill('H7');await page.getByRole('button',{name:'Liveläge',exact:true}).dispatchEvent('click');await expect(page.locator('.live-view')).toHaveCount(0);await expect(page.locator('#score-edit')).toHaveValue('H7');await expect(page.getByRole('alert').filter({visible:true}).first()).toBeVisible();await page.locator('#score-edit').press('Escape');expect(await sourceText(page)).toBe(content);
});
test('opening direct Liveläge from editor fullscreen exits fullscreen before presenting Live',async({page})=>{
 await openFixture(page);await page.getByRole('button',{name:'Helskärm',exact:true}).click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);await page.getByRole('button',{name:'Liveläge',exact:true}).click();await expect(page.locator('.live-view')).toBeVisible();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);await page.keyboard.press('Escape');await expect(page.locator('.live-view')).toHaveCount(0);await expect(page.getByRole('button',{name:'Helskärm',exact:true})).toBeVisible();
});
test('selected variant exposes removal of its full row and one undo restores its harmony and rhythm',async({page})=>{
 await openFixture(page);await variant(page).click();await page.getByRole('button',{name:'Variantrad',exact:true}).click();await page.getByRole('button',{name:'Ta bort variantraden',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');const b=parse(await sourceText(page)).delar[0].takter[0];expect(b.varianter).toBeUndefined();expect(b).toMatchObject({ackord:'C G',slag:[1,3],rytm:[{slag:1,notvarde:4}],repris_start:true});
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(page.getByRole('textbox',{name:'Låtfilens text'})).toHaveValue(content);
});
test('instruction text hits edit the intended measure section or reused occurrence and support undo',async({page})=>{
 await openFixture(page);await sourceText(page);const configured=content.replace('  - namn: Vers # Kommentar om låtdelen','  - namn: Vers # Kommentar om låtdelen\n    anvisning: Lugnt').replace('      - Dm # Kommentar om en enkel takt','      - ackord: Dm # Kommentar om en enkel takt\n        anvisning: walking');const editor=page.getByRole('textbox',{name:'Låtfilens text'});await editor.fill(configured);await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 for(const scope of ['bar','section','reuse']){
  await page.locator(`.paper .instruction-hit[data-scope="${scope}"]`).first().click();const input=page.locator('#score-instruction-edit');await expect(input).toBeFocused();await input.fill('Ny anvisning '+scope);await input.press('Enter');await expect(input).toHaveCount(0);await expect(page.locator('.live-label')).toHaveText('Uppdaterad');const song=parse(await editor.inputValue());
  expect(song.delar[0].takter[1].anvisning).toBe(scope==='bar'?'Ny anvisning bar':'walking');expect(song.delar[0].anvisning).toBe(scope==='section'?'Ny anvisning section':'Lugnt');expect(song.delar[1].anvisning).toBe(scope==='reuse'?'Ny anvisning reuse':'Solo');await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(editor).toHaveValue(configured);await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 }
});
test('empty instructions add no visible drawing or layout reservation',async({page})=>{
 await openFixture(page);await sourceText(page);const editor=page.getByRole('textbox',{name:'Låtfilens text'}),absent=content.replace('    anvisning: Solo\n','');await editor.fill(absent);await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const drawing=()=>page.locator('.paper svg').evaluateAll(svgs=>svgs.map(svg=>({viewBox:svg.getAttribute('viewBox'),nodes:[...svg.querySelectorAll('text,line,path,circle,rect,ellipse')].filter(el=>![...el.classList].some(name=>name.endsWith('-hit'))).map(el=>({tag:el.tagName,text:el.textContent,attrs:[...el.attributes].map(a=>[a.name,a.value]).sort((a,b)=>a[0].localeCompare(b[0]))}))})));const baseline=await drawing();
 const empty=absent.replace('  - namn: Coda\n','  - namn: Coda\n    anvisning: ""\n').replace('    takter: [C]\n','    takter: [{ ackord: C, anvisning: "" }]\n').replace('    ganger: 2\n','    ganger: 2\n    anvisning: ""\n');await editor.fill(empty);await expect(page.locator('.live-label')).toHaveText('Uppdaterad');expect(await drawing()).toEqual(baseline);await expect(page.locator('.paper .instruction-hit')).toHaveCount(0);
});
test('legacy return instruction changes its form step while retaining the written part instruction',async({page})=>{
 await openFixture(page);await sourceText(page);const editor=page.getByRole('textbox',{name:'Låtfilens text'}),configured=`format: 1\ntitel: ${fixtureTitle}\nartist: Testartist\ngrundtonart: C\ntaktart: 4/4\ndelar:\n  - namn: A\n    anvisning: DEL SOLO\n    takter: [C]\nspelordning:\n  - del: A\n    ganger: 1\n  - del: A\n    ganger: 2\n    anvisning: LEGACY RETUR\n`;
 await editor.fill(configured);await expect(page.locator('.live-label')).toHaveText('Uppdaterad');await page.locator('.paper .instruction-hit[data-form-step="1"]').click();const input=page.locator('#score-instruction-edit');await expect(input).toHaveValue('LEGACY RETUR');await expect(input).toBeFocused();await input.fill('LEGACY NY');await input.press('Enter');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');const song=parse(await editor.inputValue());expect(song.spelordning[1].anvisning).toBe('LEGACY NY');expect(song.delar[0].anvisning).toBe('DEL SOLO');await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(editor).toHaveValue(configured);
});
test('base and variant rhythm hits open the correct rhythm editors without changing neighboring scope',async({page})=>{
 await openFixture(page);await page.locator('.paper .rhythm-hit[data-section="0"][data-bar="0"]:not([data-variant])').click();await page.getByLabel('Notvärde för anslag 1',{exact:true}).selectOption('8');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');const source=await sourceText(page),first=parse(source).delar[0].takter[0];expect(first.rytm).toEqual([{slag:1,notvarde:8}]);expect(first.varianter[0].rytm).toEqual([{slag:1.5,notvarde:8}]);
 await page.keyboard.press('Escape');await page.locator('.paper .rhythm-hit[data-section="0"][data-bar="0"][data-variant="0"]').click();await page.getByLabel('Notvärde för anslag 1.5',{exact:true}).selectOption('16');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');const second=parse(await page.getByRole('textbox',{name:'Låtfilens text'}).inputValue()).delar[0].takter[0];expect(second.rytm).toEqual([{slag:1,notvarde:8}]);expect(second.varianter[0].rytm).toEqual([{slag:1.5,notvarde:16}]);await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(page.getByRole('textbox',{name:'Låtfilens text'})).toHaveValue(source);
});
test('syncopation hit edits its existing pattern instead of silently replacing it by separate rhythm',async({page})=>{
 await openFixture(page);await sourceText(page);const editor=page.getByRole('textbox',{name:'Låtfilens text'}),configured=content.replace('      - Dm # Kommentar om en enkel takt','      - ackord: Dm G # Kommentar om en enkel takt\n        slag: [1, 3]\n        synkop: { typ: offbeat, ackord: 2 }');await editor.fill(configured);await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 await page.locator('.paper .rhythm-hit[data-section="0"][data-bar="1"][data-rhythm-kind="offbeat"]').click();await expect(page.locator('.score-parameters')).toContainText(/synkop|föruttag/i);expect(parse(await editor.inputValue()).delar[0].takter[1]).toMatchObject({synkop:{typ:'offbeat',ackord:2}});expect(parse(await editor.inputValue()).delar[0].takter[1].rytm).toBeUndefined();
 await page.getByLabel('Synkopens typ',{exact:true}).selectOption('foruttag');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');await expect(page.locator('.paper .rhythm-hit[data-section="0"][data-bar="1"][data-rhythm-kind="foruttag"]')).toHaveCount(1);expect(parse(await editor.inputValue()).delar[0].takter[1]).toMatchObject({synkop:{typ:'foruttag',ackord:2}});await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(editor).toHaveValue(configured);
});

test('section layout tools shade written parts and toggle page breaks on definitions and returns',async({page})=>{
 await openFixture(page);await page.locator('.score-form li').nth(0).getByRole('button').click();
 const tools=page.getByRole('group',{name:'Delverktyg',exact:true});await tools.getByRole('button',{name:'Layout',exact:true}).click();await expect(tools.getByRole('button',{name:'Ny sida före delen',exact:true})).toBeDisabled();
 await tools.getByRole('button',{name:'Skugga delen',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 expect(parse(await sourceText(page)).delar[0].skuggad).toBe(true);await expect(tools.getByRole('button',{name:'Ta bort skuggning',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(page.getByRole('textbox',{name:'Låtfilens text'})).toHaveValue(content);
 await page.locator('.score-form li').nth(2).getByRole('button').click();await tools.getByRole('button',{name:'Layout',exact:true}).click();await tools.getByRole('button',{name:'Ta bort sidbrytning före delen',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 expect(parse(await sourceText(page)).delar[2].sidbrytning).toBeUndefined();await expect(page.locator('.paper')).toHaveCount(1);
 await page.locator('.score-form li').nth(1).getByRole('button').click();await expect(tools.getByRole('button',{name:'Skugga delen',exact:true})).toHaveCount(0);
 await tools.getByRole('button',{name:'Layout',exact:true}).click();await tools.getByRole('button',{name:'Ny sida före delen',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const song=parse(await sourceText(page));expect(song.delar[1].sidbrytning).toBe(true);expect(song.delar[0].sidbrytning).toBeUndefined();
});
test('measure meter picker adds 2/4 and arbitrary meters and rejects invalid pending input',async({page})=>{
 await openFixture(page);await page.locator('.bar-number-hit[data-section="0"][data-bar="1"]').click();await page.getByRole('button',{name:'Musik & tecken',exact:true}).click();await page.getByRole('button',{name:'Tonart och taktart',exact:true}).click();
 await page.getByLabel('Taktart i takten',{exact:true}).selectOption('2/4');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');expect(parse(await sourceText(page)).delar[0].takter[1].taktart).toBe('2/4');
 await page.getByLabel('Taktart i takten',{exact:true}).selectOption('custom');const input=page.getByLabel('Egen taktart i takten',{exact:true});await input.fill('5/8');await input.press('Enter');
 await expect(page.locator('.live-label')).toHaveText('Uppdaterad');expect(parse(await sourceText(page)).delar[0].takter[1].taktart).toBe('5/8');
 await input.fill('3/5');await input.press('Enter');await expect(input).toHaveAttribute('aria-invalid','true');await expect(page.getByRole('alert').filter({visible:true}).first()).toContainText('Ange taktart som');await page.getByRole('button',{name:'Spara',exact:true}).click();await expect(input).toBeFocused();expect(await readFile(fixture,'utf8')).toBe(content);
 await input.press('Escape');await page.getByRole('button',{name:'Ångra',exact:true}).click();expect(parse(await sourceText(page)).delar[0].takter[1].taktart).toBe('2/4');
});
test('variant settings edit voice and scope while keeping attack positions and original music',async({page})=>{
 await openFixture(page);await variant(page).click();await page.getByRole('button',{name:'Variantens inställningar',exact:true}).click();
 const voice=page.getByLabel('Stämma för varianten',{exact:true});await voice.fill('bas');await voice.press('Enter');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 await page.getByLabel('Variantens omfattning',{exact:true}).selectOption('bar');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const bar=parse(await sourceText(page)).delar[0].takter[0];expect(bar.ackord).toBe('C G');expect(bar.varianter[0]).toMatchObject({stamma:'bas',slag:[1,2],rytm:[{slag:1.5,notvarde:8}]});expect(bar.varianter[0].ackord_nr).toBeUndefined();
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');const previous=parse(await sourceText(page)).delar[0].takter[0].varianter[0];expect(previous.ackord_nr).toBe(1);expect(previous.stamma).toBe('bas');
});
test('whole-measure variants can be created from measure tools and additional passes retain the chosen scope',async({page})=>{
 await openFixture(page);await page.locator('.bar-number-hit[data-section="0"][data-bar="0"]').click();await page.getByRole('button',{name:'Musik & tecken',exact:true}).click();await page.getByRole('button',{name:'Variant för hela takten',exact:true}).click();
 const input=page.locator('#variant-edit');await expect(input).toBeFocused();await input.fill('Bb C/G');await input.press('Enter');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 let bar=parse(await sourceText(page)).delar[0].takter[0];expect(bar.varianter).toHaveLength(2);expect(bar.varianter[1].ackord).toBe('Bb C/G');expect(bar.varianter[1].ackord_nr).toBeUndefined();expect(bar.varianter[0].ackord_nr).toBe(1);
 await page.getByRole('button',{name:'Variantens inställningar',exact:true}).click();await page.getByLabel('Variantens omfattning',{exact:true}).selectOption('2');await expect(page.getByRole('alert').filter({visible:true}).first()).toContainText('ryms inte');await expect(page.getByLabel('Variantens omfattning',{exact:true})).toHaveValue('bar');
 await page.getByRole('button',{name:'Variantrad',exact:true}).click();await page.getByRole('button',{name:'Ny variantrad',exact:true}).click();await expect(input).toHaveValue('');await input.fill('Dm G7');await input.press('Enter');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 bar=parse(await sourceText(page)).delar[0].takter[0];expect(bar.varianter[2]).toMatchObject({gang:3,ackord:'Dm G7'});expect(bar.varianter[2].ackord_nr).toBeUndefined();
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');expect(parse(await sourceText(page)).delar[0].takter[0].varianter).toHaveLength(2);
});
async function referencesPanel(page:Page){await page.getByRole('button',{name:'Låt',exact:true}).click();await page.getByRole('button',{name:/Källor & arbetsanteckningar/}).click();}
test('song references offer add edit and remove actions with undo and multiline notes',async({page})=>{
 await openFixture(page);await referencesPanel(page);await page.getByRole('button',{name:'Redigera källa 1',exact:true}).click();await page.getByLabel('Källans webbadress',{exact:true}).fill('https://example.com/new-chart');await page.getByLabel('Beskrivning av källan',{exact:true}).fill('Kontrollerat ackordunderlag');await page.getByRole('button',{name:'Bekräfta källa',exact:true}).click();
 await page.getByRole('button',{name:'Lägg till arbetsanteckning',exact:true}).click();await page.getByLabel('Arbetsanteckning',{exact:true}).fill('Bas in i versen\nKontrollera avslutet');await page.getByRole('button',{name:'Bekräfta arbetsanteckning',exact:true}).click();
 await page.getByRole('button',{name:'Redigera arbetsanteckning 1',exact:true}).click();await page.getByLabel('Arbetsanteckning',{exact:true}).fill('Nytt arrangementsbeslut');await page.getByRole('button',{name:'Bekräfta arbetsanteckning',exact:true}).click();
 let song=parse(await sourceText(page));expect(song.kallor).toEqual([{url:'https://example.com/new-chart',beskrivning:'Kontrollerat ackordunderlag'}]);expect(song.anteckningar).toEqual(['Nytt arrangementsbeslut','Bas in i versen\nKontrollera avslutet']);expect(song.delar).toEqual(parse(content).delar);
 await page.getByRole('button',{name:'Ta bort källa 1',exact:true}).click();expect(parse(await sourceText(page)).kallor).toBeUndefined();await page.getByRole('button',{name:'Ångra',exact:true}).click();song=parse(await sourceText(page));expect(song.kallor).toHaveLength(1);
 await page.getByRole('button',{name:'Ta bort arbetsanteckning 2',exact:true}).click();expect(parse(await sourceText(page)).anteckningar).toEqual(['Nytt arrangementsbeslut']);
});
test('saving commits pending source and note drafts while invalid addresses stay editable',async({page})=>{
 await openFixture(page);await referencesPanel(page);await page.getByRole('button',{name:'Lägg till källa',exact:true}).click();const url=page.getByLabel('Källans webbadress',{exact:true});await url.fill('ogiltig');await page.getByRole('button',{name:'Spara',exact:true}).click();await expect(url).toBeFocused();await expect(page.getByRole('alert').filter({visible:true}).first()).toContainText('giltig webbadress');expect(await readFile(fixture,'utf8')).toBe(content);
 await url.fill('https://example.com/recording');await page.getByLabel('Beskrivning av källan',{exact:true}).fill('Inspelning från repetitionen');await page.getByRole('button',{name:'Spara',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Sparad i låtbiblioteket');expect(parse(await readFile(fixture,'utf8')).kallor).toHaveLength(2);
 await page.getByRole('button',{name:'Lägg till arbetsanteckning',exact:true}).click();const note=page.getByLabel('Arbetsanteckning',{exact:true});await note.fill('Första raden');await note.press('Enter');await note.press('End');await note.press('a');await expect(note).toBeVisible();await page.keyboard.press('Control+s');await expect(page.getByRole('status')).toHaveText('Sparad i låtbiblioteket');const saved=await readFile(fixture,'utf8');expect(parse(saved).anteckningar[1]).toBe('Första raden\na');expect(saved).toContain('# Kommentar om variantharmonik');
 await page.reload();await page.getByRole('button',{name:/Alla låtar/}).click();await page.getByRole('button',{name:new RegExp(fixtureTitle)}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');expect(parse(await sourceText(page)).kallor).toHaveLength(2);
});
test('new contextual controls and references remain usable on a narrow screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});await openFixture(page);await page.getByRole('button',{name:'Form',exact:true}).click();await page.locator('.score-form li').nth(2).getByRole('button').click();await page.getByRole('button',{name:'Layout',exact:true}).click();await page.getByRole('group',{name:'Delverktyg',exact:true}).getByRole('button',{name:'Skugga delen',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 await page.getByRole('button',{name:'Låt',exact:true}).click();await page.getByRole('button',{name:/Källor & arbetsanteckningar/}).click();await page.getByRole('button',{name:'Lägg till arbetsanteckning',exact:true}).click();await page.getByLabel('Arbetsanteckning',{exact:true}).fill('Mobil anteckning');await page.getByRole('button',{name:'Bekräfta arbetsanteckning',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'work/cache/editor-references-mobile.png'});const source=await sourceText(page);expect(parse(source).anteckningar.at(-1)).toBe('Mobil anteckning');expect(parse(source).delar[2].skuggad).toBe(true);
});
test('switching between underlay entries commits the previous draft and keeps the new editor open',async({page})=>{
 await openFixture(page);await referencesPanel(page);await page.getByRole('button',{name:'Redigera källa 1',exact:true}).click();await page.getByLabel('Beskrivning av källan',{exact:true}).fill('Kontrollerat underlag');await page.getByRole('button',{name:'Lägg till arbetsanteckning',exact:true}).click();
 const note=page.getByLabel('Arbetsanteckning',{exact:true});await expect(note).toBeVisible();await expect(note).toBeFocused();await note.fill('Kontrollera på repetition');await page.getByRole('button',{name:'Form',exact:true}).click();await expect(note).toHaveCount(0);const song=parse(await sourceText(page));expect(song.kallor[0].beskrivning).toBe('Kontrollerat underlag');expect(song.anteckningar.at(-1)).toBe('Kontrollera på repetition');
});

test('measure hover works across parts and pages after chord and section selection',async({page})=>{
 const errors=await openFixture(page);await main(page).click();
 const coda=page.locator('.paper .bar-number-hit[data-section="2"][data-bar="0"]');
 await coda.hover();await expect(page.getByRole('button',{name:'Duplicera takt 5',exact:true})).toBeVisible();
 await coda.click();await expect(page.locator('.score-selected-number')).toHaveCount(1);
 await expect(page.getByRole('group',{name:'Taktverktyg',exact:true})).toContainText('Coda · Takt 5');
 await coda.hover();await page.getByRole('button',{name:'Duplicera takt 5',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 expect(parse(await sourceText(page)).delar[2].takter).toEqual(['C','C']);await page.getByRole('button',{name:'Ångra',exact:true}).click();
 await page.locator('.score-form li').nth(1).getByRole('button').click();
 const first=page.locator('.paper .bar-number-hit[data-section="0"][data-bar="0"]');await first.hover();
 await expect(page.getByRole('button',{name:'Duplicera takt 1',exact:true})).toBeVisible();await first.click();
 await expect(page.getByRole('group',{name:'Taktverktyg',exact:true})).toContainText('Vers · Takt 1');expect(errors).toEqual([]);
});

test('named tool groups show one set of actions and preserve keyboard focus and selection',async({page})=>{
 await openFixture(page);await page.locator('.paper .bar-number-hit[data-section="0"][data-bar="1"]').click();
 const tools=page.getByRole('group',{name:'Taktverktyg',exact:true});await expect(tools.getByRole('button')).toHaveCount(6);
 await expect(page.getByRole('button',{name:'Coda',exact:true})).toHaveCount(0);
 const music=tools.getByRole('button',{name:'Musik & tecken',exact:true});await music.focus();await page.keyboard.press('Enter');await expect(music).toHaveAttribute('aria-expanded','true');
 await expect(tools.getByRole('button',{name:'Coda',exact:true})).toBeVisible();
 const layout=tools.getByRole('button',{name:'Layout',exact:true});await layout.click();await expect(music).toHaveAttribute('aria-expanded','false');await expect(tools.getByRole('button',{name:'Coda',exact:true})).toHaveCount(0);
 await tools.getByRole('button',{name:'Ny rad',exact:true}).focus();await page.keyboard.press('Escape');await expect(layout).toBeFocused();await expect(layout).toHaveAttribute('aria-expanded','false');await expect(tools).toBeVisible();
 await tools.getByRole('button',{name:'Repris & hus',exact:true}).click();await tools.getByRole('button',{name:'Första hus',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');expect(parse(await sourceText(page)).delar[0].takter[1].hus).toBeDefined();
 await main(page).click();await expect(tools).toHaveCount(0);await expect(page.getByRole('group',{name:'Ackordverktyg',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Visa taktverktyg',exact:true}).click();await expect(tools).toBeVisible();await expect(tools.getByRole('button',{name:'Repris & hus',exact:true})).toHaveAttribute('aria-expanded','false');
});

for(const width of [375,760,1512])test(`contextual tool layout at ${width}px stays within the viewport`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});await openFixture(page);await page.locator('.paper .bar-number-hit[data-section="0"][data-bar="1"]').click();
 const tools=page.getByRole('group',{name:'Taktverktyg',exact:true});await tools.getByRole('button',{name:'Musik & tecken',exact:true}).click();
 await expect(tools.getByRole('button',{name:'Slut',exact:true})).toBeVisible();
 expect(await tools.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 for(const button of await tools.getByRole('button').all()){
  const box=(await button.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(900);
 }
 await page.screenshot({path:testInfo.outputPath('measure-tools.png')});
 await main(page,1).click();await expect(tools).toHaveCount(0);const chord=page.getByRole('group',{name:'Ackordverktyg',exact:true});await chord.getByRole('button',{name:'Uttryck',exact:true}).click();
 expect(await chord.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.screenshot({path:testInfo.outputPath('chord-tools.png')});
 const strip=page.locator('.paper .bar-number-hit').first();await expect(strip).toHaveCSS('cursor','pointer');expect(await strip.evaluate(el=>getComputedStyle(el).fill)).not.toBe('rgba(0, 0, 0, 0)');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('parameter panels replace expanded groups and stay reachable in short windows',async({page})=>{
 await page.setViewportSize({width:1100,height:600});await openFixture(page);
 await page.locator('.paper .bar-number-hit[data-section="0"][data-bar="1"]').click();
 const music=page.getByRole('button',{name:'Musik & tecken',exact:true});await music.click();await page.getByRole('button',{name:'Rytm',exact:true}).click();
 const parameters=page.locator('.score-context-dock .score-parameters');await expect(parameters).toBeVisible();await expect(music).toHaveAttribute('aria-expanded','false');
 const box=(await parameters.boundingBox())!;expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(600);
 await page.getByRole('button',{name:'Stäng parametrar',exact:true}).click();await expect(parameters).toHaveCount(0);await expect(music).toHaveAttribute('aria-expanded','false');
 await music.click();await expect(page.getByRole('button',{name:'Rytm',exact:true})).toBeVisible();
});

test('desktop quick actions stay reachable across the hover boundary and edit the hovered part',async({page},testInfo)=>{
 const errors=await openFixture(page);await main(page).click();
 const number=page.locator('.paper .bar-number-hit[data-section="2"][data-bar="0"]');await number.hover();
 const quick=page.getByRole('group',{name:'Snabbverktyg för takt 5',exact:true});await expect(quick).toHaveCSS('opacity','1');
 const target=(await number.boundingBox())!,button=quick.getByRole('button',{name:'Duplicera takt 5',exact:true}),box=(await button.boundingBox())!;
 await page.mouse.move(target.x+target.width/2,target.y+target.height/2);await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:12});await expect(quick).toHaveCSS('opacity','1');
 const paper=await page.locator('.paper').last().boundingBox();await page.screenshot({path:testInfo.outputPath('desktop-hover.png')});await button.click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const changed=parse(await sourceText(page));expect(changed.delar[2].takter).toEqual(['C','C']);expect(changed.delar[0]).toEqual(parse(content).delar[0]);
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(page.getByRole('textbox',{name:'Låtfilens text'})).toHaveValue(content);expect(paper!.width).toBeGreaterThan(0);expect(errors).toEqual([]);
});

test('quick insert supports keyboard focus without selecting another measure first',async({page})=>{
 await openFixture(page);await page.mouse.move(0,0);const quick=page.getByRole('group',{name:'Snabbverktyg för takt 2',exact:true});await expect(quick).toHaveCSS('opacity','0');
 const insert=quick.getByRole('button',{name:'Ny tom takt efter takt 2',exact:true});await insert.focus();await expect(quick).toHaveCSS('opacity','1');await page.keyboard.press('Enter');
 const input=page.locator('#score-edit');await expect(input).toBeFocused();await input.fill('Em');await input.press('Enter');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const bars=parse(await sourceText(page)).delar[0].takter;expect(bars.map((b:string|{ackord:string})=>barData(b).ackord)).toEqual(['C G','Dm','Em','','F']);
});

test('multiple selection keeps operations together and suppresses per-measure shortcuts',async({page})=>{
 await openFixture(page);await page.locator('.paper .bar-number-hit[data-section="0"][data-bar="0"]').click();await page.locator('.paper .bar-number-hit[data-section="0"][data-bar="1"]').click({modifiers:['Control']});
 await expect(page.locator('.score-bar-quick')).toHaveCount(0);const tools=page.getByRole('group',{name:'Taktverktyg',exact:true});await expect(tools.getByRole('button',{name:'Ny tom takt efter markeringen',exact:true})).toBeVisible();await tools.getByRole('button',{name:'Duplicera valda takter',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const bars=parse(await sourceText(page)).delar[0].takter;expect(bars.map((b:string|{ackord:string})=>barData(b).ackord)).toEqual(['C G','Dm','C G','Dm','','F']);
});

test('desktop menus use compact icon rows while mobile retains labelled touch controls',async({page},testInfo)=>{
 await openFixture(page);const number=page.locator('.paper .bar-number-hit[data-section="0"][data-bar="1"]');await number.click();
 const tools=page.getByRole('group',{name:'Taktverktyg',exact:true}),before=await page.locator('.paper').first().boundingBox();
 expect((await tools.boundingBox())!.height).toBeLessThanOrEqual(42);expect((await tools.boundingBox())!.width).toBeLessThan(440);
 await expect(tools.getByRole('button',{name:'Skriv ackord',exact:true}).locator('.score-button-label')).toBeHidden();await tools.getByRole('button',{name:'Musik & tecken',exact:true}).click();
 expect((await tools.boundingBox())!.height).toBeLessThanOrEqual(80);for(const label of await tools.locator('.score-button-label').all())await expect(label).toBeHidden();
 expect(await page.locator('.paper').first().boundingBox()).toEqual(before);await page.screenshot({path:testInfo.outputPath('desktop-compact.png')});
 await page.setViewportSize({width:375,height:844});await expect(page.locator('.score-bar-quick')).toHaveCount(0);
 await expect(tools.getByRole('button',{name:'Ny tom takt efter markeringen',exact:true})).toBeVisible();await expect(tools.getByRole('button',{name:'Duplicera takten',exact:true})).toBeVisible();
 const write=tools.getByRole('button',{name:'Skriv ackord',exact:true});await expect(write.locator('.score-button-label')).toBeVisible();expect((await write.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('pen colors chords and a word in a reused part, persists, erases and undoes',async({page})=>{
 await openFixture(page);
 await page.getByRole('button',{name:'Markeringspenna',exact:true}).click();
 const chord=page.getByRole('button',{name:'Färgmarkera Ackord Dm',exact:true});
 await page.getByRole('button',{name:'Röd markeringspenna',exact:true}).click();await chord.click();
 await expect(page.locator('.live-label')).toHaveText('Uppdaterad');await expect(page.locator('.paper .score-highlight[fill="#f6b9b5"]')).toHaveCount(1);
 await page.getByRole('button',{name:'Blå markeringspenna',exact:true}).click();
 const text=page.getByRole('button',{name:'Färgmarkera Se Vers, takt 1–4. Spela 2 gånger.',exact:true});
 const b=await text.boundingBox();const data=JSON.parse((await text.getAttribute('data-highlight-target'))!);const scale=b!.width/data.positions.at(-1);
 await page.mouse.move(b!.x+data.positions[3]*scale,b!.y+b!.height/2);await page.mouse.down();await page.mouse.move(b!.x+data.positions[7]*scale,b!.y+b!.height/2,{steps:8});await page.mouse.up();
 await expect(page.locator('.live-label')).toHaveText('Uppdaterad');await expect(page.locator('.paper .score-highlight[fill="#b7d5fa"]')).toHaveCount(1);
 await page.screenshot({path:'work/cache/feedback-highlighter-desktop.png'});
 const source=await sourceText(page),song=parse(source);expect(song.delar[1].markeringar[0]).toMatchObject({farg:'bla',fran:3,till:7});expect(song.delar[0].takter[1].markeringar[0]).toMatchObject({element:'ackord:0',farg:'rod'});
 await page.getByRole('button',{name:'Spara',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Sparad i låtbiblioteket');
 await page.getByRole('button',{name:'Sudda färgmarkering',exact:true}).click();await chord.click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');await expect(page.locator('.paper .score-highlight[fill="#f6b9b5"]')).toHaveCount(0);
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');await expect(page.locator('.paper .score-highlight[fill="#f6b9b5"]')).toHaveCount(1);
 await page.reload();await page.getByRole('button',{name:/Alla låtar/}).click();await page.getByRole('button',{name:new RegExp(fixtureTitle)}).click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');await expect(page.locator('.paper .score-highlight')).toHaveCount(2);
 await page.getByRole('button',{name:'Liveläge',exact:true}).click();await expect(page.locator('.live-paper .score-highlight')).toHaveCount(2);await page.keyboard.press('Escape');
});
test('library collapses to give the score more width and chord tools offer instructions',async({page})=>{
 await openFixture(page);const before=(await page.locator('.score-preview').boundingBox())!.width;
 await page.getByRole('button',{name:'Dölj bibliotek',exact:true}).click();await expect(page.locator('.library-region')).not.toBeVisible();expect((await page.locator('.score-preview').boundingBox())!.width).toBeGreaterThan(before+100);
 await main(page,1).click();await page.getByRole('group',{name:'Ackordverktyg',exact:true}).getByRole('button',{name:'Anvisning',exact:true}).click();
 const input=page.getByLabel('Anvisning i takten',{exact:true});await input.fill('Vänta på sången');await input.press('Enter');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');await expect(page.locator('.paper').first()).toContainText('Vänta på sången');
 await page.getByRole('button',{name:'Visa bibliotek',exact:true}).click();await expect(page.locator('.library-region')).toBeVisible();
});

test('pen supports keyboard and a compact mobile palette',async({page})=>{
 await openFixture(page);await page.getByRole('button',{name:'Markeringspenna',exact:true}).click();
 const target=page.getByRole('button',{name:'Färgmarkera Ackord Dm',exact:true});await target.focus();await page.keyboard.press('Enter');await expect(page.locator('.paper .score-highlight')).toHaveCount(1);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Grön markeringspenna',exact:true}).click();await target.click();await expect(page.locator('.live-label')).toHaveText('Uppdaterad');await expect(page.locator('.paper .score-highlight[fill="#bce3ad"]')).toHaveCount(1);
 await page.getByRole('button',{name:'Avsluta färgmarkering',exact:true}).click();await page.getByRole('button',{name:'Markeringspenna',exact:true}).click();
 const palette=await page.locator('.score-pen').boundingBox();expect(palette!.x).toBeGreaterThanOrEqual(0);expect(palette!.x+palette!.width).toBeLessThanOrEqual(390);
 await page.screenshot({path:'work/cache/feedback-highlighter-mobile.png'});
});
