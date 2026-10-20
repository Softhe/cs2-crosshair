async function readbackMatches(text:string):Promise<boolean|undefined>{
  try{
    const permission=await navigator.permissions.query({name:'clipboard-read' as PermissionName});
    if(permission.state!=='granted')return undefined;
    return await navigator.clipboard.readText()===text;
  }catch{return undefined;}
}

function copyWithSelection(text:string):boolean{
  const active=document.activeElement as HTMLElement|null;
  const input=active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement?active:null;
  const start=input?.selectionStart,end=input?.selectionEnd,direction=input?.selectionDirection;
  const selection=document.getSelection();const ranges=selection?Array.from({length:selection.rangeCount},(_,index)=>selection.getRangeAt(index).cloneRange()):[];
  const scrollX=window.scrollX,scrollY=window.scrollY;
  const textarea=document.createElement('textarea');textarea.value=text;textarea.setAttribute('readonly','');textarea.setAttribute('aria-hidden','true');
  textarea.setAttribute('inputmode','none');
  try{
    (textarea as HTMLTextAreaElement & { inputMode?: string }).inputMode='none';
  }catch{/* inputMode is best-effort for iOS. */}
  Object.assign(textarea.style,{position:'fixed',top:'-9999px',left:'0',opacity:'0',pointerEvents:'none'});
  document.body.append(textarea);
  try{textarea.focus({preventScroll:true});textarea.select();return document.execCommand('copy');}
  catch{return false;}
  finally{
    textarea.remove();active?.focus({preventScroll:true});
    if(input&&start!==null&&start!==undefined&&end!==null&&end!==undefined){try{input.setSelectionRange(start,end,direction??undefined);}catch{/* Number inputs do not support text selection. */}}
    else if(selection){selection.removeAllRanges();for(const range of ranges)selection.addRange(range);}
    window.scrollTo(scrollX,scrollY);
  }
}

async function copyWithClipboardItem(text:string):Promise<boolean>{
  try{
    const clipboard=navigator.clipboard;
    if(!clipboard||typeof clipboard.write!=='function')return false;
    const ItemCtor=(globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
    if(typeof ItemCtor==='undefined')return false;
    await clipboard.write([new ItemCtor({'text/plain':new Blob([text],{type:'text/plain'})})]);
    // A mismatched readback means the write did not stick: fall back to the selection path.
    return await readbackMatches(text)!==false;
  }catch{return false;}
}

/** Some embedded browsers resolve clipboard writes without storing the text. */
export async function copyText(text:string):Promise<boolean>{
  try{
    await navigator.clipboard.writeText(text);
    // Read permission is independent: denial does not disprove a successful write.
    if(await readbackMatches(text)!==false)return true;
  }catch{/* Try the ClipboardItem path, then the selection-based path. */}
  if(await copyWithClipboardItem(text))return true;
  if(!copyWithSelection(text))return false;
  return await readbackMatches(text)!==false;
}
