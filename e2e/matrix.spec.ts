import {test,expect,type Page} from '@playwright/test';
import {styles,styleFields,defaults,presets} from '../src/model';

async function number(page:Page,label:string,value:number){const input=page.getByRole('spinbutton',{name:label,exact:true});await input.fill(String(value));await input.press('Enter');await expect(input).toHaveValue(value%1?value.toFixed(2):String(value));}
async function consoleText(page:Page){await page.locator('.console-details').evaluate((element)=>{(element as HTMLDetailsElement).open=true;});return page.getByLabel('Generated console commands').inputValue();}
async function importText(page:Page,text:string){await page.getByRole('button',{name:'Share or Import',exact:true}).click();await page.getByLabel('Crosshair code or config').fill(text);await page.getByRole('button',{name:'Import crosshair',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();}
async function clipboard(page:Page){return page.evaluate(()=>navigator.clipboard.readText());}

for(const [style,name] of styles){test(`matrix: ${name} edits, clipboard code, config file and full link round trips`,async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);await page.goto('/');
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.getByLabel('Style',{exact:true}).selectOption(String(style));
  for(const field of styleFields({...defaults,cl_crosshairstyle:style}).slice(1)){
    if(field.options){await page.getByLabel(field.label,{exact:true}).selectOption(String(field.options[field.options.length-1][0]));}
    else {const value=field.label==='Gap'&&style===2?-7:(field.step??1)<1?.73:Math.min(field.max!,11);await number(page,field.label,value);}
  }
  await page.getByRole('button',{name:'Edit Color and Transparency',exact:true}).click();
  for(const [channel,value] of [['red',39],['green',121],['blue',207],['opacity',164]] as const)await number(page,`Crosshair ${channel}`,value);
  // Full outline reveals its independently editable RGBA channels.
  await page.getByLabel('Outline',{exact:true}).selectOption('2');await page.getByRole('button',{name:'Edit Outline Color and Transparency',exact:true}).click();
  for(const [channel,value] of [['red',199],['green',18],['blue',77],['opacity',212]] as const)await number(page,`Outline ${channel}`,value);
  await page.getByLabel('Friendly Fire Reticle Warning',{exact:true}).selectOption('0');
  const commands=await consoleText(page);const displayed=await page.getByLabel('Current CS2 share code').inputValue();
  await page.getByRole('button',{name:'Copy crosshair code',exact:true}).click();expect(await clipboard(page)).toBe(displayed);
  await page.getByRole('button',{name:'Copy share code',exact:true}).click();expect(await clipboard(page)).toBe(displayed);
  await importText(page,displayed);await expect(page.getByLabel('Current CS2 share code')).toHaveValue(displayed);expect(await consoleText(page)).toBe(commands);
  await page.getByRole('button',{name:/^Copy console commands/}).click();expect((await clipboard(page)).split('; ').join('\n')).toBe(commands);
  await page.getByRole('textbox',{name:'Alias name'}).fill(`matrix_${style}`);
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download .cfg',exact:true}).click();const file=await pending;expect(file.suggestedFilename()).toBe(`crosshair_matrix_${style}.cfg`);
  const stream=await file.createReadStream();let content='';for await(const chunk of stream!)content+=chunk;
  expect(content.split('\n').filter(line=>line.startsWith('cl_')).join('\n')).toBe(commands);
  await page.getByRole('button',{name:'Reset crosshair',exact:true}).click();await page.getByRole('button',{name:'Share or Import',exact:true}).click();
  await page.getByLabel('Crosshair config file').setInputFiles((await file.path())!);await expect(page.getByLabel('Crosshair code or config')).toHaveValue(content);
  await page.getByRole('button',{name:'Import crosshair',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect(await consoleText(page)).toBe(commands);
  await page.getByRole('button',{name:'Copy link',exact:true}).click();const link=await clipboard(page);await page.goto(link);expect(await consoleText(page)).toBe(commands);await expect(page.getByLabel('Style',{exact:true})).toHaveValue(String(style));
  expect(errors).toEqual([]);
});}

test('matrix: all presets, undo, reset, themes, section navigation',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);await page.goto('/');const initial=await consoleText(page);
  await expect(page.getByRole('button',{name:'Undo Changes',exact:true})).toHaveCount(1);await expect(page.getByRole('button',{name:'Reset',exact:true})).toHaveCount(1);
  for(const preset of presets){await page.locator('button.preset').filter({hasText:preset.name}).click();await expect(page.getByLabel('Style',{exact:true})).toHaveValue(String(preset.settings.cl_crosshairstyle));await page.getByRole('button',{name:'Undo Changes',exact:true}).click();expect(await consoleText(page)).toBe(initial);}
  for(const theme of ['tactical','crimson','cs2']){await page.getByLabel('Appearance').selectOption(theme);await expect(page.locator('html')).toHaveAttribute('data-theme',theme);await page.reload();await expect(page.getByLabel('Appearance')).toHaveValue(theme);}
  const navigation=page.getByRole('navigation',{name:'Crosshair sections'});
  for(const [button,heading] of [['Style','Style Settings'],['Crosshair','Crosshair Settings']]){await navigation.getByRole('button',{name:button,exact:true}).click();await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();await expect(page.locator('.settings-section')).toHaveCount(1);}
  await navigation.getByRole('button',{name:'All settings',exact:true}).click();await expect(page.locator('.settings-section')).toHaveCount(2);
  await number(page,'Thickness',6);const changed=await consoleText(page);
  await page.getByRole('button',{name:'Copy link',exact:true}).click();await page.goto(await clipboard(page));expect(await consoleText(page)).toBe(changed);
  await page.getByRole('button',{name:'Reset crosshair',exact:true}).click();expect(await consoleText(page)).toBe(initial);await page.getByRole('button',{name:'Undo Changes',exact:true}).click();expect(await consoleText(page)).toBe(changed);
});

