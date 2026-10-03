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
  Object.assign(textarea.style,{position:'fixed',top:'0',left:'0',opacity:'0',pointerEvents:'none'});
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

/** Some embedded browsers resolve clipboard writes without storing the text. */
export async function copyText(text:string):Promise<boolean>{
  try{
    await navigator.clipboard.writeText(text);
    // Read permission is independent: denial does not disprove a successful write.
    if(await readbackMatches(text)!==false)return true;
  }catch{/* Try the selection-based clipboard path when the API fails. */}
  if(!copyWithSelection(text))return false;
  return await readbackMatches(text)!==false;
}
