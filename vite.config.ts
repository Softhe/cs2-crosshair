import {defineConfig} from 'vite';
import {securityHeaders} from './server/security-headers';
export default defineConfig({
  server:{proxy:{'/api':'http://127.0.0.1:4181'}},
  // The browser tests run against `vite preview`, so it serves the production headers (CSP included).
  // The dev server does not: Vite's HMR client needs inline scripts and a WebSocket.
  preview:{proxy:{'/api':'http://127.0.0.1:4181'},headers:{...securityHeaders}},
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
