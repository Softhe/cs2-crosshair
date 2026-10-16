import { validateSettings, safeAlias, HEIGHT_MAX, type Settings } from './model';
import { newId } from './ids';
export type Saved = {id:string;name:string;alias:string;settings:Settings;favorite:boolean;date:string};

const memory = new Map<string, string>();

function local(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function remember(key: string, serialized: string): void {
  try {
    memory.set(key, serialized);
  } catch {
    /* Memory fallback is best-effort. */
  }
}

export function read<T>(key:string,fallback:T):T {
  const full = 'delli.v3.' + key;
  const store = local();
  if (store) {
    try {
      const raw = store.getItem(full);
      if (raw !== null && raw !== undefined) return (JSON.parse(raw) as T) ?? fallback;
      return fallback;
    } catch {
      /* Local lookup failed: fall through to the in-memory copy. */
    }
  }
  try {
    const raw = memory.get(full);
    if (raw !== undefined) return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    /* Corrupt memory entry: return the fallback. */
  }
  return fallback;
}

export function write(key:string,value:unknown):boolean {
  const full = 'delli.v3.' + key;
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return false;
  }
  const store = local();
  if (!store) {
    remember(full, serialized);
    return false;
  }
  try {
    store.setItem(full, serialized);
    try {
      memory.delete(full);
    } catch {
      /* Memory bookkeeping is best-effort. */
    }
    return true;
  } catch {
    remember(full, serialized);
    return false;
  }
}
export function limitLibrary(entries:Saved[]):Saved[]{return [...entries.filter(item=>item.favorite).slice(0,50),...entries.filter(item=>!item.favorite).slice(0,20)];}
export function validateLibrary(value:unknown):Saved[]{
  if(!Array.isArray(value)||value.length>70)throw Error('A library may contain up to 70 crosshairs.');
  const ids=new Set<string>();
  return value.map((item)=>{
    if(!item||typeof item!=='object'||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||typeof item.favorite!=='boolean')throw Error('Invalid library entry.');
    const id=typeof item.id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(item.id)&&!ids.has(item.id)?item.id:newId();ids.add(id);
    try {
      return {id,name:item.name,alias:safeAlias(typeof item.alias==='string'?item.alias:''),favorite:item.favorite,date:typeof item.date==='string'?item.date:new Date().toISOString(),settings:validateSettings(item.settings)};
    } catch (cause) {
      // Migration: heights up to 65535 were previously allowed; clamp to the
      // current supported max instead of invalidating the stored entry.
      const rawHeight=(item.settings as {cl_crosshair_screen_height?: unknown} | null | undefined)?.cl_crosshair_screen_height;
      if(typeof rawHeight!=='number'||!Number.isFinite(rawHeight)||rawHeight<=HEIGHT_MAX) throw cause;
      try {
        const settings=validateSettings({...item.settings,cl_crosshair_screen_height:HEIGHT_MAX});
        return {id,name:item.name,alias:safeAlias(typeof item.alias==='string'?item.alias:''),favorite:item.favorite,date:typeof item.date==='string'?item.date:new Date().toISOString(),settings};
      } catch {
        throw cause;
      }
    }
  });
}

export function settingsKey(settings:Settings):string {return JSON.stringify(Object.keys(settings).sort().map(key=>[key,settings[key as keyof Settings]]));}
