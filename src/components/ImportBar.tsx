import {useEffect,useRef,useState,type DragEvent,type RefObject} from 'react';
import {ArrowUpRight,Copy,FileCode2,Upload,X} from 'lucide-react';
import {LegacyConverter} from '../LegacyConverter';
import type {Settings} from '../model';
import {ExportCard,type ExportCardProps} from './ExportCard';

export type ImportBarProps = ExportCardProps & {
  code:string;
  importText:string;
  importDraft:string|null;
  importError:string;
  legacyHeight:number;
  clipboardRequest:RefObject<number>;
  cfgInput:RefObject<HTMLInputElement|null>;
  setImportText:(value:string|null)=>void;
  setImportError:(value:string)=>void;
  setLegacyHeight:(value:number)=>void;
  setModal:(value:null)=>void;
  pasteCode:(text:string)=>void;
  importFile:(file:File)=>void;
  conversionNotes:string[]|null;
  setConversionNotes:(value:null)=>void;
  doImport:(text?:string)=>void;
  load:(settings:Settings)=>void;
  remember:(settings?:Settings)=>void;
  notify:(text:string,tone?:'success'|'warning'|'error'|'info')=>void;
  setToast:(value:string)=>void;
};

export function ImportBar(p:ImportBarProps){
  const [dragging,setDragging]=useState(false);
  /** Set while text dragged from inside the panel (moving lines in the draft) is in flight; that keeps native editing. */
  const internalDrag=useRef(false);
  const field=useRef<HTMLTextAreaElement>(null);
  function resetImport(){
    p.clipboardRequest.current++;
    p.setImportText(null);
    p.setImportError('');
  }
  /** Files and dragged text (a link or code from another page) can be dropped anywhere on the panel. */
  const accepts=(e:DragEvent)=>!internalDrag.current&&[...e.dataTransfer.types].some(type=>type==='Files'||type==='text/plain'||type==='text/uri-list');
  function onDrop(e:DragEvent){
    if(!accepts(e))return;
    e.preventDefault();setDragging(false);
    const file=e.dataTransfer.files[0];
    if(file){p.importFile(file);return;}
    const text=e.dataTransfer.getData('text/plain')||e.dataTransfer.getData('text/uri-list');
    if(text)p.pasteCode(text);
  }
  const multiline=p.importDraft!==null&&p.importText.includes('\n');
  // A height the user dragged the resize handle to must not keep the one-line field tall afterwards.
  useEffect(()=>{if(!multiline&&field.current)field.current.style.height='';},[multiline]);
  return <section className={`inline-import transfer-panel${dragging?' is-dragging':''}`} aria-label="Import, share and export"
    onDragOver={e=>{if(!accepts(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy';setDragging(true);}}
    onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setDragging(false);}}
    onDrop={onDrop}
    onDragStart={()=>{internalDrag.current=true;}} onDragEnd={()=>{internalDrag.current=false;}}>
    {dragging&&<div className="drop-hint" aria-hidden="true"><Upload size={18}/>Drop a code, link, config or library backup to import</div>}
    <div className="transfer-heading"><FileCode2 size={18}/><h2>Import, share and export</h2></div>
    <div className="import-label-row">
      <label className="field-label" htmlFor="import-text">Crosshair code or config</label>
      <span className={`code-state state-chip ${p.importDraft===null?'applied':'pending'}`}>
        {p.importDraft===null?'Applied crosshair':'Unapplied import'}
      </span>
    </div>
    <div className="inline-import-entry">
      <textarea ref={field} rows={1} id="import-text" className={`import-area${multiline?' is-multiline':''}`} data-current-code={p.code} value={p.importText}
        aria-describedby="code-selection-hint"
        onPointerDown={e=>{if(p.importDraft===null){e.preventDefault();e.currentTarget.focus();e.currentTarget.select();}}}
        onFocus={e=>{if(p.importDraft===null)e.currentTarget.select();}}
        onClick={e=>{if(p.importDraft===null)e.currentTarget.select();}}
        onSelect={e=>{if(p.importDraft===null)e.currentTarget.select();}}
        onChange={e=>{p.clipboardRequest.current++;p.setImportText(e.target.value);p.setImportError('');}}
        onPaste={e=>{e.preventDefault();p.pasteCode(e.clipboardData.getData('text'));}}
        placeholder="Paste a code, link or config, or drop a file"/>
      {/* Copying the applied code is the main job; Import takes the lead only while an import is pending. */}
      <button className={`primary-button${p.importDraft===null?'':' is-primary'}`} aria-label="Import crosshair" onClick={()=>p.doImport()}>
        <span>Import<span className="import-button-extra"> crosshair</span></span><ArrowUpRight size={15}/>
      </button>
      <button className={`icon-button${p.importDraft===null?' is-primary':''}`} aria-label="Copy crosshair code" title="Copy applied crosshair code" onClick={()=>void p.copy(p.code,'Share code')}>
        <Copy size={16}/><span>Copy applied code</span>
      </button>
    </div>
    <p id="code-selection-hint" className={p.importDraft===null?'sr-only':'code-hint'}>{p.importDraft===null?'Click or tap to select the whole code. Paste to replace it.':'Edit your config draft, or paste to replace it.'}</p>
    {p.importDraft!==null&&<p className="transfer-pending-note">
      Copy, share and downloads use the applied crosshair until you import.
      <button onClick={resetImport}>Discard import</button>
    </p>}
    <ExportCard s={p.s} alias={p.alias} aliasError={p.aliasError} setAlias={p.setAlias} copy={p.copy} shareLink={p.shareLink} exportCfg={p.exportCfg}/>
    <details className="import-options">
      <summary>Import options</summary>
      <div className="import-tools">
        <button onClick={async()=>{
          const request=++p.clipboardRequest.current;p.setToast('');
          try{
            const text=await navigator.clipboard.readText();
            if(request===p.clipboardRequest.current)p.pasteCode(text);
          }catch{
            if(request===p.clipboardRequest.current)p.setImportError('Clipboard access is unavailable. Paste into the box manually.');
          }
        }}><Copy size={14}/>Paste clipboard</button>
        <button onClick={()=>p.cfgInput.current?.click()} title="A .cfg, .vcfg or .txt config, or a library backup .json"><Upload size={14}/>Choose file</button>
        <button onClick={resetImport} disabled={p.importDraft===null}>Use current code</button>
      </div>
      <p className="code-hint">Accepts CS and CSGO codes, share links, .cfg, .vcfg and .txt configs, console output and library backups. You can also drop a file on this panel.</p>
      <LegacyConverter text={p.importText} oldHeight={p.legacyHeight} onOldHeightChange={p.setLegacyHeight} base={p.s}
        onApply={settings=>{
          p.load(settings);p.remember(settings);resetImport();p.setModal(null);
          p.notify('Converted crosshair loaded. Check the result in CS2.','warning');
        }}/>
    </details>
    {p.importError&&<p className="error-text" role="alert">{p.importError}</p>}
    {p.conversionNotes&&<details className="conversion-notes" open>
      <summary>Conversion notes ({p.conversionNotes.length})</summary>
      <ul>{p.conversionNotes.map((note,i)=><li key={i}>{note}</li>)}</ul>
      <button className="quiet-button" onClick={()=>p.setConversionNotes(null)}><X size={14}/>Dismiss notes</button>
    </details>}
  </section>;
}
