import {test,expect} from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.route('**/entrance.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' })); });

for(const mode of ['silent-write','write-rejected','read-denied','fallback-succeeds'] as const){
  test(`clipboard reports truthful status: ${mode}`,async({page})=>{
    await page.addInitScript((mode)=>{
      navigator.permissions.query=async()=>({state:'granted'} as PermissionStatus);
      let text='';let fallbacks=0;
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
        writeText:async(value:string)=>{if(mode==='write-rejected')throw Error('Denied');if(mode==='read-denied')text=value;},
        readText:async()=>{if(mode==='read-denied')throw Error('Read denied');return text;},
      }});
      document.execCommand=(command:string)=>{if(command!=='copy')return false;fallbacks++;if(mode!=='fallback-succeeds')return false;text=(document.activeElement as HTMLTextAreaElement).value;return true;};
      Object.defineProperty(window,'clipboardFallbackCalls',{get:()=>fallbacks});
    },mode);
    await page.goto('/');const button=page.getByRole('button',{name:'Copy crosshair code',exact:true});await button.focus();await button.click();
    const success=mode==='read-denied'||mode==='fallback-succeeds';
    await expect(page.getByRole('status')).toContainText(success?'Share code copied.':'Clipboard access failed.');
    expect(await page.evaluate(()=>(window as unknown as {clipboardFallbackCalls:number}).clipboardFallbackCalls)).toBe(mode==='read-denied'?0:1);
    if(mode==='fallback-succeeds')expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(await page.getByLabel('Current CS2 share code').inputValue());
    await expect(button).toBeFocused();
  });
}

test('clipboard fallback rejects a second silent success',async({page})=>{
  await page.addInitScript(()=>{navigator.permissions.query=async()=>({state:'granted'} as PermissionStatus);Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{},readText:async()=>''}});document.execCommand=()=>true;});
  await page.goto('/');await page.getByRole('button',{name:'Copy crosshair code',exact:true}).click();await expect(page.getByRole('status')).toContainText('Clipboard access failed.');
});

test('clipboard fallback preserves focused text input selection',async({page})=>{
  await page.addInitScript(()=>{
    navigator.permissions.query=async()=>({state:'granted'} as PermissionStatus);
    let text='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('Write denied');},readText:async()=>text}});
    document.execCommand=()=>{text=(document.activeElement as HTMLTextAreaElement).value;return true;};
  });
  await page.goto('/');const input=page.getByRole('textbox',{name:'Alias name'});await input.fill('team_reticle');await input.evaluate(element=>(element as HTMLInputElement).setSelectionRange(2,7,'backward'));
  await page.keyboard.press('Control+Enter');await expect(page.getByRole('status')).toContainText('Console commands copied.');await expect(input).toBeFocused();
  expect(await input.evaluate(element=>{const input=element as HTMLInputElement;return [input.selectionStart,input.selectionEnd,input.selectionDirection];})).toEqual([2,7,'backward']);
});

for(const state of ['prompt','denied'] as const)test(`copy never requests clipboard read permission when ${state}`,async({page})=>{
  await page.addInitScript(state=>{
    let reads=0;Object.defineProperty(window,'clipboardReadCalls',{get:()=>reads});
    navigator.permissions.query=async()=>({state} as PermissionStatus);
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{},readText:async()=>{reads++;throw Error('Unexpected clipboard read');}}});
    document.execCommand=()=>{throw Error('Unexpected fallback');};
  },state);
  await page.goto('/');await page.getByRole('button',{name:'Copy crosshair code',exact:true}).click();await expect(page.getByRole('status')).toContainText('Share code copied.');
  expect(await page.evaluate(()=>(window as unknown as {clipboardReadCalls:number}).clipboardReadCalls)).toBe(0);
});
