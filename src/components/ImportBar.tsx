import type {RefObject} from 'react';
import {ArrowUpRight,Copy,FileCode2,Upload} from 'lucide-react';
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
  doImport:(text?:string)=>void;
  load:(settings:Settings)=>void;
  remember:(settings?:Settings)=>void;
  notify:(text:string,tone?:'success'|'warning'|'error'|'info')=>void;
  setToast:(value:string)=>void;
};

export function ImportBar(p:ImportBarProps){
  function resetImport(){
    p.clipboardRequest.current++;
    p.setImportText(null);
    p.setImportError('');
  }
  return <section className="inline-import transfer-panel" aria-label="Import, share and export">
    <div className="transfer-heading"><FileCode2 size={18}/><h2>Import, share and export</h2></div>
    <div className="import-label-row">
      <label className="field-label" htmlFor="import-text">Crosshair code or config</label>
      <span className={`code-state state-chip ${p.importDraft===null?'applied':'pending'}`}>
        {p.importDraft===null?'Applied crosshair':'Unapplied import'}
      </span>
    </div>
    <div className="inline-import-entry">
      <textarea rows={1} id="import-text" className="import-area" data-current-code={p.code} value={p.importText}
        onChange={e=>{p.clipboardRequest.current++;p.setImportText(e.target.value);p.setImportError('');}}
        onPaste={e=>{e.preventDefault();p.pasteCode(e.clipboardData.getData('text'));}}
        placeholder="Paste a CS2 crosshair code"/>
      <button className="primary-button" aria-label="Import crosshair" onClick={()=>p.doImport()}>
        Import<span className="import-button-extra"> crosshair</span><ArrowUpRight size={15}/>
      </button>
      <button className="icon-button" aria-label="Copy crosshair code" title="Copy applied crosshair code" onClick={()=>void p.copy(p.code,'Share code')}>
        <Copy size={16}/><span>Copy applied code</span>
      </button>
    </div>
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
        <button onClick={resetImport} disabled={p.importDraft===null}>Use current code</button>
      </div>
      <details className="config-import">
        <summary>Import a .cfg file</summary>
        <button onClick={()=>p.cfgInput.current?.click()}><Upload size={14}/>Choose .cfg file</button>
      </details>
      <LegacyConverter text={p.importText} oldHeight={p.legacyHeight} onOldHeightChange={p.setLegacyHeight} base={p.s}
        onApply={settings=>{
          p.load(settings);p.remember(settings);resetImport();p.setModal(null);
          p.notify('Converted crosshair loaded. Check the result in CS2.','warning');
        }}/>
    </details>
    {p.importError&&<p className="error-text" role="alert">{p.importError}</p>}
  </section>;
}
