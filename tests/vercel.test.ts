import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deploymentOrigin} from '../api/[...path].ts';

test('deployment origin uses explicit configuration or the trusted Vercel deployment hostname',()=>{
  assert.equal(deploymentOrigin({PUBLIC_ORIGIN:'https://preview.example.com',VERCEL:'1',VERCEL_URL:'ignored.vercel.app'}),'https://preview.example.com');
  assert.equal(deploymentOrigin({VERCEL:'1',VERCEL_URL:'delli-preview-team.vercel.app'}),'https://delli-preview-team.vercel.app');
  assert.equal(deploymentOrigin({PUBLIC_ORIGIN:'http://127.0.0.1:4180'}),'http://127.0.0.1:4180');
  for(const env of [{},{PUBLIC_ORIGIN:'https://example.com/'},{PUBLIC_ORIGIN:'https://user:password@example.com'},{VERCEL:'1',PUBLIC_ORIGIN:'http://example.com'},{VERCEL_URL:'evil.example'},{VERCEL_URL:'x.vercel.app/path'},{VERCEL_URL:'x.vercel.app:443'}])assert.throws(()=>deploymentOrigin(env));
});

test('Vercel SPA fallback preserves code links and never captures account API routes',()=>{
  const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.equal(config.framework,'vite');assert.equal(config.outputDirectory,'dist');
  const fallback=new RegExp('^'+config.rewrites[0].source+'$');
  for(const path of ['/','/custom','/CSxkMfFVRUG6fRehdb2CvLNuajHopsuAQ5O38aVLPTTPHj','/missing'])assert.equal(fallback.test(path),true,path);
  for(const path of ['/api','/api/','/api/session','/api/auth/steam/callback','/api/unknown'])assert.equal(fallback.test(path),false,path);
  assert.equal(config.rewrites[0].destination,'/index.html');
});
