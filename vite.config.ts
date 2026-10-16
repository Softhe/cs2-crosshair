import {defineConfig} from 'vite';
export default defineConfig({
  server:{proxy:{'/api':'http://127.0.0.1:4181'}},
  preview:{proxy:{'/api':'http://127.0.0.1:4181'}},
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
