import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
await mkdir('docs/evidence',{recursive:true});
const browser=await chromium.launch();
for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height}});
  await page.goto('http://127.0.0.1:4180/');await page.evaluate(()=>document.fonts.ready);
  await page.locator('.map-preview').evaluate(async el=>{const image=new Image();image.src=getComputedStyle(el).backgroundImage.slice(5,-2);await image.decode();});
  await page.screenshot({path:`docs/evidence/${name}.png`,fullPage:true});
  await page.screenshot({path:`docs/evidence/${name}-preview.png`});
  console.log(name,await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,headings:[...document.querySelectorAll('h2')].map(el=>el.textContent)})));
  await page.close();
}
await browser.close();
