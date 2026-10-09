import { convertLegacy } from './converter';
import { defaults, validateSettings, type Settings } from './model';

// CS2 1.41.8.8. Byte layout verified against codes exported by the game.
const alphabet='ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789';
function checksum(bytes: Uint8Array): number {return bytes.slice(1).reduce((sum,b)=>sum+b,0)&255;}
function pack(bytes: Uint8Array, count: number): string {
  let number=0n;
  for(const byte of bytes) number=(number<<8n)|BigInt(byte);
  let text='';
  for(let i=0;i<count;i++){text+=alphabet[Number(number%57n)];number/=57n;}
  if(number) throw Error('Share code exceeds supported size.');
  return text;
}
function unpack(text: string, length: number): Uint8Array {
  let number=0n;
  for(let i=text.length-1;i>=0;i--){const digit=alphabet.indexOf(text[i]);if(digit<0)throw Error('Invalid share-code character.');number=number*57n+BigInt(digit);}
  if(number>>(BigInt(length)*8n)) throw Error('Share code exceeds supported size.');
  const bytes=new Uint8Array(length);
  for(let i=length-1;i>=0;i--){bytes[i]=Number(number&255n);number>>=8n;}
  if(checksum(bytes)!==bytes[0]) throw Error('Invalid crosshair checksum. Check the entire code.');
  return bytes;
}
export function encode(s: Settings): string {
  s=validateSettings(s);
  const b=new Uint8Array(32);const view=new DataView(b.buffer);
  b[1]=1;view.setUint16(2,s.cl_crosshair_screen_height,true);
  b[4]=s.cl_crosshairstyle|(s.cl_crosshair_recoil<<5)|(s.cl_crosshairdot<<6)|(s.cl_crosshair_t<<7);
  ['r','g','b','a'].forEach((c,i)=>{b[5+i]=s[`cl_crosshaircolor_${c}`];b[9+i]=s[`cl_crosshairoutline_${c}`];});
  b[13]=s.cl_crosshair_thickness|(s.cl_crosshair_drawoutline<<6);
  view.setInt16(14,s.cl_crosshair_gap,true);b[16]=s.cl_crosshair_length;b[17]=s.cl_crosshair_dynamic_spread_limit;
  const packed=BigInt(s.cl_crosshair_dynamic_splitdist)
    |BigInt(Math.round(s.cl_crosshair_dynamic_splitalpha_innermod*100))<<7n
    |BigInt(Math.round(s.cl_crosshair_dynamic_splitalpha_outermod*100)-30)<<14n
    |BigInt(Math.round(s.cl_crosshair_dynamic_maxdist_splitratio*100))<<21n
    |BigInt(s.cl_ironsight_usecrosshaircolor)<<28n;
  for(let i=0;i<4;i++) b[18+i]=Number(packed>>BigInt(i*8)&255n);
  b[22]=Math.round(s.cl_ironsight_dot_scale*100)-10;
  b[0]=checksum(b);
  return 'CS'+pack(b,44);
}
export type Decoded = {settings: Settings; legacy: boolean; note?: string};
export function decode(input: string, legacyHeight=1080): Decoded {
  const code=input.trim();
  if(/^CS[A-Za-z0-9]{44}$/.test(code)) {
    const b=unpack(code.slice(2),32);const view=new DataView(b.buffer);
    if(b[1]!==1) throw Error('This CS code uses an unsupported format version.');
    if((b[21]&224)||b.slice(23).some(x=>x!==0)) throw Error('This code contains unknown settings. It cannot be safely edited yet.');
    const s={...defaults};s.cl_crosshair_screen_height=view.getUint16(2,true);
    s.cl_crosshairstyle=b[4]&31;s.cl_crosshair_recoil=(b[4]>>5)&1;s.cl_crosshairdot=(b[4]>>6)&1;s.cl_crosshair_t=b[4]>>7;
    ['r','g','b','a'].forEach((c,i)=>{s[`cl_crosshaircolor_${c}`]=b[5+i];s[`cl_crosshairoutline_${c}`]=b[9+i];});
    s.cl_crosshair_thickness=b[13]&63;s.cl_crosshair_drawoutline=b[13]>>6;s.cl_crosshair_gap=view.getInt16(14,true);s.cl_crosshair_length=b[16];s.cl_crosshair_dynamic_spread_limit=b[17];
    const bits=BigInt(view.getUint32(18,true));
    s.cl_crosshair_dynamic_splitdist=Number(bits&127n);s.cl_crosshair_dynamic_splitalpha_innermod=Number(bits>>7n&127n)/100;
    s.cl_crosshair_dynamic_splitalpha_outermod=(Number(bits>>14n&127n)+30)/100;s.cl_crosshair_dynamic_maxdist_splitratio=Number(bits>>21n&127n)/100;
    s.cl_ironsight_usecrosshaircolor=Number(bits>>28n&1n);s.cl_ironsight_dot_scale=(b[22]+10)/100;
    return {settings:validateSettings(s),legacy:false};
  }
  if(/^CSGO(-[A-Za-z0-9]{5}){5}$/.test(code)) {
    const b=unpack(code.slice(5).replaceAll('-',''),18);const view=new DataView(b.buffer);const s={...defaults};
    if(![1,3,4].includes(b[1])) throw Error('This is not a supported crosshair code. Match codes cannot be imported.');
    if(b[1]===1){
      const converted=convertLegacy(code,legacyHeight);
      return {settings:converted.settings,legacy:true,note:'Converted with the community-static-v6 reconstruction. Pixel matching is approximate; check it in CS2. Use the converter panel to review warnings.'};
    }
    const bits=view.getUint32(10,true);
    s.cl_crosshairstyle=b[2]&15;s.cl_crosshair_recoil=(b[2]>>4)&1;s.cl_crosshairdot=(b[2]>>6)&1;s.cl_crosshair_t=b[2]>>7;
    ['r','g','b','a'].forEach((c,i)=>s[`cl_crosshaircolor_${c}`]=b[3+i]);
    s.cl_crosshair_gap=b[7];s.cl_crosshair_length=b[8];s.cl_crosshair_dynamic_spread_limit=b[9];
    s.cl_crosshair_dynamic_splitdist=bits&127;s.cl_crosshair_dynamic_splitalpha_innermod=((bits>>>7)&31)/20;
    s.cl_crosshair_dynamic_splitalpha_outermod=(((bits>>>12)&15)+6)/20;s.cl_crosshair_dynamic_maxdist_splitratio=((bits>>>16)&127)/100;
    s.cl_crosshair_thickness=(bits>>>23)&31;s.cl_crosshair_drawoutline=b[1]===4?(b[13]>>4)&3:(b[2]>>5)&1;s.cl_crosshair_screen_height=view.getUint16(14,true);
    return {settings:validateSettings(s),legacy:true,note:'Imported a September CSGO code. Outline color and scope dot settings were absent and use defaults.'};
  }
  throw Error('Paste a complete CS crosshair code or a supported CSGO crosshair code.');
}
export function importCommands(text: string, base=defaults): Settings {
  if(text.length>200000) throw Error('Config is too large.');
  const s={...base};let count=0;
  for(const command of text.replace(/\/\/[^\n]*/g,'').split(/[;\r\n]/)) {
    const match=/^\s*"?(cl_[a-z0-9_]+)"?\s+"?(-?\d+(?:\.\d+)?|true|false)"?\s*$/i.exec(command);
    if(match && match[1] in defaults){s[match[1]]=match[2]==='true'?1:match[2]==='false'?0:Number(match[2]);count++;}
  }
  if(!count) throw Error('No current CS2 crosshair settings found. Unrelated commands are ignored.');
  return validateSettings(s);
}