test('matrix: numeric bounds, slider synchronization, clipboard paste, code rejects and spectator visibility',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);await page.goto('/');await page.getByLabel('Style',{exact:true}).selectOption('2');
  const gap=page.getByRole('spinbutton',{name:'Gap',exact:true});await gap.fill('-999');await gap.press('Enter');await expect(gap).toHaveValue('-10');await expect(page.getByLabel('Gap slider',{exact:true})).toHaveValue('-10');
  await gap.fill('999');await gap.press('Enter');await expect(gap).toHaveValue('128');await expect(page.getByLabel('Gap slider',{exact:true})).toHaveValue('128');
  await gap.fill('');await gap.press('Enter');await expect(gap).toHaveValue('128');
  await page.getByLabel('Gap slider',{exact:true}).fill('31');await expect(gap).toHaveValue('31');
  await page.getByLabel('Show Player Crosshairs',{exact:true}).selectOption('0');await expect(page.getByLabel('Show my crosshair when spectating bots',{exact:true})).toHaveCount(0);
  await page.getByLabel('Show Player Crosshairs',{exact:true}).selectOption('2');await page.getByLabel('Show my crosshair when spectating bots',{exact:true}).selectOption('2');
  const code=await page.getByLabel('Current CS2 share code').inputValue();await page.getByRole('button',{name:'Copy crosshair code',exact:true}).click();await page.getByRole('button',{name:'Share or Import',exact:true}).click();
  await page.getByRole('button',{name:'Paste clipboard',exact:true}).click();await expect(page.getByLabel('Crosshair code or config')).toHaveValue(code);
  for(const invalid of ['CSINVALID','cl_crosshair_length 999','quit','cl_crosshair_thickness 1.5']){await page.getByLabel('Crosshair code or config').fill(invalid);await page.getByRole('button',{name:'Import crosshair',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByLabel('Current CS2 share code')).toHaveValue(code);}
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
  await importText(page,'cl_crosshair_thickness 1; quit');await expect(page.getByRole('spinbutton',{name:'Thickness',exact:true})).toHaveValue('1');
});
