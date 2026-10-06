import { test, expect } from '@playwright/test';
import type { SetlistLibrary } from '../lib/setlists';
test('create, reorder, save, browse, sort, reopen and delete a setlist', async ({page}) => {
  let library: SetlistLibrary = {lists:[],revision:'0'};
  await page.route('**/api/setlists',async route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      expect(body.revision).toBe(library.revision);
      library = {lists:body.lists,revision:String(Number(library.revision)+1)};
    }
    await route.fulfill({json:library});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Ny setlista',exact:true}).click();
  const dialog = page.getByRole('dialog',{name:'Ny setlista',exact:true});
  await dialog.getByLabel('Namn på setlistan').fill('Kvällsset');
  const selector = dialog.getByLabel('Låt att lägga till');
  const choices = await selector.locator('option').evaluateAll(options => options.map(option => ({id:(option as HTMLOptionElement).value,name:option.textContent!})).filter(option => option.id));
  const first = choices[0], last = choices.at(-1)!;
  for (const choice of [first,last,first]) {
    await selector.selectOption(choice.id); await dialog.getByRole('button',{name:'Lägg till',exact:true}).click();
  }
  await dialog.getByRole('button',{name:'Ta bort låt 3',exact:true}).click();
  await dialog.getByRole('button',{name:'Flytta upp låt 2',exact:true}).click();
  await dialog.getByRole('button',{name:'Spara setlista',exact:true}).click();
  expect(library.lists[0].songs).toEqual([last.id,first.id]);
  const nav = page.getByRole('navigation',{name:'Låtar i vald lista'});
  await expect(nav.locator('.song-description strong')).toHaveText([last.name,first.name]);
  await page.getByRole('button',{name:'Sortera i bokstavsordning'}).click();
  await expect(nav.locator('.song-description strong')).toHaveText([first.name,last.name]);
  expect(library.lists[0].songs).toEqual([last.id,first.id]);
  await page.getByRole('button',{name:'Sortera i bokstavsordning'}).click();
  await expect(nav.locator('.song-description strong')).toHaveText([last.name,first.name]);
  await page.reload();
  await page.getByRole('button',{name:/Kvällsset/}).click();
  await expect(nav.locator('.song-description strong')).toHaveText([last.name,first.name]);
  await page.getByRole('button',{name:'Redigera',exact:true}).click();
  await page.getByLabel('Namn på setlistan').fill('Nytt namn');
  await page.getByRole('button',{name:'Spara setlista',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Nytt namn'})).toBeVisible();
  await page.screenshot({path:'work/cache/setlists-library.png'});
  await page.getByRole('button',{name:'Redigera',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Ta bort setlista',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Setlistor',exact:true})).toBeVisible();
  expect(library.lists).toEqual([]);
});

test('setlist API rejects foreign writes and stale saves', async ({request,baseURL}) => {
  const current = await request.get('/api/setlists');
  expect(current.ok()).toBe(true);
  const library = await current.json();
  const foreign = await request.put('/api/setlists',{headers:{origin:'https://example.com'},data:{lists:library.lists,revision:library.revision}});
  expect(foreign.status()).toBe(403);
  const stale = await request.put('/api/setlists',{headers:{origin:baseURL!},data:{lists:library.lists,revision:'stale'}});
  expect(stale.status()).toBe(409);
  expect(await (await request.get('/api/setlists')).json()).toEqual(library);
});

test('missing songs stay visible and cancelling leaves the setlist unchanged on mobile', async ({page}) => {
  const library = {lists:[{id:'52f0bcce-e104-4d25-ac31-6594653a7a4b',name:'Saknad låt',songs:['saknad.yaml']}],revision:'0'};
  await page.route('**/api/setlists',route=>route.fulfill({json:library}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const libraryToggle=page.getByRole('button',{name:'Visa bibliotek',exact:true});if(await libraryToggle.isVisible())await libraryToggle.click();
  await page.getByRole('button',{name:/Saknad låt/}).click();
  await expect(page.getByRole('button',{name:/saknad.yaml/})).toBeDisabled();
  await page.getByRole('button',{name:'Redigera',exact:true}).click();
  await page.getByLabel('Namn på setlistan').fill('Osparat');
  await page.getByRole('button',{name:'Avbryt',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Saknad låt',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
