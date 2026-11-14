import {readFileSync} from 'node:fs';
import {defineConfig} from 'vite';

/**
 * The policy production sends (report-only, from vercel.json). `vite preview`, which the browser
 * tests run against, enforces it so a violation breaks a test before it reaches the site.
 */
const vercel=JSON.parse(readFileSync(new URL('./vercel.json',import.meta.url),'utf8')) as {headers:{headers:{key:string;value:string}[]}[]};
const csp=vercel.headers.flatMap(rule=>rule.headers).find(header=>header.key==='Content-Security-Policy-Report-Only')?.value;
if(!csp) throw Error('vercel.json is missing the Content-Security-Policy-Report-Only header.');

export default defineConfig({
  server:{proxy:{'/api':'http://127.0.0.1:4181'}},
  preview:{proxy:{'/api':'http://127.0.0.1:4181'},headers:{'Content-Security-Policy':csp}},
  build:{
    target:'es2020',
    cssMinify:true,
    rollupOptions:{
      output:{
        manualChunks(id){
          if(id.includes('node_modules')){
            if(id.includes('lucide-react'))return 'vendor-icons';
            if(id.includes('/react')||id.includes('/react-dom')||id.includes('scheduler'))return 'vendor-react';
            return 'vendor';
          }
        },
      },
    },
  },
});
