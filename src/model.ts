export const styles = [
  [4, 'Static Cross'], [3, 'Static Circle'], [8, 'Static Square'], [6, 'Dot Only'],
  [9, 'Static Quadrant'], [0, 'Dynamic Cross'], [1, 'Dynamic Circle'],
  [2, 'Dynamic Cross (Classic)'], [5, 'Dynamic Cross (Legacy/Shot Feedback)'], [7, 'Dynamic Quadrant'],
] as const;

export type Settings = Record<string, number>;
export type Field = { key: string; label: string; min?: number; max?: number; step?: number; options?: readonly (readonly [number, string])[]; hint?: string };
const yesNo = [[1, 'Yes'], [0, 'No']] as const;
export const defaults: Settings = {
  cl_crosshairstyle: 7, cl_crosshaircolor_r: 0, cl_crosshaircolor_g: 255, cl_crosshaircolor_b: 0, cl_crosshaircolor_a: 255,
  cl_crosshairoutline_r: 0, cl_crosshairoutline_g: 0, cl_crosshairoutline_b: 0, cl_crosshairoutline_a: 255,
  cl_crosshair_drawoutline: 1, cl_crosshair_thickness: 2, cl_crosshairdot: 0, cl_crosshair_length: 8, cl_crosshair_gap: 4,
  cl_crosshair_dynamic_spread_limit: 255, cl_crosshair_dynamic_splitdist: 3,
  cl_crosshair_dynamic_splitalpha_innermod: 0, cl_crosshair_dynamic_splitalpha_outermod: 1, cl_crosshair_dynamic_maxdist_splitratio: 1,
  cl_crosshair_t: 0, cl_ironsight_usecrosshaircolor: 0, cl_ironsight_dot_scale: 1, cl_crosshair_recoil: 0,
  cl_crosshair_friendly_warning: 0, cl_show_observer_crosshair: 2, cl_observed_bot_crosshair: 0,
  cl_grenadecrosshair_keepusercrosshair: 1,
  cl_sniper_delay_unscope: 0, cl_sniper_show_inaccuracy: 1, cl_sniper_auto_rezoom: 1, cl_crosshair_sniper_width: 1,
  cl_crosshair_screen_height: 1080,
  ...Object.fromEntries(['flash','explosive','fire','smoke','decoy'].flatMap(k=>[[`cl_grenadecrosshair_${k}`,1],[`cl_grenadecrosshairdelay_${k}`,2]])),
};
const toggle = (key: string, label: string): Field => ({key,label,options:yesNo});
const slider = (key: string, label: string, min: number, max: number, step=1): Field => ({key,label,min,max,step});
export function styleFields(s: Settings): Field[] {
  const style = s.cl_crosshairstyle;
  const fields: Field[] = [{key:'cl_crosshairstyle',label:'Style',options:styles},
    {key:'cl_crosshair_drawoutline',label:'Outline',options:[[1,'Full Outline'],[2,'Half Outline'],[0,'No Outline']]},
    slider('cl_crosshair_thickness','Thickness',0,32)];
  if(style!==6) fields.push(toggle('cl_crosshairdot','Center Dot'));
  if([0,2,4,5,7].includes(style)) fields.push(slider('cl_crosshair_length','Length',0,255));
  if([0,2,3,4,5,7,8,9].includes(style)) fields.push(slider('cl_crosshair_gap','Gap',-10,128));
  if([0,1,7].includes(style)) fields.push(slider('cl_crosshair_dynamic_spread_limit','Dynamic Spread Limit',0,255));
  if(style===2) fields.push(slider('cl_crosshair_dynamic_splitdist','Split Distance',0,127),
    slider('cl_crosshair_dynamic_splitalpha_innermod','Inner Split Alpha',0,1,.01),
    slider('cl_crosshair_dynamic_splitalpha_outermod','Outer Split Alpha',.3,1,.01),
    slider('cl_crosshair_dynamic_maxdist_splitratio','Split Size Ratio',0,1,.01));
  if(style===9) fields.push(slider('cl_crosshair_dynamic_maxdist_splitratio','Quadrant Size',0,1,.01));
  if([0,2,4,5,7].includes(style)) fields.push(toggle('cl_crosshair_t','T Style'));
  fields.push(toggle('cl_ironsight_usecrosshaircolor','Use crosshair color for scope dot'),slider('cl_ironsight_dot_scale','Scope dot scale',.1,2,.01),toggle('cl_crosshair_recoil','Follow Recoil'));
  return fields;
}
export const crosshairFields: Field[] = [
  {key:'cl_crosshair_friendly_warning',label:'Friendly Fire Reticle Warning',options:[[0,'Always Off'],[1,'Always On']]},
  {key:'cl_show_observer_crosshair',label:'Show Player Crosshairs',options:[[0,'No'],[1,'Friends and Party'],[2,'Everyone']]},
  {key:'cl_observed_bot_crosshair',label:'Show my crosshair when spectating bots',options:[[0,'Always'],[1,'When I can take over bot'],[2,'Never']]},
];
export const grenadeTypes = [['flash','Flashbangs'],['explosive','HE grenades'],['fire','Molotov cocktails / Incendiary grenades'],['smoke','Smoke grenades'],['decoy','Decoy grenades']] as const;
export const grenadeKeep = toggle('cl_grenadecrosshair_keepusercrosshair','Keep Regular Crosshair');
export const sniperFields: Field[] = [toggle('cl_sniper_delay_unscope','Delay Sniper Rifle Un-Scope after Shot'),toggle('cl_sniper_show_inaccuracy','Show Scoped Sniper Rifle Inaccuracy'),toggle('cl_sniper_auto_rezoom','Auto Re-Zoom Sniper Rifle after Shot'),slider('cl_crosshair_sniper_width','Sniper Crosshair Thickness',1,6)];
export function fieldBounds(key: string): Field | undefined {
  if(/^cl_crosshair(color|outline)_[rgba]$/.test(key)) return slider(key,key,0,255);
  if(key==='cl_crosshair_screen_height') return slider(key,key,240,65535);
  if(key==='cl_crosshair_gap') return slider(key,key,-10,128);
  if(key.startsWith('cl_grenadecrosshairdelay_')) return slider(key,key,0,5,.01);
  if(key.startsWith('cl_grenadecrosshair_')) return toggle(key,key);
  return [...styles.flatMap(([style])=>styleFields({...defaults,cl_crosshairstyle:style})),...crosshairFields,...sniperFields].find(f=>f.key===key);
}
export function validateSettings(value: unknown): Settings {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw Error('Settings must be an object.');
  const out = {...defaults};
  for(const [key,val] of Object.entries(value)) {
    if(!(key in defaults)) throw Error(`Unknown setting: ${key}`);
    const field=fieldBounds(key);
    if(typeof val!=='number'||!Number.isFinite(val)||!field) throw Error(`Invalid value for ${key}.`);
    if(field.options ? !field.options.some(([n])=>n===val) : val<(field.min??0)||val>(field.max??255)||Math.abs(val/(field.step??1)-Math.round(val/(field.step??1)))>1e-6) throw Error(`Value outside supported range for ${key}.`);
    out[key]=val;
  }
  return out;
}
export function safeAlias(name: string): string {
  const alias=name.trim();
  if(alias && !/^[a-zA-Z_][a-zA-Z0-9_]{0,47}$/.test(alias)) throw Error('Use letters, numbers and underscores. Start with a letter or underscore, up to 48 characters.');
  if(alias && /^(exec|alias|bind|unbind|quit|exit|clear|echo|crosshair|cl_|sv_|host_)/i.test(alias)) throw Error('Choose an alias that does not conflict with a game command.');
  return alias;
}
export function commands(s: Settings): string { return Object.entries(validateSettings(s)).map(([key,val])=>`${key} "${val}"`).join('; '); }
export function cfg(s: Settings): string { return '// delli.cc Crosshair Studio | CS2 September 2026\n'+commands(s).split('; ').join('\n')+'\n'; }
export function autoexec(s: Settings, name: string): string { const alias=safeAlias(name); return alias?`alias ${alias} "exec crosshair_${alias}.cfg"`:commands(s); }
export const presets = [
  {name:'Small static',settings:{...defaults,cl_crosshairstyle:4,cl_crosshair_length:4,cl_crosshair_thickness:1,cl_crosshair_gap:2,cl_crosshair_recoil:0}},
  {name:'Dot',settings:{...defaults,cl_crosshairstyle:6,cl_crosshair_thickness:3,cl_crosshair_recoil:0}},
  {name:'High visibility',settings:{...defaults,cl_crosshairstyle:4,cl_crosshair_length:12,cl_crosshair_thickness:3,cl_crosshaircolor_r:255,cl_crosshaircolor_g:220,cl_crosshaircolor_b:0}},
  {name:'Classic green',settings:{...defaults,cl_crosshairstyle:2,cl_crosshair_dynamic_splitalpha_innermod:1,cl_crosshair_dynamic_splitalpha_outermod:.5,cl_crosshair_dynamic_maxdist_splitratio:.35}},
];
