import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
import type {Store} from './store.js';
import {validateSettings} from '../src/model.js';

const provider='https://steamcommunity.com/openid/login';
const namespace='http://specs.openid.net/auth/2.0';
const token=()=>randomBytes(32).toString('hex');
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const equal=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const signInReturn=(value:string|null)=>value==='/?view=library'?'/?view=library':'/';
export type Options={origin?:string;databasePath?:string;databaseUrl?:string;store?:Store;distPath?:string;fetch?:typeof fetch;now?:()=>number};
export function createHandler(options:Options={}){
  const origin=options.origin??process.env.PUBLIC_ORIGIN??'http://127.0.0.1:4181';
  const parsedOrigin=new URL(origin);
  if(parsedOrigin.origin!==origin||!['http:','https:'].includes(parsedOrigin.protocol))throw Error('PUBLIC_ORIGIN must be an HTTP origin without a trailing slash.');
  const production=process.env.NODE_ENV==='production'||!!process.env.VERCEL;
  const databaseUrl=options.databaseUrl??process.env.DATABASE_URL;
  if(production&&!databaseUrl)throw Error('Production requires DATABASE_URL.');
  if(production&&((!options.origin&&!process.env.PUBLIC_ORIGIN)||parsedOrigin.protocol!=='https:'))throw Error('Production requires an explicit HTTPS public origin.');
  let pendingStore:Promise<Store>|undefined;
  const storage=()=>pendingStore??=databaseUrl
    ?import('./neon-store.js').then(module=>module.createNeonStore(databaseUrl))
    :options.store?Promise.resolve(options.store):import('./sqlite-store.js').then(module=>module.createSqliteStore(options.databasePath??process.env.DATABASE_PATH??resolve('data/library.sqlite')));
  const now=options.now??Date.now,requestFetch=options.fetch??fetch,dist=resolve(options.distPath??'dist');
  let lastCleanup=0;
  // In-memory rate-limit buckets: single-instance only. On Vercel serverless
  // each instance gets its own buckets (cold starts reset them), so this is
  // abuse friction rather than strict enforcement.
  const hits=new Map<string,number[]>();
  function pruneBuckets(t:number){
    for(const [key,times] of hits){
      const fresh=times.filter(ts=>t-ts<3600000);
      if(fresh.length)hits.set(key,fresh);else hits.delete(key);
    }
  }
  function allowed(key:string,limit:number,windowMs:number,t:number):boolean{
    const times=hits.get(key)??[];
    const fresh=times.filter(ts=>t-ts<windowMs);
    if(fresh.length>=limit){hits.set(key,fresh);return false;}
    fresh.push(t);hits.set(key,fresh);return true;
  }
  function clientIp(req:IncomingMessage):string{
    const forwarded=req.headers['x-forwarded-for'];
    const first=(Array.isArray(forwarded)?forwarded[0]:forwarded)?.split(',')[0]?.trim();
    return first||req.socket.remoteAddress||'unknown';
  }
  const cookie=(name:string,value:string,maxAge:number)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${parsedOrigin.protocol==='https:'?'; Secure':''}`;
  function cookies(req:IncomingMessage){return Object.fromEntries((req.headers.cookie??'').split(';').map(p=>p.trim().split('=').slice(0,2)));}
  async function session(req:IncomingMessage){const id=cookies(req).delli_session;if(!id)return undefined;return (await storage()).session(hash(id),now());}
  function json(res:ServerResponse,status:number,value:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
  async function body(req:IncomingMessage){
    if(!req.headers['content-type']?.startsWith('application/json'))throw Error('Expected JSON.');
    const parsed=(req as IncomingMessage&{body?:unknown}).body;
    if(parsed!==undefined){const text=typeof parsed==='string'?parsed:JSON.stringify(parsed);if(!text||Buffer.byteLength(text)>200000)throw Error('Request is too large.');return JSON.parse(text);}
    // Collect raw bytes: concatenating chunks as strings splits multi-byte UTF-8 characters at chunk boundaries.
    const chunks:Buffer[]=[];let size=0;for await(const chunk of req){const data=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=data.length;if(size>200000)throw Error('Request is too large.');chunks.push(data);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  const handler=async(req:IncomingMessage,res:ServerResponse)=>{try{
    const url=new URL(req.url??'/',origin),path=url.pathname;
    if(path.startsWith('/api/')){
      res.setHeader('Cache-Control','no-store');
      const t=now();
      const db=await storage();
      if(t-lastCleanup>5*60*1000){lastCleanup=t;pruneBuckets(t);await db.cleanup(t);}
      if(path==='/api/session'&&req.method==='GET'){const s=await session(req);json(res,200,s?{user:{steamId:s.owner},csrfToken:s.csrf}:{user:null});return;}
      if(path==='/api/auth/steam'&&req.method==='GET'){
        if(!allowed('steam:'+clientIp(req),60,60000,t)){json(res,429,{error:'Too many sign-in attempts. Try again later.'});return;}
        const state=token(),destination=signInReturn(url.searchParams.get('returnTo'));
        // Bind the destination to the one-use state without storing an extra cookie or database field.
        await db.addState(hash(state+'\n'+destination),now()+600000);
        const callback=new URL('/api/auth/steam/callback',origin);callback.searchParams.set('state',state);callback.searchParams.set('returnTo',destination);
        const target=new URL(provider),returnTo=callback.href;
        for(const [key,value] of Object.entries({'openid.ns':namespace,'openid.mode':'checkid_setup','openid.return_to':returnTo,'openid.realm':origin,'openid.identity':'http://specs.openid.net/auth/2.0/identifier_select','openid.claimed_id':'http://specs.openid.net/auth/2.0/identifier_select'}))target.searchParams.set(key,value);
        res.writeHead(302,{Location:target.href,'Set-Cookie':cookie('delli_auth_state',state,600)});res.end();return;
      }
      if(path==='/api/auth/steam/callback'&&req.method==='GET'){
        const params=url.searchParams,state=params.get('state')??'',stateCookie=cookies(req).delli_auth_state??'',destination=signInReturn(params.get('returnTo'));
        if(params.getAll('returnTo').length!==1||params.get('returnTo')!==destination)throw Error('Invalid sign-in destination.');
        if(!/^[a-f0-9]{64}$/.test(state)||!equal(state,stateCookie))throw Error('Invalid sign-in state.');
        const stored=await db.consumeState(hash(state+'\n'+destination),now());if(!stored)throw Error('Expired or reused sign-in state.');
        const get=(key:string)=>{if(params.getAll('openid.'+key).length!==1)throw Error('Missing or duplicated OpenID parameter.');return params.get('openid.'+key)!;};
        if(get('ns')!==namespace||get('mode')!=='id_res'||get('op_endpoint')!==provider)throw Error('Invalid OpenID provider.');
        const identity=get('claimed_id');if(!/^https:\/\/steamcommunity\.com\/openid\/id\/[0-9]{17}$/.test(identity)||get('identity')!==identity)throw Error('Invalid Steam identity.');
        const callback=new URL('/api/auth/steam/callback',origin);callback.searchParams.set('state',state);callback.searchParams.set('returnTo',destination);
        if(get('return_to')!==callback.href)throw Error('Invalid return URL.');
        const signed=get('signed').split(',');for(const field of ['op_endpoint','claimed_id','identity','return_to','response_nonce','assoc_handle'])if(!signed.includes(field))throw Error('Unsigned OpenID field.');
        get('sig');get('assoc_handle');const nonce=get('response_nonce'),timestamp=Date.parse(nonce.slice(0,20));
        if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ.+$/.test(nonce)||!Number.isFinite(timestamp)||Math.abs(now()-timestamp)>300000||await db.hasNonce(nonce))throw Error('Expired or reused OpenID response.');
        const verification=new URLSearchParams();for(const [key,value] of params)if(key.startsWith('openid.'))verification.append(key,value);verification.set('openid.mode','check_authentication');
        const result=await requestFetch(provider,{method:'POST',body:verification,redirect:'error',signal:AbortSignal.timeout(10000)});
        const verified=await result.text();if(!result.ok||!/^is_valid:true\r?$/m.test(verified))throw Error('Steam could not verify sign-in.');
        if(!await db.addNonce(nonce,now()+600000))throw Error('Reused OpenID response.');
        const old=await session(req);if(old)await db.deleteSession(old.id);
        const id=token(),csrf=token();await db.addSession({id:hash(id),owner:identity.split('/').at(-1)!,csrf,expires:now()+30*86400000});
        res.writeHead(302,{Location:destination, 'Set-Cookie':[cookie('delli_session',id,30*86400),cookie('delli_auth_state','',0)]});res.end();return;
      }
      const s=await session(req);if(!s){json(res,401,{error:'Sign in with Steam first.'});return;}
      if(path==='/api/library'&&req.method==='GET'){json(res,200,await db.latest(s.owner));return;}
      // Safe-method GETs skip the Origin/CSRF-token check below: they are
      // read-only with no state change, and the session cookie is SameSite=Lax.
      if(req.method!=='GET'&&(req.headers.origin!==origin||typeof req.headers['x-csrf-token']!=='string'||!equal(s.csrf,req.headers['x-csrf-token']))){json(res,403,{error:'Invalid request origin or CSRF token.'});return;}
      if(path==='/api/auth/logout'&&req.method==='POST'){await db.deleteSession(s.id);res.setHeader('Set-Cookie',cookie('delli_session','',0));json(res,200,{user:null});return;}
      if(path==='/api/library'&&req.method==='PUT'){
        if(!allowed('put-ip:'+clientIp(req),60,60000,t)||!allowed('put-owner:'+s.owner,30,3600000,t)){json(res,429,{error:'Too many sync attempts. Try again later.'});return;}
        const input=await body(req);if(!Number.isSafeInteger(input.revision)||input.revision<0||!Array.isArray(input.entries)||input.entries.length>50)throw Error('Invalid library revision or favorite count.');
        const ids=new Set<string>();const entries=input.entries.map((item:Record<string,unknown>)=>{
          if(!item||typeof item.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(item.id)||ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||(item.favorite!==undefined&&item.favorite!==true))throw Error('Invalid favorite.');
          ids.add(item.id);return {id:item.id,name:item.name.trim(),settings:validateSettings(item.settings)};
        });
        const updated=await db.save(s.owner,input.revision,entries);if(!updated){json(res,409,await db.latest(s.owner));return;}json(res,200,updated);return;
      }
      json(res,404,{error:'API route not found.'});return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    const decoded=decodeURIComponent(path);if(decoded.includes('\\')||decoded.includes('\0')||decoded.split('/').includes('..')){res.writeHead(400);res.end();return;}
    let file=resolve(dist,'.'+decoded);if(file!==dist&&!file.startsWith(dist+sep)){res.writeHead(400);res.end();return;}
    try{if(!statSync(file).isFile())file=resolve(dist,'index.html');}catch{if(extname(file)){res.writeHead(404);res.end();return;}file=resolve(dist,'index.html');}
    const content=readFileSync(file);const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon'};
    res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Cache-Control':extname(file)==='.html'?'no-cache':'public, max-age=3600'});res.end(req.method==='HEAD'?undefined:content);
  }catch(error){if(req.method==='GET'&&req.url?.split('?')[0]==='/api/auth/steam/callback'&&req.headers.accept?.includes('text/html')){const destination=new URL(signInReturn(new URL(req.url,origin).searchParams.get('returnTo')),origin);destination.searchParams.set('steam','failed');res.writeHead(302,{Location:destination.pathname+destination.search,'Set-Cookie':cookie('delli_auth_state','',0),'Cache-Control':'no-store'});res.end();return;}json(res,400,{error:'The request could not be completed. Check your input or try again.'});}};
  handler.close=async()=>{if(pendingStore)(await pendingStore).close();};return handler;
}

export function createApp(options:Options={}){
  const handler=createHandler(options);const server=createServer(handler);
  server.on('close',()=>{void handler.close();});return server;
}
