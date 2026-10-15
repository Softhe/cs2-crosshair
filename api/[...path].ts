import type {IncomingMessage,ServerResponse} from 'node:http';
import {createHandler} from '../server/app.js';

export function deploymentOrigin(env:NodeJS.ProcessEnv=process.env):string{
  const configured=env.PUBLIC_ORIGIN;
  const previewHost=env.VERCEL_URL;
  const value=configured??(previewHost?`https://${previewHost}`:undefined);
  if(!value)throw Error('PUBLIC_ORIGIN or VERCEL_URL is required.');
  const parsed=new URL(value);
  if(parsed.origin!==value||parsed.username||parsed.password||!['http:','https:'].includes(parsed.protocol))throw Error('Invalid deployment origin.');
  if(env.VERCEL&&parsed.protocol!=='https:')throw Error('Vercel deployments require an HTTPS origin.');
  if(!configured&&(!previewHost||!/^([a-zA-Z0-9-]+\.)+vercel\.app$/.test(previewHost)))throw Error('Invalid Vercel deployment hostname.');
  return value;
}

let initialized:Promise<ReturnType<typeof createHandler>>|undefined;
export default async function handler(req:IncomingMessage,res:ServerResponse){
  try{
    if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required for the deployed account service.');
    initialized??=Promise.resolve().then(()=>createHandler({origin:deploymentOrigin()})).catch(error=>{initialized=undefined;throw error;});
    await (await initialized)(req,res);
  }catch(error){
    const failure=error as {name?:unknown;code?:unknown};
    console.error('Account service initialization or request failed.',{name:typeof failure?.name==='string'?failure.name:'UnknownError',code:typeof failure?.code==='string'?failure.code:'UNKNOWN'});
    if(res.headersSent){res.end();return;}
    res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(JSON.stringify({error:'The account service is temporarily unavailable.'}));
  }
}
