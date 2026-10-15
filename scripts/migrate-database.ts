import {migrateDatabase} from '../server/neon-store.ts';
const url=process.env.DATABASE_URL_UNPOOLED??process.env.DATABASE_URL;
if(!url){console.error('DATABASE_URL is required. Pull the linked development environment first.');process.exit(1);}
try{await migrateDatabase(url);console.log('Neon schema migration completed.');}catch{console.error('Neon schema migration failed. Verify database connectivity and permissions.');process.exit(1);}
