import {defineConfig} from 'vite';
export default defineConfig({server:{proxy:{'/api':'http://127.0.0.1:4181'}},preview:{proxy:{'/api':'http://127.0.0.1:4181'}}});
