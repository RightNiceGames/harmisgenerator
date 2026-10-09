import { test, expect, type Page } from '@playwright/test';
const orderedSongs = ['vintersaga.yaml','flykten-fran-vardagen.yaml','allt-jag-ser.yaml'];
async function setupActiveSetlists(page: Page) {
  const first = {id:'246622b7-d8e4-43d7-ad35-7b4dcb3c6e3',name:'Första setet',songs:orderedSongs};
  const second = {id:'52f0bcce-e104-4d25-ac31-6594653a7a4b',name:'Andra setet',songs:[...orderedSongs].reverse()};
  await page.route('**/api/setlists',route=>route.fulfill({json:{lists:[first,second],revision:'0'}}));
  await page.route(/\/api\/songs\/(vintersaga|flykten-fran-vardagen|allt-jag-ser)\.yaml$/,route=>route.fulfill({json:{text:source('Testlåt',1),revision:'0'}}));
  await page.goto('/');
  await expect(page.locator('.paper').first()).toBeVisible();
  await page.getByRole('button',{name:/Första setet/}).click();
  return page.getByRole('navigation',{name:'Låtar i vald lista'});
}

test('editor Live follows the selected setlist despite sorting and search', async ({page}) => {
  const nav = await setupActiveSetlists(page);
  await nav.getByRole('button',{name:/Flykten från vardagen/}).click();
  await page.getByRole('button',{name:'Sortera i bokstavsordning'}).click();
  await page.getByRole('textbox',{name:'Sök låt eller artist'}).fill('Flykten');
  await expect(nav.getByRole('button')).toHaveCount(1);
  await page.getByRole('button',{name:'Liveläge',exact:true}).click();
  const live = page.getByRole('dialog',{name:'Live: Första setet'});
  await expect(live.locator('.live-song-position')).toContainText('2 / 3');
  await expect(live.locator('figure').first()).toHaveAttribute('aria-label',/Flykten från vardagen, sida/);
  await live.getByRole('button',{name:'Föregående låt',exact:true}).click();
  await expect(live.locator('figure')).toHaveAttribute('aria-label','Vintersaga, sida 1');
  await expect(live.getByRole('button',{name:'Föregående låt',exact:true})).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await expect(live.locator('figure').first()).toHaveAttribute('aria-label',/Flykten från vardagen, sida/);
  await live.getByRole('button',{name:'Nästa låt',exact:true}).click();
  await expect(live.locator('figure')).toHaveAttribute('aria-label','Allt jag ser, sida 1');
  await expect(live.getByRole('button',{name:'Nästa låt',exact:true})).toBeDisabled();
  await page.keyboard.press('ArrowLeft');
  await expect(live.locator('figure').first()).toHaveAttribute('aria-label',/Flykten från vardagen, sida/);
});

test('editor Live uses the newly selected setlist instead of the previous session', async ({page}) => {
  const nav = await setupActiveSetlists(page);
  await nav.getByRole('button',{name:/Flykten från vardagen/}).click();
  await page.getByRole('button',{name:'Live',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Live: Första setet'}).locator('figure').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Setlistor',exact:true}).click();
  await page.getByRole('button',{name:/Andra setet/}).click();
  await page.getByRole('button',{name:'Liveläge',exact:true}).click();
  const live = page.getByRole('dialog',{name:'Live: Andra setet'});
  await expect(live.locator('.live-song-position')).toContainText('2 / 3');
  await live.getByRole('button',{name:'Nästa låt',exact:true}).click();
  await expect(live.locator('figure')).toHaveAttribute('aria-label','Vintersaga, sida 1');
  await live.getByRole('button',{name:'Föregående låt',exact:true}).click();
  await expect(live.locator('figure').first()).toHaveAttribute('aria-label',/Flykten från vardagen, sida/);
  await live.getByRole('button',{name:'Föregående låt',exact:true}).click();
  await expect(live.locator('figure')).toHaveAttribute('aria-label','Allt jag ser, sida 1');
});

