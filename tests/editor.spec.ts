import { test, expect } from '@playwright/test';
import { writeFile, unlink, readFile, mkdir } from 'node:fs/promises';
const fixture='songs/browser-check.yaml';
const content=`format: 1
titel: Webbläsartest
artist: Testartist
grundtonart: Abm
taktart: 4/4
tempo: 112
status: utkast
delar:
  - namn: Intro
    takter:
      - Abm6/9/Gb
      - Eb7alt
      - B6/9
      - Eb7
`;
test.beforeAll(async()=>{await mkdir('work/cache',{recursive:true});await writeFile(fixture,content,{flag:'wx'});});
test.afterAll(async()=>{await unlink(fixture);});
test('edit, insert, transpose, undo, save, reload and export PDF',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button',{name:/Webbläsartest/}).click();
  const editor=page.getByRole('textbox',{name:'Låtfilens text'});
  await expect(editor).toHaveValue(content);
  await expect(page.locator('.paper')).toHaveCount(1);
  await editor.evaluate((el:HTMLTextAreaElement)=>{el.focus();const pos=el.value.indexOf('Abm6/9/Gb');el.setSelectionRange(pos,pos);el.dispatchEvent(new Event('select',{bubbles:true}));});
  await editor.press('ArrowRight');
  await page.getByRole('button',{name:'BREAK',exact:true}).click();
  await expect(editor).toHaveValue(/break: true/);
  await page.getByRole('button',{name:'Transponera',exact:true}).click();
  await page.getByLabel('Måltonart',{exact:true}).selectOption('G');
  await page.getByRole('region',{name:'Transponera låten'}).getByRole('button',{name:'Transponera',exact:true}).click();
  await expect(editor).toHaveValue(/grundtonart: Gm/);
  await expect(editor).toHaveValue(/Gm6\/9\/F/);
  await page.getByRole('button',{name:'Ångra',exact:true}).click();
  await expect(editor).toHaveValue(/grundtonart: Abm/);
  await page.getByRole('button',{name:'Gör om',exact:true}).click();
  await expect(editor).toHaveValue(/grundtonart: Gm/);
  await page.getByRole('button',{name:'Spara',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Sparad i låtbiblioteket');
  expect(await readFile(fixture,'utf8')).toContain('grundtonart: Gm');
  await page.getByRole('button',{name:'Läs in på nytt'}).click();
  await expect(editor).toHaveValue(/Gm6\/9\/F/);
  await expect(page.locator('.paper')).toHaveCount(1);
  await expect(page.locator('.live-label')).toHaveText('Live');
  const valid=await editor.inputValue();
  await editor.fill(valid+'\ntempo: [fel\n');
  await expect(page.locator('.parse-error')).toBeVisible();
  await expect(page.getByRole('button',{name:'Spara',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Exportera PDF'})).toBeDisabled();
  await expect(page.locator('.paper')).toHaveCount(1);
  await editor.fill(valid);
  await expect(page.locator('.live-label')).toHaveText('Live');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exportera PDF'}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('browser-check.pdf');
  await download.saveAs('work/cache/browser-check.pdf');
  expect(errors).toEqual([]);
});
test('library search, unsaved navigation and narrow screen',async({page})=>{
  await page.goto('/');
  await page.getByRole('textbox',{name:'Sök låt eller artist'}).fill('Newkid');
  await expect(page.locator('.song-item')).toHaveCount(1);
  await page.getByRole('button',{name:/Du måste finnas/}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('Du måste finnas');
  const editor=page.getByRole('textbox',{name:'Låtfilens text'});
  await editor.fill((await editor.inputValue()).replace('tempo: 73','tempo: 74'));
  await page.getByRole('textbox',{name:'Sök låt eller artist'}).fill('');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:/Flykten från vardagen/}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('Du måste finnas');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:/Flykten från vardagen/}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('Flykten från vardagen');
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('button',{name:'Exportera PDF'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'outputs/editor-mobile.png',fullPage:true});
});
test('API rejects foreign-origin writes and stale revisions',async({request,baseURL})=>{
  const current=await (await request.get('/api/songs/browser-check.yaml')).json();
  const foreign=await request.put('/api/songs/browser-check.yaml',{headers:{origin:'https://example.com'},data:{text:content,revision:current.revision}});
  expect(foreign.status()).toBe(403);
  const stale=await request.put('/api/songs/browser-check.yaml',{headers:{origin:baseURL!},data:{text:content,revision:'stale'}});
  expect(stale.status()).toBe(409);
});
test('music buttons preserve the text viewport and edit the chosen bar',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/Webbläsartest/}).click();
  const editor=page.getByRole('textbox',{name:'Låtfilens text'});
  const long=content.slice(0,content.indexOf('      - Abm'))+Array.from({length:120},(_,i)=>`      - ${i===90?'Bb7':'C'} # ${'en lång kommentar '.repeat(6)}\n`).join('');
  await editor.fill(long);
  await editor.evaluate((el:HTMLTextAreaElement)=>{const pos=el.value.indexOf('Bb7');el.focus();el.setSelectionRange(pos,pos);el.dispatchEvent(new Event('select',{bubbles:true}));});
  await editor.press('ArrowRight');
  await editor.evaluate((el:HTMLTextAreaElement)=>{el.scrollTop=1600;el.scrollLeft=80;});
  const before=await editor.evaluate((el:HTMLTextAreaElement)=>({top:el.scrollTop,left:el.scrollLeft}));
  expect(before.top).toBeGreaterThan(0);
  for(const label of ['Reprisstart','Variantackord','Ackordslag','Egen rytm']){
    await page.getByRole('button',{name:label,exact:true}).click();
    await expect.poll(()=>editor.evaluate((el:HTMLTextAreaElement)=>({top:el.scrollTop,left:el.scrollLeft}))).toEqual(before);
    await page.waitForTimeout(150);
    expect(await editor.evaluate((el:HTMLTextAreaElement)=>({top:el.scrollTop,left:el.scrollLeft}))).toEqual(before);
    await expect(editor).toBeFocused();
  }
  await expect(editor).toHaveValue(/ackord: Bb7/);
  await expect(editor).toHaveValue(/varianter:/);
  await expect(page.locator('.parse-error')).toHaveCount(0);
  await expect(page.locator('.live-label')).toHaveText('Live');
});
test('reuse a section and insert N.C. and percent from the music toolbar',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Webbläsartest/}).click();
 const editor=page.getByRole('textbox',{name:'Låtfilens text'});await editor.fill(content);
 await page.getByRole('button',{name:'Återanvänd del',exact:true}).click();
 await page.getByLabel('Låtdel att återanvända').selectOption('Intro');
 await page.getByLabel('Antal gånger').selectOption('2');
 await page.getByRole('button',{name:'Lägg sist i formen'}).click();
 await expect(page.getByLabel('Spelordning',{exact:true})).toContainText('Intro → Intro × 2 → SLUT');
 await editor.evaluate((el:HTMLTextAreaElement)=>{const pos=el.value.indexOf('Abm6/9/Gb');el.focus();el.setSelectionRange(pos,pos);el.dispatchEvent(new Event('select',{bubbles:true}));});
 await editor.press('ArrowRight');
 await page.getByRole('button',{name:'Utan ackord',exact:true}).click();
 await expect(editor).toHaveValue(/ackord: N\.C\./);
 await expect(page.locator('.paper')).toContainText('N.C.');
 await page.getByRole('button',{name:'Upprepa takt',exact:true}).click();
 await expect(editor).toHaveValue(/ackord: ["']%["']/);
 await expect(page.locator('.paper')).toContainText('%');
 await expect(page.locator('.parse-error')).toHaveCount(0);
});
test('edit an existing preview chord, validate input, undo and protect stale previews',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Webbläsartest/}).click();
 const editor=page.getByRole('textbox',{name:'Låtfilens text'});await editor.fill(content);
 await expect(page.locator('.live-label')).toHaveText('Live');
 await page.getByRole('button',{name:'Ändra Abm6/9/Gb, Intro, takt 1',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Ändra ackord',exact:true});
 await expect(dialog.getByLabel('Ackord',{exact:true})).toHaveValue('Abm6/9/Gb');
 await dialog.getByLabel('Ackord',{exact:true}).fill('C G7');
 await dialog.getByRole('button',{name:'Ändra ackord',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('ett enda ackord');
 await dialog.getByLabel('Ackord',{exact:true}).fill('Bb7/F');
 await dialog.getByLabel('Ackord',{exact:true}).press('Enter');
 await expect(dialog).toHaveCount(0);await expect(editor).toHaveValue(/- Bb7\/F/);
 await expect(page.getByRole('button',{name:'Ändra Bb7/F, Intro, takt 1',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(editor).toHaveValue(content);
 await expect(page.locator('.live-label')).toHaveText('Live');
 await page.getByRole('button',{name:'Ändra Abm6/9/Gb, Intro, takt 1',exact:true}).focus();
 await page.keyboard.press('Enter');await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 await editor.fill(content+'invalid: true\n');
 await page.locator('.chord-hit').first().dispatchEvent('click');
 await expect(dialog).toHaveCount(0);
});
test('rename a section from its reuse block and update the form references',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Webbläsartest/}).click();
 const editor=page.getByRole('textbox',{name:'Låtfilens text'});await editor.fill(content);
 await page.getByRole('button',{name:'Återanvänd del',exact:true}).click();
 await page.getByLabel('Antal gånger').selectOption('2');await page.getByRole('button',{name:'Lägg sist i formen'}).click();
 await expect(page.locator('.paper')).toContainText('ÅTERANVÄND DEL · AVSLUTNING');
 await page.getByRole('button',{name:'Ändra delnamn: Intro',exact:true}).last().click();
 const dialog=page.getByRole('dialog',{name:'Ändra delnamn',exact:true});
 await dialog.getByLabel('Delnamn',{exact:true}).fill('Mellanspel');await dialog.getByLabel('Delnamn',{exact:true}).press('Enter');
 await expect(editor).toHaveValue(/namn: Mellanspel/);await expect(editor).not.toHaveValue(/del: Intro/);
 await expect(page.getByLabel('Spelordning',{exact:true})).toContainText('Mellanspel → Mellanspel × 2 → SLUT');
 await expect(page.getByRole('button',{name:'Ändra delnamn: Mellanspel',exact:true})).toHaveCount(2);
 await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(editor).toHaveValue(/namn: Intro/);
});
