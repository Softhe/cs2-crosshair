import {test,expect} from '@playwright/test';

test('odd-width center dots remain concentric with square and circle at every zoom',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Outline',{exact:true}).selectOption('0');
  await page.getByLabel('Gap',{exact:true}).fill('6');
  await page.getByLabel('Gap',{exact:true}).press('Enter');
  const bounds=async()=>page.locator('.map-preview canvas').evaluate((element)=>{
    const canvas=element as HTMLCanvasElement;
    const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
    let left=canvas.width,right=-1,top=canvas.height,bottom=-1;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      if(data[(y*canvas.width+x)*4+3]>0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    return [(left+right)/2,(top+bottom)/2];
  });
  for(const thickness of ['1','3'])for(const zoom of [1,2,4,8]){
    await page.getByLabel('Thickness',{exact:true}).fill(thickness);
    await page.getByLabel('Thickness',{exact:true}).press('Enter');
    await page.getByRole('button',{name:`${zoom}x preview zoom`}).click();
    await page.getByLabel('Style',{exact:true}).selectOption('6');
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    const dot=await bounds();
    for(const style of ['3','8']){
      await page.getByLabel('Style',{exact:true}).selectOption(style);
      await page.getByLabel('Center Dot',{exact:true}).selectOption('0');
      await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
      await expect.poll(async()=>{const shape=await bounds();return Math.max(Math.abs(shape[0]-dot[0]),Math.abs(shape[1]-dot[1]));}).toBeLessThanOrEqual(.5);
    }
  }
});
