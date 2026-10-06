import { test, expect } from '@playwright/test';
test('paired print preview retains zoom and returns to direct editing in single-page view', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.paper').first()).toBeVisible();
  await page.getByRole('button',{name:'Visa låtfil',exact:true}).click();
  const editor = page.getByRole('textbox',{name:'Låtfilens text'});
  await editor.fill(`format: 1
titel: Tvåsidig visning
artist: Test
grundtonart: C
taktart: 4/4
delar:
  - namn: A
    takter: [C]
  - namn: B
    sidbrytning: true
    takter: [F]
  - namn: C
    sidbrytning: true
    takter: [G]
`);
  const papers = page.locator('.paper');
  await expect(papers).toHaveCount(3);
  const toggle = page.getByRole('button',{name:'Visa två sidor sida vid sida'});
  const boxes = async () => Promise.all([0,1,2].map(i => papers.nth(i).boundingBox()));
  let [a,b] = await boxes();
  expect(b!.y).toBeGreaterThan(a!.y + a!.height);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  let [first,second,third] = await boxes();
  expect(Math.abs(first!.y-second!.y)).toBeLessThan(1);
  expect(second!.x).toBeGreaterThan(first!.x+first!.width);
  expect(third!.y).toBeGreaterThan(first!.y+first!.height);
  await expect(page.locator('.bar-number-hit')).toHaveCount(0);
  await papers.nth(1).locator('.chord-hit').dispatchEvent('click');
  await papers.nth(1).locator('.chord-hit').dispatchEvent('click');
  await expect(page.locator('#score-edit')).toHaveCount(0);
  await page.getByRole('button',{name:'Förhandsgranska utskrift',exact:true}).click();
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.bar-number-hit').first()).toBeVisible();
  await papers.nth(1).locator('.chord-hit').click();
  await expect(page.locator('#score-edit')).toHaveCount(0);
  await papers.nth(1).locator('.chord-hit').click();
  await expect(page.locator('#score-edit')).toHaveValue('F');
  await page.locator('#score-edit').press('Escape');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await page.getByLabel('Zoom',{exact:true}).selectOption('100');
  [first,second] = await boxes();
  expect(first!.width).toBeCloseTo(794,0);
  expect(first!.y).toBeCloseTo(second!.y,0);
  await page.getByLabel('Zoom',{exact:true}).selectOption('fit');
  await page.getByRole('button',{name:'Större förhandsvisning'}).click();
  await page.screenshot({path:'work/cache/two-page-preview.png'});
  await page.emulateMedia({media:'print'});
  expect(await page.locator('.paper-stack').evaluate(el => getComputedStyle(el).display)).toBe('block');
  await page.emulateMedia({media:'screen'});
  await toggle.click();
  [a,b] = await boxes();
  expect(b!.y).toBeGreaterThan(a!.y+a!.height);
});

test('editing and print preview have identical A4 pagination typography and visible drawing',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Visa låtfil',exact:true}).click();
 const source=`format: 1\ntitel: A4 layoutkontroll\nartist: Test\ngrundtonart: C\ntaktart: 4/4\ndelar:\n  - namn: Vers\n    takter:\n      - ackord: C G\n        slag: [1, 3]\n        rytm: [{ slag: 1, notvarde: 4 }]\n        varianter: [{ gang: 2, ackord_nr: 1, ackord: F Am, slag: [1, 2], rytm: [{ slag: 1.5, notvarde: 8 }] }]\n`+Array.from({length:92},()=>`      - C\n`).join('')+`  - namn: Coda\n    sidbrytning: true\n    takter: [G]\n`;
 await page.getByRole('textbox',{name:'Låtfilens text'}).fill(source);await expect(page.locator('.live-label')).toHaveText('Live');await page.locator('.global-nav').getByRole('button',{name:'Dölj låtfil',exact:true}).click();
 const drawing=()=>page.locator('.paper svg').evaluateAll(svgs=>svgs.map(svg=>({viewBox:svg.getAttribute('viewBox'),nodes:[...svg.querySelectorAll('text,line,path,circle,rect,ellipse,polyline,polygon,image')].filter(el=>!el.matches('.bar-hit,.bar-number-hit,.chord-hit,.chord-area-hit,.variant-area-hit,.section-hit,.reuse-hit')&&!el.closest('defs')).map(el=>({tag:el.tagName,attributes:[...el.attributes].map(a=>[a.name,a.value]).sort((a,b)=>a[0].localeCompare(b[0])),text:el.textContent}))})));
 const sizes=()=>page.locator('.paper').evaluateAll(items=>items.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
 await page.evaluate(()=>document.fonts.ready);const editDrawing=await drawing();expect(editDrawing.length).toBeGreaterThan(1);
 for(const sheet of editDrawing){const values=sheet.viewBox!.split(/\s+/).map(Number);expect(values[2]/values[3]).toBeCloseTo(210/297,4);}
 const fitSizes=await sizes();await page.locator('.paper .chord-hit').first().click();expect(await drawing()).toEqual(editDrawing);expect(await sizes()).toEqual(fitSizes);
 const toggle=page.getByRole('button',{name:'Förhandsgranska utskrift',exact:true});await toggle.click();await expect(page.locator('.live-label')).toHaveText('Live');await expect(page.locator('.paper .score-selected-hit,.paper .score-selected-bar')).toHaveCount(0);await page.evaluate(()=>document.fonts.ready);
 expect(await drawing()).toEqual(editDrawing);expect(await sizes()).toEqual(fitSizes);
 await page.getByLabel('Zoom',{exact:true}).selectOption('100');const printSizes=await sizes();await toggle.click();await expect(page.locator('.live-label')).toHaveText('Live');expect(await drawing()).toEqual(editDrawing);expect(await sizes()).toEqual(printSizes);
});
