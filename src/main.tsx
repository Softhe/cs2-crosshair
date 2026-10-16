import { useEffect, useRef, useState } from 'react';
import {createRoot} from 'react-dom/client';
import {Crosshair, Copy, Download, Upload, X, Check} from 'lucide-react';
import {styles,defaults,presets,commands,safeAlias,validateSettings,type Settings} from './model';
import {encode,decode,importCommands} from './codec';
import {Preview} from './Preview';
import {convertLegacy} from './converter';
import {useDisplayEstimate} from './display';
import {downloadConfig} from './config-export';
import type { RenderStatus } from './preview-renderer';
import type { PreviewMode } from './preview-geometry';
import {copyText} from './clipboard';
import {read,write,validateLibrary,limitLibrary,settingsKey,type Saved} from './storage';
import {newId} from './ids';
import {useUndo} from './useUndo';
import {useLibrarySync} from './library-sync';
import {LibraryView} from './LibraryView';
import {ImportBar} from './components/ImportBar';
import {MapPreview} from './components/MapPreview';
import {SettingsList} from './components/SettingsList';
import {ExportCard} from './components/ExportCard';
import {Dialogs} from './components/Dialogs';
import './style.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/jetbrains-mono/latin-400.css';

function initial(): {settings:Settings;error?:string;note?:string}{
  try{
    const params=new URLSearchParams(location.search);
    const code=params.get('code')??params.get('crosshair')??(location.pathname.startsWith('/CS')?location.pathname.slice(1):null);
    if(code){const result=decode(code);const complete=params.get('settings');if(complete){const full=validateSettings(JSON.parse(complete));if(encode(full)!==encode(result.settings))throw Error('The link contains conflicting crosshair settings.');return {settings:full,note:result.note};}return {settings:result.settings,note:result.note};}
    const full=params.get('settings');if(full)return {settings:validateSettings(JSON.parse(full))};
    return {settings:{...validateSettings(read('draft',defaults)),cl_crosshair_recoil:0,cl_crosshair_friendly_warning:0}};
  }catch(error){return {settings:{...defaults},error:message(error)};}
}
function message(error:unknown){return error instanceof Error?error.message:'Something went wrong.';}
function download(text:string,name:string,type='text/plain') {const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function readView(): 'editor'|'library' {return new URLSearchParams(location.search).get('view')==='library'?'library':'editor';}

function App(){
  const start=useRef(initial());
  const [s,setSettings]=useState(start.current.settings);
  const undoHistory=useUndo(s);
  const [alias,setAlias]=useState(()=>read<string>('alias',''));
  const [map,setMap]=useState(0);
  const [zoom,setZoom]=useState(1);
  const [dynamic,setDynamic]=useState(false);
  const [previewMode,setPreviewMode]=useState<PreviewMode>('crosshair');
  const display=useDisplayEstimate();
  const [displayHeight,setDisplayHeight]=useState(0);
  const [displayHeightDraft,setDisplayHeightDraft]=useState<string|null>(null);
  const [fullscreen,setFullscreen]=useState(false);
  const mapRef=useRef<HTMLDivElement>(null);
  const [targetHeight,setTargetHeight]=useState(-1);
  const effectiveHeight=targetHeight===-1?(displayHeight||display.height):targetHeight;
  const [fit,setFit]=useState(false);
  const [phase,setPhase]=useState(0);
  const [inspectSplit,setInspectSplit]=useState(false);
  const [previewStatus,setPreviewStatus]=useState<RenderStatus>({clipped:false,scale:1});
  const [theme,setTheme]=useState(()=>read<string>('theme','cs2'));
  const [modal,setModal]=useState<'help'|'preview'|null>(null);
  const [toast,setToast]=useState(new URLSearchParams(location.search).get('steam')==='failed'?'Steam sign-in was not completed. Try again from Library.':start.current.error??start.current.note??'');
  const [importDraft,setImportText]=useState<string|null>(null);
  const [importError,setImportError]=useState('');
  const [legacyHeight,setLegacyHeight]=useState(1080);
  const [guestLibrary,setGuestLibrary]=useState<Saved[]>(()=>{try{return validateLibrary(read('library',[]));}catch{return [];}});
  const sync=useLibrarySync(guestLibrary,setGuestLibrary);
  const {library,setLibrary}=sync;
  const [view,setViewState]=useState<'editor'|'library'>(()=>readView());
  const [savedName,setSavedName]=useState('My crosshair');
  const [editingId,setEditingId]=useState<string|null>(null);
  const [rating,setRating]=useState(()=>read<number>('rating',0));
  const [note,setNote]=useState(()=>read<string>('feedback-note',''));
  const backupInput=useRef<HTMLInputElement>(null);
  const cfgInput=useRef<HTMLInputElement>(null);
  const dialogRef=useRef<HTMLDialogElement>(null);
  const clipboardRequest=useRef(0);
  const code=encode(s);
  const importText=importDraft??code;
  let aliasError='';
  try{safeAlias(alias);}catch(e){aliasError=message(e);}
  const notify=(text:string)=>setToast(text);
  function setView(next:'editor'|'library'){
    setViewState(next);
    try{
      const url=new URL(location.href);
      if(next==='library')url.searchParams.set('view','library');
      else url.searchParams.delete('view');
      history.pushState(null,'',url.pathname+url.search+url.hash);
    }catch{/* History routing is best-effort. */}
  }
  useEffect(()=>{
    const onPop=()=>setViewState(readView());
    window.addEventListener('popstate',onPop);
    return ()=>window.removeEventListener('popstate',onPop);
  },[]);
  useEffect(()=>{const update=()=>setFullscreen(document.fullscreenElement===mapRef.current);document.addEventListener('fullscreenchange',update);return()=>document.removeEventListener('fullscreenchange',update);},[]);
  const toggleFullscreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await mapRef.current?.requestFullscreen();}catch{notify('Fullscreen is unavailable in this browser. The inline preview remains usable.');}};
  useEffect(()=>{if(!write('draft',s))notify('Browser storage is unavailable. Export a config to keep your changes.');},[s]);
  useEffect(()=>{write('alias',alias);},[alias]);
  useEffect(()=>{if(!write('library',guestLibrary))notify('Library could not be saved. Download a backup.');},[guestLibrary]);
  useEffect(()=>{write('theme',theme);document.documentElement.dataset.theme=theme;},[theme]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),7000);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{if(modal)dialogRef.current?.showModal();else dialogRef.current?.close();},[modal]);
  function change(key:string,value:number){undoHistory.push(s);setSettings(prev=>({...prev,[key]:value}));}
  function load(settings:Settings){undoHistory.push(s);setSettings({...settings});}
  function reset(){load({...defaults});notify('Crosshair reset to the studio defaults.');}
  function goBack(){undoHistory.goBack(setSettings);}
  function remember(settings=s,name=styles.find(([id])=>id===settings.cl_crosshairstyle)?.[1]??'Crosshair',favorite=false){
    const entry:Saved={id:newId(),name,settings:{...settings},alias:aliasError?'':alias.trim(),favorite,date:new Date().toISOString()};
    setLibrary(prev=>{const same=prev.find(item=>settingsKey(item.settings)===settingsKey(settings));
      if(same?.favorite)return prev;
      if(same)return prev.map(item=>item.id===same.id?{...item,name:favorite?name:item.name,alias:entry.alias,date:entry.date,favorite:favorite||item.favorite}:item);
      const next=[entry,...prev];return [...next.filter(item=>item.favorite).slice(0,50),...next.filter(item=>!item.favorite).slice(0,20)];});
  }
  const currentFavorite=library.find(item=>item.favorite&&settingsKey(item.settings)===settingsKey(s));
  useEffect(()=>{if(currentFavorite)setSavedName(currentFavorite.name);},[currentFavorite?.id,currentFavorite?.name]);
  const editingFavorite=library.find(item=>item.favorite&&item.id===editingId);
  function saveFavorite(){
    if(!savedName.trim()){notify('Give your crosshair a name.');document.getElementById('saved-name')?.focus();return;}
    if(!currentFavorite&&library.filter(item=>item.favorite).length>=50){notify('Your library has 50 favorites. Remove one before saving another.');return;}
    if(currentFavorite){notify('This crosshair is already saved.');return;}
    const entry:Saved={id:newId(),name:savedName.trim(),settings:{...s},alias:aliasError?'':alias.trim(),favorite:true,date:new Date().toISOString()};
    if(setLibrary(items=>limitLibrary([entry,...items.filter(item=>item.favorite||settingsKey(item.settings)!==settingsKey(s))]))){setEditingId(entry.id);notify('Crosshair saved.');}else notify('Crosshair could not be saved on this device. Export a backup or free browser storage.');
  }
  function updateFavorite(){
    if(!editingFavorite)return;if(!savedName.trim()){notify('Give your crosshair a name.');return;}
    if(setLibrary(items=>items.map(item=>item.id===editingFavorite.id?{...item,name:savedName.trim(),settings:{...s},date:new Date().toISOString()}:item)))notify('Saved crosshair updated.');else notify('Update could not be saved on this device. Export a backup or free browser storage.');
  }
  function editSaved(item:Saved){load(item.settings);setAlias(item.alias);setSavedName(item.name);setEditingId(item.favorite?item.id:null);setView('editor');notify(item.name+' loaded.');}
  async function copy(text:string,label:string){if(await copyText(text))notify(`${label} copied.`);else notify('Clipboard access failed. Select and copy the text manually.');}
  function exportCfg(){if(aliasError){const panel=document.querySelector<HTMLDetailsElement>('.export-advanced');if(panel)panel.open=true;document.getElementById('alias')?.focus();notify(aliasError);return;}download(downloadConfig(s,alias),alias.trim()?`crosshair_${alias.trim()}.cfg`:'crosshair.cfg');notify('Config downloaded.');}
  function shareLink(){const url=new URL('/',location.origin);url.searchParams.set('code',code);url.searchParams.set('settings',JSON.stringify(s));return url.toString();}
  function doImport(text=importText){
    try{
      let result;
      if(text.trim().startsWith('CS')||/^https?:\/\//i.test(text.trim())){
        const parsed=decode(text,legacyHeight);
        result=parsed.settings;
        notify(parsed.note??(/^https?:\/\//i.test(text.trim())&&new URL(text.trim()).searchParams.has('settings')?'Crosshair and complete settings imported from link.':'Crosshair imported. Extra menu settings keep their current values.'));
        const codeKeys=Object.keys(result).filter(k=>k.startsWith('cl_crosshair')&&!['cl_crosshair_friendly_warning','cl_crosshair_sniper_width'].includes(k)||k.startsWith('cl_ironsight'));
        result=/^https?:\/\//i.test(text.trim())&&new URL(text.trim()).searchParams.has('settings')?result:{...s,...Object.fromEntries(codeKeys.map(k=>[k,result![k]]))};
      }else if(/\bcl_crosshair(?:size|thickness|gap|alpha|usealpha|color)\b/i.test(text)){
        result=convertLegacy(text,legacyHeight,legacyHeight,s).settings;
        notify('Old settings converted. Check the result in CS2. Use the converter panel to review warnings.');
      }else{
        result=importCommands(text,s);
        notify('Current CS2 config settings imported.');
      }
      load(result);
      setEditingId(null);
      remember(result);
      setImportText(null);
      setImportError('');
      setModal(null);
    }catch(error){setImportError(message(error));}
  }
  function pasteCode(text:string){clipboardRequest.current++;setImportText(text);setImportError('');if(text.trim().startsWith('CS')&&!text.trim().startsWith('CSGO')){doImport(text);} }
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();void copy(commands(s),'Console commands');}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);});
  const validPath=location.pathname==='/'||location.pathname==='/custom'||(/^\/(CS[A-Za-z0-9]{44}|CSGO(-[A-Za-z0-9]{5}){5})$/.test(location.pathname)&&!start.current.error);
  useEffect(()=>{if(location.pathname==='/custom')history.replaceState(null,'','/'+location.search+location.hash);},[]);
  if(!validPath)return <main className="not-found"><Crosshair size={52}/><h1>Crosshair not found</h1><p>This link does not point to a crosshair.</p><a href="/">Open the studio</a></main>;
  return <>
    <header className="header">
      <a className="brand" href="/" aria-label="delli.cc home">
        <Crosshair size={27}/>
        <strong>delli<span>.cc</span></strong>
        <span className="brand-divider"/>
        <span className="brand-subtitle">CROSSHAIR STUDIO</span>
      </a>
      <nav className="menu-nav" aria-label="Studio menu">
        <button
          className={view==='editor'?'active':''}
          aria-current={view==='editor'?'page':undefined}
          onClick={()=>{setView('editor');document.querySelector('.page-heading')?.scrollIntoView({behavior:'smooth'});}}
        >
          Crosshair / Scopes
        </button>
        <button
          aria-label="Library"
          className={view==='library'?'active':''}
          aria-current={view==='library'?'page':undefined}
          onClick={()=>setView('library')}
        >
          Library<span className="count">{library.filter(item=>item.favorite).length}</span>
        </button>
        <button onClick={()=>setModal('help')}>Guide</button>
      </nav>
      <div className="header-actions"><span className="build-badge"><i/>CS2 CROSSHAIR EDITOR</span></div>
    </header>
    {view==='editor'&&<>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COUNTER-STRIKE 2</p>
          <h1>Crosshair / Scopes <span className="new-badge">NEW SYSTEM</span></h1>
          <p className="intro">Your crosshair. Every detail.</p>
        </div>
        <label className="theme-picker">
          Appearance
          <select aria-label="Appearance" value={theme} onChange={e=>setTheme(e.target.value)}>
            <option value="cs2">CS2</option>
            <option value="tactical">Tactical</option>
            <option value="crimson">Crimson</option>
          </select>
        </label>
      </div>
      <main className="workspace">
        <section className="preview-section" aria-label="Crosshair preview">
          <ImportBar
            code={code}
            importText={importText}
            importDraft={importDraft}
            importError={importError}
            legacyHeight={legacyHeight}
            s={s}
            clipboardRequest={clipboardRequest}
            cfgInput={cfgInput}
            currentFavorite={currentFavorite}
            editingFavorite={editingFavorite}
            savedName={savedName}
            sync={sync}
            setImportText={setImportText}
            setImportError={setImportError}
            setLegacyHeight={setLegacyHeight}
            setModal={setModal}
            setSavedName={setSavedName}
            pasteCode={pasteCode}
            doImport={doImport}
            load={load}
            remember={remember}
            notify={notify}
            copy={copy}
            saveFavorite={saveFavorite}
            updateFavorite={updateFavorite}
            setToast={setToast}
          />
          <MapPreview
            s={s}
            map={map}
            setMap={setMap}
            zoom={zoom}
            setZoom={setZoom}
            effectiveHeight={effectiveHeight}
            dynamic={dynamic}
            previewMode={previewMode}
            setPreviewMode={setPreviewMode}
            phase={phase}
            fit={fit}
            inspectSplit={inspectSplit}
            fullscreen={fullscreen}
            modal={modal}
            previewStatus={previewStatus}
            mapRef={mapRef}
            setPreviewStatus={setPreviewStatus}
            toggleFullscreen={toggleFullscreen}
            setModal={setModal}
            goBack={goBack}
            reset={reset}
            canUndo={undoHistory.canUndo}
          />
        </section>
        <div className="editor">
          <SettingsList s={s} set={change} />
        </div>
        <aside className="sidebar">
          <ExportCard
            code={code}
            s={s}
            alias={alias}
            aliasError={aliasError}
            setAlias={setAlias}
            copy={copy}
            shareLink={shareLink}
            exportCfg={exportCfg}
          />
          <section className="presets-card">
            <div className="card-heading"><Crosshair size={17}/><h2>A starting point</h2></div>
            <div className="preset-grid">
              {presets.map(preset=>(
                <button
                  className="preset"
                  key={preset.name}
                  onClick={()=>{load(preset.settings);notify(`${preset.name} preset loaded.`);}}
                >
                  <div className="preset-preview"><Preview settings={preset.settings} zoom={1} decorative/></div>
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </section>
          <p className="privacy-note"><span className="live-dot"/>Drafts and preferences stay on this device. Sign in with Steam in Library to sync saved crosshairs.</p>
        </aside>
      </main>
    </>}
    {view==='library'&&(
      <LibraryView
        library={library}
        setLibrary={setLibrary}
        onLoad={editSaved}
        onCopy={(text,label)=>void copy(text,label)}
        onBackup={()=>download(JSON.stringify({version:1,entries:library},null,2),'delli-crosshair-library.json','application/json')}
        onRestore={()=>backupInput.current?.click()}
        notify={notify}
        user={sync.user}
        status={sync.status}
        syncing={sync.syncing}
        error={sync.error??''}
        available={sync.available}
        hasGuestFavorites={sync.hasGuestFavorites}
        onMerge={sync.mergeGuest}
        onRetry={()=>{void sync.retry().then(ok=>{if(ok)notify('Library is up to date.');});}}
        onSignOut={()=>void sync.signOut()}
        signIn={sync.signIn}
      />
    )}
    <footer className="site-footer"><span>delli.cc</span><span>Independent tool. Not affiliated with Valve.</span></footer>
    {view==='editor'&&(
      <div className="mobile-actions">
        <button onClick={()=>void copy(code,'Share code')}><Copy size={15}/>Copy code</button>
        <button onClick={exportCfg}><Download size={15}/>.cfg</button>
        <button onClick={()=>document.getElementById('import-text')?.focus()}><Upload size={15}/>Import</button>
      </div>
    )}
    {toast&&(
      <div className="toast" role="status">
        <Check size={16}/>
        <span>{toast}</span>
        <button className="icon-button" aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={14}/></button>
      </div>
    )}
    <Dialogs
      dialogRef={dialogRef}
      modal={modal}
      setModal={setModal}
      dynamic={dynamic}
      setDynamic={setDynamic}
      targetHeight={targetHeight}
      setTargetHeight={setTargetHeight}
      display={display}
      displayHeight={displayHeight}
      setDisplayHeight={setDisplayHeight}
      displayHeightDraft={displayHeightDraft}
      setDisplayHeightDraft={setDisplayHeightDraft}
      fit={fit}
      setFit={setFit}
      phase={phase}
      setPhase={setPhase}
      inspectSplit={inspectSplit}
      setInspectSplit={setInspectSplit}
      previewStatus={previewStatus}
      effectiveHeight={effectiveHeight}
      s={s}
      rating={rating}
      setRating={setRating}
      note={note}
      setNote={setNote}
    />
    <input
      ref={backupInput}
      className="sr-only"
      type="file"
      accept=".json,application/json"
      aria-label="Library backup file"
      onChange={async e=>{
        const file=e.target.files?.[0];
        e.target.value='';
        if(!file)return;
        try{
          if(file.size>500000)throw Error('Backup is too large.');
          const data=JSON.parse(await file.text());
          if(data.version!==1)throw Error('Unsupported backup version.');
          const entries=validateLibrary(data.entries);
          if(entries.filter(i=>i.favorite).length>50||entries.filter(i=>!i.favorite).length>20)throw Error('Backup exceeds library limits.');
          const accepted=setLibrary(prev=>{
            const keys=new Set<string>();
            const ids=new Set<string>();
            const combined=[...prev,...entries].filter(item=>{
              const key=settingsKey(item.settings)+(item.favorite?'saved':'recent');
              if(keys.has(key))return false;
              keys.add(key);
              return true;
            }).map(item=>{
              if(ids.has(item.id)){item={...item,id:newId()};}
              ids.add(item.id);
              return item;
            });
            return limitLibrary(combined);
          });
          if(accepted)notify('Backup merged. Existing entries were retained within library limits.');
          else notify('Backup could not be saved. Free browser storage and try again.');
        }catch(error){notify(message(error));}
      }}
    />
    <input
      ref={cfgInput}
      className="sr-only"
      type="file"
      accept=".cfg,.txt,.vcfg"
      aria-label="Crosshair config file"
      onChange={async e=>{
        const file=e.target.files?.[0];
        e.target.value='';
        if(!file)return;
        if(file.size>200000){setImportError('Config is too large.');return;}
        setImportText(await file.text());
        setImportError('');
      }}
    />
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);
