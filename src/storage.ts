import { validateSettings, safeAlias, type Settings } from './model';
export type Saved = {id:string;name:string;alias:string;settings:Settings;favorite:boolean;date:string};
export function read<T>(key:string,fallback:T):T {try{return JSON.parse(localStorage.getItem('delli.v3.'+key)??'null')??fallback;}catch{return fallback;}}
export function write(key:string,value:unknown):boolean {try{localStorage.setItem('delli.v3.'+key,JSON.stringify(value));return true;}catch{return false;}}
export function limitLibrary(entries:Saved[]):Saved[]{return [...entries.filter(item=>item.favorite).slice(0,50),...entries.filter(item=>!item.favorite).slice(0,20)];}
export function validateLibrary(value:unknown):Saved[]{
  if(!Array.isArray(value)||value.length>70)throw Error('A library may contain up to 70 crosshairs.');
  return value.map((item)=>{
    if(!item||typeof item!=='object'||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||typeof item.favorite!=='boolean')throw Error('Invalid library entry.');
    return {id:crypto.randomUUID(),name:item.name,alias:safeAlias(typeof item.alias==='string'?item.alias:''),favorite:item.favorite,date:typeof item.date==='string'?item.date:new Date().toISOString(),settings:validateSettings(item.settings)};
  });
}
