import { test, expect } from '@playwright/test';
test('paired print preview retains zoom and returns to direct editing in single-page view', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.paper')).toHaveCount(1);
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
