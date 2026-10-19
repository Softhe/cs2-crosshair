import {useEffect,useRef,useState} from 'react';
import {Check,ChevronDown,Cloud,CloudOff,ExternalLink,LoaderCircle,LogOut,RefreshCw} from 'lucide-react';

type Props={
 user:{steamId:string}|null;
 sessionState:'checking'|'ready'|'unavailable';
 status:string;
 syncing:boolean;
 signIn:string;
 view:string;
 onOpenLibrary:()=>void;
 onRetry:()=>Promise<unknown>;
 onSignOut:()=>Promise<boolean>;
};

function SteamMark(){
 return <svg className="steam-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/></svg>;
}

export function SteamAccount(p:Props){
 const [open,setOpen]=useState(false),[signingOut,setSigningOut]=useState(false),[logoutError,setLogoutError]=useState('');
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{setOpen(false);setLogoutError('');},[p.view,p.user?.steamId]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 const syncLabel=p.syncing?'Syncing…':p.status==='synced'?'Synced':p.status==='loading'?'Loading library…':p.status==='error'?'Sync needs attention':p.status==='pending'?'Saved changes waiting to sync':'Waiting to sync';
 async function signOut(){setSigningOut(true);setLogoutError('');try{if(await p.onSignOut())setOpen(false);else setLogoutError('Could not sign out. Try again.');}catch{setLogoutError('Could not sign out. Try again.');}finally{setSigningOut(false);}}
 return <div className="steam-account" ref={root} onBlur={event=>{if(event.relatedTarget instanceof Node&&!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
  {p.user?<button className="steam-account-trigger" ref={trigger} aria-label="Steam account" aria-expanded={open} aria-controls="steam-account-panel" onClick={()=>setOpen(!open)}><SteamMark/><span><strong>Steam connected</strong><small className={p.status==='error'?'needs-attention':''}>{p.syncing?<LoaderCircle size={12} className="account-spinner"/>:p.status==='synced'?<Check size={12}/>:<Cloud size={12}/>} {syncLabel}</small></span><ChevronDown size={15}/></button>
   :p.sessionState==='checking'?<button className="steam-sign-in" disabled aria-busy="true"><LoaderCircle size={18} className="account-spinner"/><span>Checking Steam…</span></button>
   :p.sessionState==='ready'?<a className="steam-sign-in" href={p.signIn} aria-label="Sign in with Steam" title="Sign in with Steam to sync your saved crosshairs"><SteamMark/><span>Sign in<span className="steam-sign-in-extra"> with Steam</span></span></a>
   :<button className="steam-sign-in steam-unavailable" ref={trigger} aria-expanded={open} aria-controls="steam-account-panel" onClick={()=>setOpen(!open)}><SteamMark/><span>Steam unavailable</span><ChevronDown size={14}/></button>}
  {open&&<section id="steam-account-panel" className="steam-account-panel" aria-label={p.user?'Steam account details':'Steam sign-in availability'}>
   {p.user?<><p className="account-panel-title"><SteamMark/>Signed in with Steam</p><p className="account-id">Steam ID <code>{p.user.steamId}</code></p><p className="account-sync" aria-live="polite">{syncLabel}. Only saved crosshairs sync.</p><button onClick={()=>{setOpen(false);p.onOpenLibrary();}}><ExternalLink size={16}/>Open your library</button><button disabled={signingOut} onClick={()=>void signOut()}><LogOut size={16}/>{signingOut?'Signing out…':'Sign out of Steam'}</button>{logoutError&&<p className="error-text" role="alert">{logoutError}</p>}</>
    :<><p className="account-panel-title"><CloudOff size={18}/>Steam sign-in is unavailable</p><p>We could not connect to sign-in on this host. You can keep editing and saving on this device.</p><button onClick={()=>{setOpen(false);void p.onRetry();}}><RefreshCw size={16}/>Retry connection</button></>}
  </section>}
 </div>;
}
