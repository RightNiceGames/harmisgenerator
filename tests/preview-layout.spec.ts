import { test, expect } from '@playwright/test';
test('preview toggles between stacked pages and pairs while retaining zoom and editing', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.paper')).toHaveCount(1);
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
  await papers.nth(1).locator('.chord-hit').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Avbryt',exact:true}).click();
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
