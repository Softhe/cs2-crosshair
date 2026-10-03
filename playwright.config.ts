import {defineConfig} from '@playwright/test';

const port=Number(process.env.PLAYWRIGHT_PORT??4180);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PLAYWRIGHT_PORT must be an integer from 1024 to 65535.');
const url=`http://127.0.0.1:${port}`;
export default defineConfig({testDir:'./e2e',fullyParallel:true,workers:2,use:{baseURL:url,browserName:'chromium'},projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844}}}],webServer:{command:`npm run build && npm exec vite preview -- --host 127.0.0.1 --port ${port} --strictPort`,url,reuseExistingServer:!process.env.CI}});
