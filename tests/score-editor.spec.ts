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
 await expect(page.locator('.live-label')).toHaveText('Live');return errors;
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
 await expect(page.locator('.live-label')).toHaveText('Live');
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
 await expect(page.locator('.live-label')).toHaveText('Live');expect(barData(parse(await sourceText(page)).delar[0].takter[2]).ackord).toBe('Am Dm');
});
test('variant selection and editing retain base music independent starts and rhythm',async({page})=>{
 await openFixture(page);await editLine(variant(page,1),page);const input=page.locator('#variant-edit');await expect(input).toHaveValue('F Am');
 await input.fill('G Bm');await input.press('Enter');await expect(page.locator('.live-label')).toHaveText('Live');
 const b=parse(await sourceText(page)).delar[0].takter[0];expect(b.ackord).toBe('C G');expect(b.slag).toEqual([1,3]);expect(b.varianter[0]).toMatchObject({ackord:'G Bm',ackord_nr:1,slag:[1,2],rytm:[{slag:1.5,notvarde:8}]});expect(b.rytm).toEqual([{slag:1,notvarde:4}]);
});
test('switching from variant to its base selects first and edits on second click',async({page})=>{
 await openFixture(page);await variant(page).click();await main(page).click();await expect(page.locator('#score-edit,#variant-edit')).toHaveCount(0);
 await main(page).click();await expect(page.locator('#score-edit')).toHaveValue('C G');await page.locator('#score-edit').press('Escape');
 await variant(page).click();await expect(page.locator('#score-edit,#variant-edit')).toHaveCount(0);await variant(page).click();await expect(page.locator('#variant-edit')).toHaveValue('F Am');
});
test('preview editing preserves YAML comments source links and arrangement notes',async({page})=>{
 await openFixture(page);await editLine(main(page,0,1),page);await page.locator('#score-edit').fill('C Am');await page.locator('#score-edit').press('Enter');
 await expect(page.locator('.live-label')).toHaveText('Live');const changed=await sourceText(page);
 for(const comment of ['Arrangemangskommentar före låten','Kommentar om låtdelen','Kommentar om grundackorden','Kommentar om en enkel takt','Arrangemangskommentar efter låten'])expect(changed).toContain(comment);
 const song=parse(changed);expect(song.kallor).toEqual(parse(content).kallor);expect(song.anteckningar).toEqual(parse(content).anteckningar);expect(song.delar[0].takter[0].repris_start).toBe(true);expect(song.delar[1].ateranvand).toBe('Vers');
});
test('save flushes the active main line and reload restores its saved source',async({page})=>{
 await openFixture(page);await editLine(main(page,1),page);await page.locator('#score-edit').fill('Dm7');
 await expect(page.getByRole('button',{name:'Spara',exact:true})).toBeEnabled();await page.locator('#score-edit').press('Control+s');await expect(page.getByRole('status').filter({hasText:'Sparad i låtbiblioteket'})).toHaveText('Sparad i låtbiblioteket');
 expect(barData(parse(await readFile(fixture,'utf8')).delar[0].takter[1]).ackord).toBe('Dm7');
 await sourceText(page);await page.getByRole('button',{name:'Läs in på nytt',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Live');expect(barData(parse(await sourceText(page)).delar[0].takter[1]).ackord).toBe('Dm7');
});
test('print preview and PDF use the plain score without editor targets',async({page})=>{
 await openFixture(page);await expect(page.locator('.bar-number-hit').first()).toBeVisible();
 const toggle=page.getByRole('button',{name:'Förhandsgranska utskrift',exact:true});await toggle.click();
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
 await input.fill('Dm7');await input.press('Enter');await expect(page.locator('.live-label')).toHaveText('Live');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('measure duplicate preserves musical contents and omits repeat boundaries',async({page})=>{
 await openFixture(page);await page.locator('.bar-number-hit[data-section="0"][data-bar="0"]').click();
 await expect(page.locator('#score-edit,#variant-edit')).toHaveCount(0);await page.getByRole('button',{name:'Duplicera takten',exact:true}).click();
 await expect(page.locator('.live-label')).toHaveText('Live');const song=parse(await sourceText(page)),bars=song.delar[0].takter;
 expect(bars).toHaveLength(5);expect(bars[1].ackord).toBe('C G');expect(bars[1].varianter).toEqual(bars[0].varianter);expect(bars[1].rytm).toEqual(bars[0].rytm);expect(bars[0].repris_start).toBe(true);expect(bars[1].repris_start).toBeUndefined();
 await page.getByRole('button',{name:'Ångra',exact:true}).click();expect(parse(await page.getByRole('textbox',{name:'Låtfilens text'}).inputValue()).delar[0].takter).toHaveLength(4);
});
test('clear measure removes chords and owned variants while preserving signs and rhythm',async({page})=>{
 await openFixture(page);await page.locator('.bar-number-hit[data-section="0"][data-bar="0"]').click();
 await page.getByRole('button',{name:'Töm ackordraden',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Live');
 const cleared=parse(await sourceText(page)).delar[0].takter[0];expect(cleared.ackord).toBe('');expect(cleared.varianter).toBeUndefined();expect(cleared.repris_start).toBe(true);expect(cleared.rytm).toEqual([{slag:1,notvarde:4}]);
 await page.getByRole('button',{name:'Ångra',exact:true}).click();const restored=parse(await page.getByRole('textbox',{name:'Låtfilens text'}).inputValue()).delar[0].takter[0];expect(restored.ackord).toBe('C G');expect(restored.varianter[0].ackord).toBe('F Am');
});
test('checkbox subset duplicates only the selected measures in source order',async({page})=>{
 await openFixture(page);await page.locator('.bar-number-hit[data-section="0"][data-bar="0"]').click();
 await page.locator('.paper .bar-number-hit[data-section="0"][data-bar="1"]').hover();await page.getByRole('checkbox',{name:'Markera takt 2',exact:true}).check();await page.locator('.paper .bar-number-hit[data-section="0"][data-bar="3"]').hover();await page.getByRole('checkbox',{name:'Markera takt 4',exact:true}).check();
 await expect(page.getByRole('checkbox',{name:'Markera takt 5',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Duplicera valda takter',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Live');
 const bars=parse(await sourceText(page)).delar[0].takter;expect(bars).toHaveLength(7);expect(bars.slice(4).map((b:string|{ackord:string})=>barData(b).ackord)).toEqual(['C G',barData(bars[1]).ackord,'F']);
 await page.getByRole('button',{name:'Ångra',exact:true}).click();expect(parse(await page.getByRole('textbox',{name:'Låtfilens text'}).inputValue()).delar[0].takter).toHaveLength(4);
});
test('invalid active draft blocks saving and PDF export without writing the fixture',async({page})=>{
 await openFixture(page);await editLine(main(page,1),page);await page.locator('#score-edit').fill('Dm9');await page.locator('#score-edit').press('Enter');await expect(page.locator('.live-label')).toHaveText('Live');
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
 await expect(page.locator('.live-label')).toHaveText('Live');await expect(page.locator('.paper').first()).toContainText('Kontrollerad titel');
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(title).toHaveValue(fixtureTitle);await expect(page.locator('.live-label')).toHaveText('Live');await expect(page.locator('.paper').first()).toContainText(fixtureTitle);
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
 await expect(page.locator('.live-label')).toHaveText('Live');await expect(page.locator('.paper').first()).toContainText(fixtureTitle);await expect(page.locator('.paper .bar-number-hit[data-section="0"][data-bar="3"]')).toHaveCount(0);
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
 await openFixture(page);await main(page).click();page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Ta bort ackord',exact:true}).click();expect(await sourceText(page)).toBe(content);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Ta bort ackord',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Live');
 const b=parse(await sourceText(page)).delar[0].takter[0];expect(b).toMatchObject({ackord:'G',slag:[3],rytm:[{slag:1,notvarde:4}],repris_start:true});expect(b.varianter).toBeUndefined();
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(page.getByRole('textbox',{name:'Låtfilens text'})).toHaveValue(content);
});
test('deleting a middle chord preserves remaining starts and remaps fermata and syncopation',async({page})=>{
 await openFixture(page);const original=await sourceText(page),editor=page.getByRole('textbox',{name:'Låtfilens text'});
 await editor.fill(original.replace('      - Dm # Kommentar om en enkel takt','      - ackord: Dm G Bm # Kommentar om en enkel takt\n        slag: [1, 2, 4]\n        synkop: { typ: offbeat, ackord: 3 }\n        fermat: 3'));await expect(page.locator('.live-label')).toHaveText('Live');
 const before=await editor.inputValue();await main(page,1,1).click();await page.getByRole('button',{name:'Ta bort ackord',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Live');
 const song=parse(await editor.inputValue());expect(song.delar[0].takter[1]).toMatchObject({ackord:'Dm Bm',slag:[1,4],fermat:2,synkop:{typ:'offbeat',ackord:2}});expect(song.delar[0].takter[0].rytm).toEqual([{slag:1,notvarde:4}]);
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(editor).toHaveValue(before);
});
test('keeping a typed-away final owner is rejected and explicit removal preserves other variants',async({page})=>{
 await openFixture(page);await main(page,0,1).click();await page.getByRole('group',{name:'Ackordverktyg',exact:true}).getByRole('button',{name:'Variantackord',exact:true}).click();
 await page.locator('#variant-edit').fill('Dm');await page.locator('#variant-edit').press('Enter');await expect(page.locator('.live-label')).toHaveText('Live');const withVariant=await sourceText(page);
 await page.locator('.bar-number-hit[data-section="0"][data-bar="0"]').click();await editLine(main(page),page);await page.locator('#score-edit').fill('C');await page.locator('#score-edit').press('Enter');
 const dialog=page.locator('.variant-confirm');await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Behåll varianter',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('borttaget');
 await expect(page.locator('textarea[aria-label="Låtfilens text"]')).toHaveValue(withVariant);await dialog.getByRole('button',{name:'Ta bort berörda varianter',exact:true}).click();await expect(dialog).toHaveCount(0);
 const b=parse(await page.locator('textarea[aria-label="Låtfilens text"]').inputValue()).delar[0].takter[0];expect(b.ackord).toBe('C');expect(b.varianter).toHaveLength(1);expect(b.varianter[0]).toMatchObject({ackord:'F Am',ackord_nr:1,slag:[1,2]});expect(b.rytm).toEqual([{slag:1,notvarde:4}]);
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(page.locator('textarea[aria-label="Låtfilens text"]')).toHaveValue(withVariant);
});
test('recent chord inserts after selection on a free grid slot without moving existing chords or variants',async({page})=>{
 await openFixture(page);await main(page).click();await page.getByLabel('Notvärde för ackordets placeringssteg',{exact:true}).selectOption('8');await page.getByRole('button',{name:'Lägg till ackord',exact:true}).click();
 await page.locator('.score-recent').getByRole('button',{name:'Dm',exact:true}).click();await expect(page.locator('.live-label')).toHaveText('Live');
 await expect(page.getByRole('group',{name:'Ackordverktyg',exact:true})).toContainText('Dm');await expect(page.locator('.paper .score-selected-hit[data-section="0"][data-bar="0"][data-chord="1"]:not([data-variant])')).toHaveCount(1);
 const changed=await sourceText(page),b=parse(changed).delar[0].takter[0],original=parse(content).delar[0].takter[0];expect(b.ackord).toBe('C Dm G');expect(b.slag).toEqual([1,2.5,3]);expect(b.varianter).toEqual(original.varianter);expect(b.rytm).toEqual(original.rytm);
 for(const comment of ['Kommentar om huvudnotens längd','Kommentar om variantharmonik','Kommentar om variantnotens längd'])expect(changed).toContain(comment);
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(page.getByRole('textbox',{name:'Låtfilens text'})).toHaveValue(content);
});
test('Plus measure opens and focuses its new blank row after rendering while Escape retains insertion',async({page})=>{
 await openFixture(page);await page.locator('.bar-number-hit[data-section="0"][data-bar="3"]').click();await page.getByRole('button',{name:'Ny tom takt efter markeringen',exact:true}).click();
 const input=page.locator('#score-edit');await expect(input).toHaveValue('');await expect(input).toBeFocused();await input.press('Escape');await expect(input).toHaveCount(0);await expect(page.locator('.live-label')).toHaveText('Live');
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
 await blocks.nth(2).dragTo(blocks.nth(0));await expect(blocks.locator('strong')).toHaveText(['Coda','Vers','Vers × 2']);await expect(page.locator('.live-label')).toHaveText('Live');
 const source=await sourceText(page),song=parse(source);expect(song.delar.map((part:{namn?:string;ateranvand?:string})=>part.ateranvand??part.namn)).toEqual(['Coda','Vers','Vers']);expect(song.delar[2].ganger).toBe(2);expect(song.delar[2].anvisning).toBe('Solo');
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(blocks.locator('strong')).toHaveText(['Vers','Vers × 2','Coda']);await expect(page.getByRole('textbox',{name:'Låtfilens text'})).toHaveValue(content);
});
test('desktop checkboxes hide initially reveal on hover and remain reachable by keyboard',async({page})=>{
 await openFixture(page);await page.mouse.move(20,20);const first=page.getByRole('checkbox',{name:'Markera takt 1',exact:true}),second=page.getByRole('checkbox',{name:'Markera takt 2',exact:true}),firstLabel=page.locator('.score-bar-check').filter({has:first}),secondLabel=page.locator('.score-bar-check').filter({has:second});
 await expect(firstLabel).toHaveCSS('opacity','0');await expect(firstLabel).toHaveCSS('pointer-events','none');await main(page).hover();await expect(firstLabel).toHaveCSS('opacity','1');await expect(firstLabel).toHaveCSS('pointer-events','auto');await first.check();await page.mouse.move(20,20);await expect(firstLabel).toHaveCSS('opacity','0');await expect(first).toBeChecked();
 await page.keyboard.press('Tab');await second.focus();await expect(secondLabel).toHaveCSS('opacity','1');await page.keyboard.press('Space');await expect(second).toBeChecked();await expect(page.getByRole('button',{name:'Duplicera valda takter',exact:true})).toBeVisible();
});
test('new variant keeps its writing field focused when the new small row reaches the renderer',async({page})=>{
 await openFixture(page);await main(page,0,1).click();await page.getByRole('group',{name:'Ackordverktyg',exact:true}).getByRole('button',{name:'Variantackord',exact:true}).click();const input=page.locator('#variant-edit');await expect(input).toHaveValue('');await expect(input).toBeFocused();await expect(page.locator('.live-label')).toHaveText('Live');await expect(page.locator('.paper .variant-area-hit[data-section="0"][data-bar="0"][data-variant="1"]')).toHaveCount(1);await expect(input).toBeFocused();
 await input.pressSequentially('Dm Em');await expect(page.locator('.live-label')).toHaveText('Live');await expect(input).toBeFocused();await expect(input).toHaveValue('Dm Em');await input.press('Enter');const b=parse(await sourceText(page)).delar[0].takter[0];expect(b.varianter[1]).toMatchObject({ackord_nr:2,ackord:'Dm Em',slag:[3,4]});expect(b.varianter[0]).toEqual(parse(content).delar[0].takter[0].varianter[0]);
});
test.describe('touch measure selection',()=>{
 test.use({hasTouch:true,isMobile:true,viewport:{width:375,height:844}});
 test('number taps toggle a same-part subset without exposing other measure checkboxes',async({page})=>{
  await openFixture(page);const label=(number:number)=>page.locator('.score-bar-check').filter({has:page.getByRole('checkbox',{name:'Markera takt '+number,exact:true})});await expect(label(1)).toHaveCSS('opacity','0');
  const tap=async(bar:number)=>{const hit=page.locator(`.paper .bar-number-hit[data-section="0"][data-bar="${bar}"]`),box=await hit.boundingBox();await hit.tap({position:{x:3,y:box!.height/2}});};
  await tap(0);await expect(label(1)).toHaveCSS('opacity','1');await expect(label(2)).toHaveCSS('opacity','0');await tap(1);await expect(page.getByRole('checkbox',{name:'Markera takt 1',exact:true})).toBeChecked();await expect(page.getByRole('checkbox',{name:'Markera takt 2',exact:true})).toBeChecked();await expect(label(3)).toHaveCSS('opacity','0');await expect(page.getByRole('button',{name:'Duplicera valda takter',exact:true})).toBeVisible();
  await tap(0);await expect(page.getByRole('checkbox',{name:'Markera takt 1',exact:true})).not.toBeChecked();await expect(page.getByRole('checkbox',{name:'Markera takt 2',exact:true})).toBeChecked();await expect(label(1)).toHaveCSS('opacity','0');await expect(page.locator('#score-edit,#variant-edit')).toHaveCount(0);
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
