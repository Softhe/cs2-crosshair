import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.route('**/entrance.js*',route=>route.fulfill({contentType:'text/javascript',body:''}));
 await page.route('**/api/session',route=>route.fulfill({json:{user:null,available:false}}));
});

test('settings and preview remain usable together while editing',async({page},info)=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'Shape',exact:true})).toBeInViewport();
 await expect(page.getByRole('heading',{name:'Color and outline',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Behavior and scope',exact:true})).toBeVisible();
 const gap=page.getByRole('spinbutton',{name:'Gap',exact:true});
 await gap.fill('12');await gap.press('Tab');
 await expect(gap).toHaveValue('12');
 await expect(page.locator('.map-preview')).toBeInViewport();
 const preview=await page.locator('.preview-section').boundingBox();
 expect(preview!.y).toBeGreaterThanOrEqual(-1);
 expect(preview!.y+preview!.height).toBeLessThan(info.project.name==='mobile'?770:1000);
 const field=page.getByLabel('Crosshair code or config',{exact:true});
 const code=await field.getAttribute('data-current-code');
 await page.getByRole('button',{name:'Inspect preview',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Inspect preview',exact:true})).toBeVisible();
 await page.getByLabel('Preview scale',{exact:true}).selectOption('1440');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Inspect preview',exact:true})).toBeFocused();
 await expect(field).toHaveAttribute('data-current-code',code!);
});

test('one consistent appearance keeps readable text without an extra heading',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('delli.v3.theme',JSON.stringify('crimson')));
 await page.goto('/');
 await expect(page.locator('.page-heading')).toHaveCount(0);
 await expect(page.getByRole('group',{name:'Appearance',exact:true})).toHaveCount(0);
 await expect(page.locator('html')).toHaveAttribute('data-theme','cs2');
  const result=await page.evaluate(()=>{
   const root=getComputedStyle(document.documentElement),panel=document.querySelector('.preview-section')!,input=document.querySelector('#import-text')!;
   const rgb=(v:string)=>{const m=v.match(/[\d.]+/g)!;return m.slice(0,3).map(Number);};
   const lum=(v:string)=>rgb(v).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*([.2126,.7152,.0722][i]??0),0);
   const contrast=(fg:string,bg:string)=>{const a=lum(fg),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
   const helper=document.querySelector('.preview-caption')!,button=document.querySelector('.primary-button')!;
   return {panel:getComputedStyle(panel).backgroundColor,input:getComputedStyle(input).backgroundColor,token:root.getPropertyValue('--panel'),textContrast:contrast(getComputedStyle(helper).color,getComputedStyle(document.body).backgroundColor),buttonContrast:contrast(getComputedStyle(button).color,getComputedStyle(button).backgroundColor)};
  });
  expect(result.input).not.toBe(result.panel);expect(result.textContrast).toBeGreaterThanOrEqual(4.5);expect(result.buttonContrast).toBeGreaterThanOrEqual(4.5);
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','cs2');
});

test('mobile compact preview expands and controls have comfortable targets',async({page},info)=>{
 test.skip(info.project.name!=='mobile');await page.goto('/');
 await page.getByRole('button',{name:'Expand preview',exact:true}).click();
 await expect(page.getByRole('button',{name:'4x preview zoom',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'4x preview zoom',exact:true}).click();
 await page.getByRole('button',{name:'Compact preview',exact:true}).click();
 await page.getByRole('button',{name:'Edit Color and Transparency',exact:true}).click();
 for(const name of ['Next map','Previous map','Fullscreen game-size preview','Set crosshair #00ff00','Reset crosshair']){
  const b=await page.getByRole('button',{name,exact:true}).boundingBox();expect(b!.width+0.01,name).toBeGreaterThanOrEqual(44);expect(b!.height+0.01,name).toBeGreaterThanOrEqual(44);
 }
 await expect(page.getByRole('button',{name:'Set crosshair #00ff00',exact:true})).toHaveAttribute('aria-pressed','true');
 for(const width of [320,360,390,540,700,820]){
  await page.setViewportSize({width,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`).toBe(true);
  expect(await page.locator('.preview-toolbar').evaluate(toolbar=>{const bounds=toolbar.getBoundingClientRect();return [...toolbar.querySelectorAll('button,select')].filter(e=>e.getBoundingClientRect().width>0).every(e=>{const rect=e.getBoundingClientRect();return rect.left>=bounds.left&&rect.right<=bounds.right;});}),`clipped toolbar at ${width}`).toBe(true);
 }
});

test('pending import, failed clipboard and draft persistence have clear state',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('Denied')),readText:()=>Promise.reject(new Error('Denied'))}});document.execCommand=()=>false;});
 await page.goto('/');const field=page.getByLabel('Crosshair code or config',{exact:true}),code=await field.getAttribute('data-current-code');
 await field.fill('CSinvalid');await expect(page.getByText('Unapplied import',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Import crosshair',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
 await expect(field).toHaveAttribute('data-current-code',code!);
 await page.getByRole('button',{name:'Copy crosshair code',exact:true}).click();
 await expect(page.locator('.toast[data-tone=error]')).toContainText('Clipboard access failed');
 await page.locator('.import-options>summary').click();await page.getByRole('button',{name:'Use current code',exact:true}).click();
 await expect(page.getByText('Applied crosshair',{exact:true})).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(page.getByText('Draft saved on this device.',{exact:true})).toBeVisible();
});


test('wide editor shows every conditional control without scrolling',async({page},info)=>{
 test.skip(info.project.name!=='desktop');
 for(const viewport of [{width:2504,height:1244},{width:1462,height:1244},{width:1440,height:1000}]){
  await page.setViewportSize(viewport);await page.goto('/');
  for(const style of ['0','1','2','3','4','5','6','7','8','9']){
   await page.getByLabel('Style',{exact:true}).selectOption(style);
   const outside=await page.locator('.editor .setting-row input,.editor .setting-row select,.editor .swatch').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth;}).map(e=>e.getAttribute('aria-label')||e.id));
   expect(outside,`style ${style} at ${viewport.width}x${viewport.height}`).toEqual([]);
  }
 }
});


test('large desktop gives the live preview most of the workspace',async({page},info)=>{
 test.skip(info.project.name!=='desktop');
 await page.setViewportSize({width:2504,height:1244});await page.goto('/');
 const map=await page.locator('.map-preview').boundingBox(),editor=await page.locator('.editor').boundingBox();
 expect(map!.width).toBeGreaterThan(1100);expect(map!.height).toBeGreaterThanOrEqual(560);expect(map!.width).toBeGreaterThan(editor!.width);
 expect(map!.y+map!.height).toBeLessThan(1244);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