const list = {id:'246622b7-d8e4-43d7-ad35-7b4dcb3c6e3',name:'Liveset',songs:['live-a.yaml','live-b.yaml','live-c.yaml','live-a.yaml']};
function source(name: string, count: number) {
  return `format: 1\ntitel: ${name}\nartist: Test\ngrundtonart: C\ntaktart: 4/4\ndelar:\n` + Array.from({length:count},(_,i)=>`  - namn: Del ${i+1}\n    ${i ? 'sidbrytning: true\n    ' : ''}takter: [C]\n`).join('');
}
async function setup(page: Page) {
  const loads: string[] = [];
  await page.route('**/api/setlists',route=>route.fulfill({json:{lists:[list],revision:'0'}}));
  await page.route(/\/api\/songs\/live-[abc]\.yaml$/,route=>{
    const id = route.request().url().split('/').at(-1)!;
    loads.push(id);
    const [name,count] = id === 'live-a.yaml' ? ['Låt A',3] : id === 'live-b.yaml' ? ['Låt B',1] : ['Låt C',4];
    return route.fulfill({json:{text:source(name as string,count as number),revision:'0'}});
  });
  await page.goto('/');
  await expect(page.locator('.paper').first()).toBeVisible();
  await page.getByRole('button',{name:'Visa låtfil',exact:true}).click();
  const original = await page.getByRole('textbox',{name:'Låtfilens text'}).inputValue();
  await page.getByRole('button',{name:/Liveset/}).click();
  await page.getByRole('button',{name:'Sortera i bokstavsordning'}).click();
  await page.getByRole('button',{name:'Live',exact:true}).click();
  return {loads,original};
}

