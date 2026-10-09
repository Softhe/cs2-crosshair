import { useState } from 'react';
import { convertLegacy, type Conversion } from './converter';
import { encode } from './codec';
import { type Settings } from './model';
import { Preview } from './Preview';
import { copyText } from './clipboard';

export function LegacyConverter({text,oldHeight,onOldHeightChange,base,onApply}:{text:string;oldHeight:number;onOldHeightChange:(height:number)=>void;base:Settings;onApply:(settings:Settings)=>void}) {
  const [newHeight,setNewHeight]=useState(1080);
  const [result,setResult]=useState<Conversion|null>(null);
  const [input,setInput]=useState('');
  const [status,setStatus]=useState('');
  const fingerprint=JSON.stringify([text,oldHeight,newHeight,base]);
  const current=result && input===fingerprint?result:null;
  function convert(){try{setResult(convertLegacy(text,oldHeight,newHeight,base));setInput(fingerprint);setStatus('');}catch(error){setResult(null);setStatus(error instanceof Error?error.message:'Conversion failed.');}}
  return <details className="legacy-converter"><summary>Convert old settings to a new CS code</summary>
    <p>Paste an old CSGO code or pre-update console settings in the box above. Conversion preserves the estimated pixel size at rest. Old styles 2, 3 and 5 become Static Cross; styles 0 and 1 cannot be converted.</p>
    <label className="legacy-resolution">Old code reference height<select aria-label="Old code reference height" value={oldHeight} onChange={e=>onOldHeightChange(Number(e.target.value))}>{[720,768,960,1080,1440,2160].map(n=><option key={n} value={n}>{n}px</option>)}</select></label>
    <label className="legacy-resolution">New game height<select aria-label="New game height" value={newHeight} onChange={e=>setNewHeight(Number(e.target.value))}>{[720,768,960,1080,1440,2160].map(n=><option key={n} value={n}>{n}px</option>)}</select></label>
    <p className="section-note">Uses the community-static-v6 reconstruction. Its renderer equations are unverified in the game. Preview matches are estimates. Check the result in CS2.</p>
    <button onClick={convert}>Convert old settings</button>
    {current&&<div className="conversion-result"><div className="conversion-preview"><Preview settings={current.settings} zoom={4} decorative fit/></div>
      <p>Converted preview, up to 4× magnification</p>
      <dl>{[['Length','cl_crosshair_length'],['Thickness','cl_crosshair_thickness'],['Gap','cl_crosshair_gap'],['Reference height','cl_crosshair_screen_height']].map(([label,key])=><div key={key}><dt>{label}</dt><dd>{current.settings[key]}</dd></div>)}</dl>
      <label className="field-label" htmlFor="converted-code">NEW CS CODE</label><input id="converted-code" className="converted-code" readOnly value={encode(current.settings)}/>
      <div className="modal-buttons"><button onClick={async()=>{const copied=await copyText(encode(current.settings));setStatus(copied?'Converted code copied.':'Copy failed. Select and copy the code manually.');}}>Copy converted code</button><button className="primary-button" onClick={()=>onApply(current.settings)}>Use converted crosshair</button></div>
      <details><summary>Conversion warnings ({current.warnings.length})</summary><ul>{current.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul></details>
      <a href="https://github.com/sebastianspicker/small-indie-crosshair-company" target="_blank" rel="noreferrer">Converter source and research</a>
    </div>}
    {status&&<p role="status">{status}</p>}
  </details>;
}
