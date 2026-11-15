import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHandler} from '../server/app.ts';
import {createSqliteStore} from '../server/sqlite-store.ts';
import {securityHeaders} from '../server/security-headers.ts';

test('pages and API responses carry the security headers',async()=>{
  const dist=mkdtempSync(join(tmpdir(),'delli-headers-'));
  writeFileSync(join(dist,'index.html'),'<!doctype html>');
  const store=createSqliteStore(':memory:');
  const handler=createHandler({store,distPath:dist});
  const server=createServer(handler);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  try{
    for(const path of ['/','/api/session','/api/library']){
      const response=await fetch(base+path);await response.arrayBuffer();
      for(const [key,value] of Object.entries(securityHeaders))assert.equal(response.headers.get(key),value,`${path} ${key}`);
    }
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await handler.close();}
});
