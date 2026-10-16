import {useState} from 'react';
import type {UpdateLibrary} from './library-sync';
import {Bookmark,Copy,Download,Pencil,Search,Star,Trash2,Upload} from 'lucide-react';
import {Preview} from './Preview';
import {encode} from './codec';
import {limitLibrary,type Saved} from './storage';

type Props={library:Saved[];setLibrary:UpdateLibrary;onLoad:(item:Saved)=>void;onCopy:(text:string,label:string)=>void;onBackup:()=>void;onRestore:()=>void;notify:(text:string)=>void;user:{steamId:string}|null;status:string;syncing:boolean;error:string;available:boolean;hasGuestFavorites:boolean;onMerge:()=>void;onRetry:()=>void;onSignOut:()=>void;signIn:string};
export function LibraryView(p:Props){
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('favorites');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [renaming,setRenaming]=useState<string|null>(null);
  const [rename,setRename]=useState('');
  const favorites=p.library.filter(item=>item.favorite);
  const visible=p.library.filter(item=>(filter==='all'||(filter==='favorites'?item.favorite:!item.favorite))&&item.name.toLowerCase().includes(search.toLowerCase()));
  const stored=p.library.find(item=>item.id===selectedId)??null;
  const selected=visible.find(item=>item.id===selectedId)??stored??visible[0];
  const syncLabel=p.syncing?'Syncing your library…':p.error.startsWith('Changes could not be saved')?'Changes could not be saved':p.status==='error'&&!p.user?'Local save failed':p.user?(p.status==='synced'?'Synced':p.status==='loading'?'Loading your Steam library…':'Saved on this device · waiting to sync'):'Saved on this device';
  function finishRename(item:Saved){
    const name=rename.trim();
    if(!name){p.notify('Give your crosshair a name.');return;}
    if(p.setLibrary(items=>items.map(entry=>entry.id===item.id?{...entry,name,date:new Date().toISOString()}:entry)))setRenaming(null);
    else p.notify('Rename could not be saved on this device.');
  }
  function toggleFavorite(item:Saved){
    if(!item.favorite&&favorites.length>=50){p.notify('Favorite limit reached.');return;}
    p.setLibrary(items=>limitLibrary(items.map(entry=>entry.id===item.id?{...entry,favorite:!entry.favorite,date:new Date().toISOString()}:entry)));
  }
  return <main className="collection-page" aria-label="Crosshair library">
    <div className="collection-heading">
      <div>
        <p className="eyebrow">YOUR COLLECTION</p>
        <h1>Your crosshair library</h1>
        <p className="intro">Save a name or player nickname. Preview, copy, or edit any saved crosshair.</p>
      </div>
      <span className="collection-count">{favorites.length} saved</span>
    </div>
    <section className="sync-panel" aria-label="Steam library sync">
      <div>
        <p className="sync-label" aria-label="Library sync status" aria-live="polite">{syncLabel}</p>
        <p>{p.user?`Private library · Steam ${p.user.steamId}`:'Use Steam to access your private collection across devices. Drafts and recent imports stay on this device.'}</p>
        {p.error&&<p className="error-text">{p.error}</p>}
      </div>
      <div className="sync-actions">
        {p.user?<>
          <button disabled={p.syncing} aria-busy={p.syncing} onClick={p.onRetry}>
            {p.syncing?'Syncing…':p.status==='synced'?'Sync now':'Retry sync'}
          </button>
          <button onClick={p.onSignOut}>Sign out</button>
        </>:p.available?<a className="steam-login" href={p.signIn}>Sign in with Steam</a>:<span className="section-note">Steam sign-in is unavailable on this host. Local saving and backups still work.</span>}
      </div>
    </section>
    {p.user&&p.hasGuestFavorites&&<section className="guest-merge">
      <p>This device has saved crosshairs outside your Steam library. Add them without replacing your online collection. Exact duplicates are skipped.</p>
      <button className="primary-button" onClick={p.onMerge}>Add this device's saved crosshairs</button>
    </section>}
    <div className="collection-layout">
      <section className="collection-list-panel">
        <div className="library-tools">
          <div className="search-box">
            <Search size={16}/>
            <input aria-label="Search crosshairs" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or player nickname"/>
          </div>
          <select aria-label="Library filter" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="favorites">Saved crosshairs</option>
            <option value="history">Recent imports</option>
            <option value="all">All crosshairs</option>
          </select>
        </div>
        <p className="section-note">Up to 50 saved crosshairs. Recent history is separate and keeps up to 20 entries on this device.</p>
        <div className="collection-list">
          {visible.map(item=><article className={`library-item ${selected?.id===item.id?'selected':''}`} key={item.id}>
            <button className="library-preview" aria-label={`Preview ${item.name}`} aria-pressed={selected?.id===item.id} onClick={()=>setSelectedId(item.id)}>
              <Preview settings={item.settings} zoom={2} decorative fit/>
            </button>
            <div className="library-info">
              {renaming===item.id?<input autoFocus aria-label="Rename crosshair" value={rename} maxLength={80} onChange={e=>setRename(e.target.value)} onBlur={()=>finishRename(item)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape')setRenaming(null);}}/>:<strong>{item.name}</strong>}
              <span>{item.favorite?'Saved crosshair':'Recent import'}</span>
            </div>
            <div className="library-item-actions">
              <button onClick={()=>p.onLoad(item)}>Load</button>
              <button className="icon-button" aria-label={`Copy ${item.name}`} title="Copy crosshair code" onClick={()=>p.onCopy(encode(item.settings),'Share code')}><Copy size={16}/></button>
              <button className="icon-button" aria-label={`Rename ${item.name}`} onClick={()=>{setRename(item.name);setRenaming(item.id);}}><Pencil size={15}/></button>
              <button className={`icon-button ${item.favorite?'favorite':''}`} aria-label={`${item.favorite?'Unfavorite':'Favorite'} ${item.name}`} onClick={()=>toggleFavorite(item)}><Star size={15}/></button>
              <button className="icon-button" aria-label={`Remove ${item.name}`} onClick={()=>p.setLibrary(items=>items.filter(entry=>entry.id!==item.id))}><Trash2 size={15}/></button>
            </div>
          </article>)}
          {!visible.length&&<div className="empty-library">
            <Bookmark size={32}/>
            <h2>{search?'No matching crosshairs.':filter==='history'?'No recent imports.':'Your collection starts here.'}</h2>
            <p>{search?'Try another name.':'Import a code in the editor, then save it with a name or player nickname.'}</p>
          </div>}
        </div>
        <div className="collection-backups">
          <button onClick={p.onRestore}><Upload size={15}/>Restore backup</button>
          <button onClick={p.onBackup}><Download size={15}/>Export library</button>
        </div>
      </section>
      <section className="selected-crosshair" aria-label="Selected crosshair">
        {selected?<>
          <h2>{selected.name}</h2>
          <div className="collection-map"><Preview settings={selected.settings} zoom={2} fit paused/></div>
          <label className="field-label" htmlFor="selected-code">CS2 SHARE CODE</label>
          <textarea id="selected-code" className="selected-code" aria-label="Selected crosshair code" value={encode(selected.settings)} readOnly/>
          <button className="primary-button full" onClick={()=>p.onCopy(encode(selected.settings),'Share code')}><Copy size={16}/>Copy selected crosshair code</button>
          <button className="quiet-button full" onClick={()=>p.onLoad(selected)}>Edit crosshair</button>
          <p className="section-note">Editing creates a working draft. Your saved copy changes only when you choose Update saved crosshair.</p>
        </>:<p className="section-note">Select a saved crosshair to preview it here.</p>}
      </section>
    </div>
  </main>;
}
