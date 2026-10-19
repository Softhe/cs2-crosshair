import {chromium,expect,type Page} from '@playwright/test';
import {createNeonStore} from '../server/neon-store.ts';
import {neon} from '@neondatabase/serverless';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync,mkdirSync} from 'node:fs';

const requestedOrigin=process.env.PREVIEW_ORIGIN;
if(!requestedOrigin)throw Error('PREVIEW_ORIGIN must explicitly name the review deployment.');
const deployment=new URL(requestedOrigin);
if(deployment.protocol!=='https:'||!/^delli-crosshair-[a-z0-9]+-softhe\.vercel\.app$/.test(deployment.hostname)||deployment.port||deployment.pathname!=='/'||deployment.search||deployment.hash||deployment.username||deployment.password)throw Error('Use a deployment-specific delli-crosshair preview origin, never production.');
const origin=deployment.origin;
const secret=JSON.parse(readFileSync('.tools/preview-bypass.json','utf8')).secret;
const url=process.env.DATABASE_URL;if(!url)throw Error('The preview DATABASE_URL is required.');
const sql=neon(url),store=await createNeonStore(url),browser=await chromium.launch();
// Synthetic non-production identities exercise the deployed API without pretending to verify Steam accounts.
const owners=['99999999999999991','99999999999999992'];
const sessions:string[]=[],fixtureOwners:string[]=[],states:string[]=[];
mkdirSync('docs/evidence',{recursive:true});
async function openSave(page:Page){
  const disclosure=page.locator('.save-disclosure');
  if(await disclosure.getAttribute('open')===null)await disclosure.locator(':scope > summary').click();
}
try{
  // Refuse to overwrite prior fixtures; cleanup owns only identities proven empty before this run.
  for(const owner of owners){
    const rows=await sql.query('SELECT owner FROM libraries WHERE owner=$1 UNION ALL SELECT owner FROM sessions WHERE owner=$1',[owner]);
    if(rows.length)throw Error('A synthetic fixture identity is already in use. No existing fixture will be deleted.');
  }
  fixtureOwners.push(...owners);
  async function context(owner?:string,width=1440,height=1000){
    const c=await browser.newContext({viewport:{width,height}});
    await c.route('**/*',route=>{
      const request=route.request();
      return new URL(request.url()).origin===origin?route.continue({headers:{...request.headers(),'x-vercel-protection-bypass':secret}}):route.continue();
    });
    if(owner){
      const id=randomBytes(32).toString('hex'),hash=createHash('sha256').update(id).digest('hex');sessions.push(hash);
      await store.addSession({id:hash,owner,csrf:randomBytes(32).toString('hex'),expires:Date.now()+600000});
      await c.addCookies([{name:'delli_session',value:id,url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);
    }
    return c;
  }
  const guest=await context(),g=await guest.newPage();
  await g.goto(origin,{waitUntil:'networkidle'});await g.waitForFunction(()=>!document.getElementById('root')!.inert);
  await expect(g.getByRole('link',{name:'Sign in with Steam',exact:true})).toBeVisible();
  await g.getByRole('button',{name:'Library',exact:true}).click();
  await expect(g.getByRole('link',{name:'Sign in with Steam',exact:true})).toBeVisible();
  const session=await g.request.get(origin+'/api/session',{headers:{'x-vercel-protection-bypass':secret}});
  expect(session.status()).toBe(200);expect(await session.json()).toEqual({user:null});
  const redirect=await g.request.get(origin+'/api/auth/steam?returnTo=%2F%3Fview%3Dlibrary',{headers:{'x-vercel-protection-bypass':secret},maxRedirects:0});
  expect(redirect.status()).toBe(302);
  const provider=new URL(redirect.headers().location!),callback=new URL(provider.searchParams.get('openid.return_to')!);
  expect(provider.origin).toBe('https://steamcommunity.com');expect(callback.origin).toBe(origin);
  expect(callback.searchParams.get('returnTo')).toBe('/?view=library');
  const authState=callback.searchParams.get('state');if(!authState)throw Error('Preview did not return auth state.');
  states.push(createHash('sha256').update(authState+'\n/?view=library').digest('hex'));
  console.log('Hosted guest header and Library sign-in, session, and real Steam redirect PASS.');
  const ca=await context(owners[0]),cb=await context(owners[0]),cc=await context(owners[1]);
  const a=await ca.newPage(),b=await cb.newPage(),c=await cc.newPage();
  for(const page of [a,b,c]){
    await page.goto(origin,{waitUntil:'networkidle'});await page.waitForFunction(()=>!document.getElementById('root')!.inert);
    await expect(page.getByRole('button',{name:'Steam account',exact:true})).toBeVisible();
  }
  await openSave(a);await a.getByLabel('Crosshair name',{exact:true}).fill('Hosted sync fixture');
  await a.getByRole('button',{name:'Save to favorites',exact:true}).click();
  await a.getByRole('button',{name:'Library',exact:true}).click();await expect(a.getByLabel('Library sync status')).toHaveText('Synced');
  await b.getByRole('button',{name:'Library',exact:true}).click();await b.getByRole('button',{name:/Sync now|Retry sync/}).click();
  await expect(b.getByRole('button',{name:'Preview Hosted sync fixture'})).toBeVisible();
  await b.getByRole('button',{name:'Edit crosshair',exact:true}).click();
  await b.getByRole('spinbutton',{name:'Length',exact:true}).fill('12');await b.getByRole('spinbutton',{name:'Length',exact:true}).blur();
  await openSave(b);await b.getByRole('button',{name:'Update saved crosshair',exact:true}).click();
  await b.getByRole('button',{name:'Library',exact:true}).click();await expect(b.getByLabel('Library sync status')).toHaveText('Synced');
  await a.getByRole('button',{name:/Sync now|Retry sync/}).click();
  await expect(a.getByLabel('Selected crosshair code')).toHaveValue(await b.getByLabel('Selected crosshair code').inputValue());
  await c.getByRole('button',{name:'Library',exact:true}).click();await expect(c.getByRole('button',{name:'Preview Hosted sync fixture'})).toHaveCount(0);
  await a.screenshot({path:'docs/evidence/vercel-neon-library-desktop.png',fullPage:true});
  const mobile=await context(undefined,390,844),m=await mobile.newPage();
  await m.goto(origin+'/?view=library',{waitUntil:'networkidle'});await m.waitForFunction(()=>!document.getElementById('root')!.inert);
  await expect(m.getByRole('link',{name:'Sign in with Steam'})).toBeVisible();
  expect(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await m.screenshot({path:'docs/evidence/vercel-neon-library-mobile.png',fullPage:true});
  await b.getByRole('button',{name:'Steam account',exact:true}).click();await b.getByRole('button',{name:'Sign out of Steam',exact:true}).click();
  await expect(b.getByRole('link',{name:'Sign in with Steam'})).toBeVisible();await expect(b.getByRole('button',{name:'Preview Hosted sync fixture'})).toHaveCount(0);
  console.log('Hosted Vercel + real Neon PASS: separate-browser-context save/update, private account isolation, header sign-out, desktop/mobile UI. Authentication used synthetic test sessions; an actual Steam user login is not claimed.');
}finally{
  try{await browser.close();}finally{
    try{
      for(const id of sessions)await sql.query('DELETE FROM sessions WHERE id=$1',[id]);
      for(const id of states)await sql.query('DELETE FROM states WHERE id=$1',[id]);
      for(const owner of fixtureOwners)await sql.query('DELETE FROM libraries WHERE owner=$1',[owner]);
    }finally{store.close();}
  }
}