test('Live slides one page at a time in set order and navigates across songs', async ({page}) => {
  const {loads} = await setup(page);
  const live = page.getByRole('dialog',{name:'Live: Liveset'});
  const figures = live.locator('figure');
  const next = live.getByRole('button',{name:'Nästa sida eller låt'});
  const back = live.getByRole('button',{name:'Föregående sida eller låt'});
  await expect(figures).toHaveCount(2);
  await expect(figures.nth(0)).toHaveAttribute('aria-label','live-a.yaml, sida 1');
  await expect(figures.nth(1)).toHaveAttribute('aria-label','live-a.yaml, sida 2');
  expect(await page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
  expect(await page.locator('.app-shell').evaluate(el=>(el as HTMLElement).inert)).toBe(true);
  await expect(back).toBeDisabled();
  const a = await figures.nth(0).boundingBox(), b = await figures.nth(1).boundingBox();
  expect(a!.y).toBeCloseTo(b!.y,0); expect(b!.x).toBeGreaterThan(a!.x+a!.width);
  const liveBox = await live.boundingBox();
  await page.mouse.click(liveBox!.width-15,liveBox!.height/2);
  await expect(figures).toHaveCount(2);
  await expect(figures.first()).toHaveAttribute('aria-label','live-a.yaml, sida 2');
  await expect(figures.last()).toHaveAttribute('aria-label','live-a.yaml, sida 3');
  await next.click();
  await expect(figures).toHaveAttribute('aria-label','live-b.yaml, sida 1');
  await next.click();
  await expect(figures).toHaveCount(2);
  await expect(figures.first()).toHaveAttribute('aria-label','live-c.yaml, sida 1');
  await next.click();
  await expect(figures.first()).toHaveAttribute('aria-label','live-c.yaml, sida 2');
  await next.click();
  await expect(figures.first()).toHaveAttribute('aria-label','live-c.yaml, sida 3');
  await next.click();
  await expect(figures.first()).toHaveAttribute('aria-label','live-a.yaml, sida 1');
  await back.click();
  await expect(figures.first()).toHaveAttribute('aria-label','live-c.yaml, sida 3');
  await back.click();
  await expect(figures.first()).toHaveAttribute('aria-label','live-c.yaml, sida 2');
  await back.click();
  await expect(figures.first()).toHaveAttribute('aria-label','live-c.yaml, sida 1');
  await back.click();
  await expect(figures).toHaveAttribute('aria-label','live-b.yaml, sida 1');
  await back.click();
  await expect(figures.first()).toHaveAttribute('aria-label','live-a.yaml, sida 2');
  await expect(figures.last()).toHaveAttribute('aria-label','live-a.yaml, sida 3');
  expect(loads.filter(id=>id==='live-a.yaml')).toHaveLength(1);
  await page.keyboard.press('Escape');
  await expect(live).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
  expect(await page.locator('.app-shell').evaluate(el=>(el as HTMLElement).inert)).toBe(false);
  await expect(page.getByRole('textbox',{name:'Låtfilens text'})).toHaveValue(source('Låt A',3));
});

test('controls hide, change page count while retaining the current page, and fullscreen failure keeps Live open', async ({page}) => {
  await page.addInitScript(()=>{HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error('Fullscreen unavailable'));});
  await setup(page);
  const live = page.getByRole('dialog',{name:'Live: Liveset'}), figures = live.locator('figure');
  const toggle = live.getByRole('button',{name:'Två sidor i Live-läge'});
  await expect(figures).toHaveCount(2);
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(toggle).toBeHidden({timeout:5000});
  await page.mouse.move(100,100);
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(figures).toHaveCount(1);
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await page.keyboard.press('ArrowRight');
  await expect(figures).toHaveAttribute('aria-label','live-a.yaml, sida 2');
  await toggle.click();
  await expect(figures).toHaveCount(2);
  await expect(figures.first()).toHaveAttribute('aria-label','live-a.yaml, sida 2');
  await expect(figures.last()).toHaveAttribute('aria-label','live-a.yaml, sida 3');
  await live.getByRole('button',{name:'Helskärm',exact:true}).click();
  await expect(live.getByRole('alert')).toContainText('Fullscreen unavailable');
  await expect(figures).toHaveCount(2);
  expect(await page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
  await page.screenshot({path:'work/cache/live-single-page.png'});
  await live.getByRole('button',{name:'Avsluta Live-läge'}).click();
  await expect(live).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Live',exact:true})).toBeFocused();
});

test('a missing song is shown as an error and can be retried or passed without skipping silently', async ({page}) => {
  await page.route('**/api/setlists',route=>route.fulfill({json:{lists:[{...list,songs:['missing.yaml','live-b.yaml']}],revision:'0'}}));
  await page.route('**/api/songs/missing.yaml',route=>route.fulfill({status:404,json:{error:'Låtfilen finns inte.'}}));
  await page.route('**/api/songs/live-b.yaml',route=>route.fulfill({json:{text:source('Låt B',1),revision:'0'}}));
  await page.goto('/');
  await expect(page.locator('.paper').first()).toBeVisible();
  await page.getByRole('button',{name:/Liveset/}).click();
  await page.getByRole('button',{name:'Live',exact:true}).click();
  const live = page.getByRole('dialog',{name:'Live: Liveset'});
  await expect(live.getByRole('alert')).toContainText('Låtfilen finns inte.');
  await live.getByRole('button',{name:'Försök igen'}).click();
  await expect(live.getByRole('alert')).toContainText('Låtfilen finns inte.');
  await live.getByRole('button',{name:'Nästa sida eller låt'}).click();
  await expect(live.locator('figure')).toHaveAttribute('aria-label','live-b.yaml, sida 1');
  await expect(live.getByRole('button',{name:'Nästa sida eller låt'})).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(live).toHaveCount(0);
});

test('pair turns remain selectable and fullscreen can be left without closing Live', async ({page}) => {
  await setup(page);
  const live = page.getByRole('dialog',{name:'Live: Liveset'}), figures = live.locator('figure');
  await expect(figures).toHaveCount(2);
  const pairs = live.getByRole('button',{name:'Byt två sidor åt gången'});
  await expect(pairs).toHaveAttribute('aria-pressed','false');
  await pairs.click();
  await expect(pairs).toHaveAttribute('aria-pressed','true');
  await live.getByRole('button',{name:'Nästa sida eller låt'}).click();
  await expect(figures).toHaveAttribute('aria-label','live-a.yaml, sida 3');
  await live.getByRole('button',{name:'Helskärm',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
  await expect(live.getByRole('button',{name:'Lämna helskärm',exact:true})).toHaveAttribute('aria-pressed','true');
  await live.getByRole('button',{name:'Lämna helskärm',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
  await expect(live).toBeVisible();
  await expect(figures).toHaveAttribute('aria-label','live-a.yaml, sida 3');
  await pairs.click();
  await expect(figures.first()).toHaveAttribute('aria-label','live-a.yaml, sida 2');
  await expect(figures.last()).toHaveAttribute('aria-label','live-a.yaml, sida 3');
  await live.getByRole('button',{name:'Avsluta Live-läge'}).click();
  await expect(live).toHaveCount(0);
});

test('Live starts at the active editor song with its unsaved text and retains earlier set songs', async ({page}) => {
  const activeList = {...list,songs:['live-a.yaml','flykten-fran-vardagen.yaml','live-b.yaml']};
  await page.route('**/api/setlists',route=>route.fulfill({json:{lists:[activeList],revision:'0'}}));
  await page.route(/\/api\/songs\/live-[ab]\.yaml$/,route=>route.fulfill({json:{text:source('Annan låt',1),revision:'0'}}));
  await page.goto('/');
  await expect(page.locator('.paper').first()).toBeVisible();
  await page.getByRole('button',{name:'Visa låtfil',exact:true}).click();
  const editor = page.getByRole('textbox',{name:'Låtfilens text'});
  await editor.fill(source('Aktiv osparad låt',3));
  await expect(page.locator('.paper').first()).toContainText('Aktiv osparad låt');
  await page.getByRole('button',{name:/Liveset/}).click();
  await page.getByRole('button',{name:'Live',exact:true}).click();
  const live = page.getByRole('dialog',{name:'Live: Liveset'}), figures = live.locator('figure');
  await expect(figures).toHaveCount(2);
  await expect(figures.first()).toHaveAttribute('aria-label','Flykten från vardagen, sida 1');
  await expect(figures.first()).toContainText('Aktiv osparad låt');
  await live.getByRole('button',{name:'Föregående sida eller låt'}).click();
  await expect(figures).toHaveAttribute('aria-label','live-a.yaml, sida 1');
  await live.getByRole('button',{name:'Nästa sida eller låt'}).click();
  await expect(figures.first()).toHaveAttribute('aria-label','Flykten från vardagen, sida 1');
  await page.keyboard.press('Escape');
  await expect(editor).toHaveValue(source('Aktiv osparad låt',3));
});

test('explicit song buttons skip pages and Live returns to the right-hand page in the editor',async({page})=>{
 await setup(page);const live=page.getByRole('dialog',{name:'Live: Liveset'});
 await live.getByRole('button',{name:'Nästa låt',exact:true}).click();await expect(live.locator('figure')).toHaveAttribute('aria-label','live-b.yaml, sida 1');
 await live.getByRole('button',{name:'Föregående låt',exact:true}).click();await expect(live.locator('figure').first()).toHaveAttribute('aria-label','live-a.yaml, sida 1');
 await live.getByRole('button',{name:'Nästa sida eller låt',exact:true}).click();await expect(live.locator('figure').last()).toHaveAttribute('aria-label','live-a.yaml, sida 3');
 await page.keyboard.press('Escape');await expect(page.locator('.paper')).toHaveCount(3);await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 await expect.poll(()=>page.locator('.paper[data-page="2"]').evaluate(el=>{const r=el.getBoundingClientRect(),v=el.closest('.paper-scroll')!.getBoundingClientRect();return Math.abs(r.top-v.top)<4;})).toBe(true);
 await page.getByRole('button',{name:'Liveläge',exact:true}).click();await expect(page.locator('.live-paper')).toHaveCount(1);await expect(page.locator('.live-paper')).toHaveAttribute('aria-label','live-a.yaml, sida 3');
 await page.keyboard.press('Escape');
});

test('switching songs in Live preserves unsaved edits and undo when returning',async({page})=>{
 await setup(page);await page.keyboard.press('Escape');await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 const editor=page.getByRole('textbox',{name:'Låtfilens text'});const original=await editor.inputValue();
 await editor.fill(original.replace('titel: Låt A','titel: Osparad låt A'));await expect(page.locator('.live-label')).toHaveText('Uppdaterad');
 await page.getByRole('button',{name:'Liveläge',exact:true}).click();await page.getByRole('button',{name:'Nästa låt',exact:true}).click();await expect(page.locator('.live-paper')).toHaveAttribute('aria-label','live-b.yaml, sida 1');await page.keyboard.press('Escape');await expect(editor).toHaveValue(source('Låt B',1));
 await page.getByRole('button',{name:'Liveläge',exact:true}).click();await page.getByRole('button',{name:'Föregående låt',exact:true}).click();await expect(page.locator('.live-paper').first()).toContainText('Osparad låt A');await page.keyboard.press('Escape');
 await expect(editor).toHaveValue(original.replace('titel: Låt A','titel: Osparad låt A'));await page.getByRole('button',{name:'Ångra',exact:true}).click();await expect(editor).toHaveValue(original);
});
