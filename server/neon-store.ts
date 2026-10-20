import type {Store,Session,Snapshot} from './store.js';
export type Query=(text:string,params?:unknown[])=>Promise<Record<string,unknown>[]>;
export const schema=[
  'CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, owner TEXT NOT NULL, csrf TEXT NOT NULL, expires BIGINT NOT NULL)',
  "CREATE TABLE IF NOT EXISTS libraries (owner TEXT PRIMARY KEY, revision BIGINT NOT NULL CHECK (revision >= 0), entries JSONB NOT NULL DEFAULT '[]'::jsonb)",
  'CREATE TABLE IF NOT EXISTS nonces (nonce TEXT PRIMARY KEY, expires BIGINT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS states (id TEXT PRIMARY KEY, expires BIGINT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS rate_limits (id TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires BIGINT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires)',
  'CREATE INDEX IF NOT EXISTS states_expiry ON states(expires)',
  'CREATE INDEX IF NOT EXISTS nonces_expiry ON nonces(expires)',
  'CREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(expires)',
] as const;
async function connection(databaseUrl:string):Promise<Query>{
  const {neon}=await import('@neondatabase/serverless');const sql=neon(databaseUrl);
  return async(text,params=[])=>await sql.query(text,params) as Record<string,unknown>[];
}
export async function migrateDatabase(databaseUrl:string,query?:Query){const run=query??await connection(databaseUrl);for(const statement of schema)await run(statement);}
export async function createNeonStore(databaseUrl:string,query?:Query):Promise<Store>{
  const run=query??await connection(databaseUrl);
  const snapshot=(row:Record<string,unknown>):Snapshot=>({revision:Number(row.revision),entries:row.entries as unknown[]});
  return {
    async cleanup(now){await run('WITH expired_sessions AS (DELETE FROM sessions WHERE expires <= $1), expired_states AS (DELETE FROM states WHERE expires <= $1), expired_limits AS (DELETE FROM rate_limits WHERE expires <= $1) DELETE FROM nonces WHERE expires <= $1',[now]);},
    async session(id,now){const [row]=await run('SELECT id, owner, csrf, expires FROM sessions WHERE id=$1 AND expires>$2',[id,now]);return row?{...row,expires:Number(row.expires)} as Session:undefined;},
    async addSession(s){await run('INSERT INTO sessions(id,owner,csrf,expires) VALUES ($1,$2,$3,$4)',[s.id,s.owner,s.csrf,s.expires]);},
    async deleteSession(id){await run('DELETE FROM sessions WHERE id=$1',[id]);},
    async addState(id,expires){await run('INSERT INTO states(id,expires) VALUES ($1,$2)',[id,expires]);},
    async consumeState(id,now){return (await run('DELETE FROM states WHERE id=$1 AND expires>$2 RETURNING id',[id,now])).length===1;},
    async hasNonce(nonce){return (await run('SELECT nonce FROM nonces WHERE nonce=$1',[nonce])).length!==0;},
    async addNonce(nonce,expires){return (await run('INSERT INTO nonces(nonce,expires) VALUES ($1,$2) ON CONFLICT(nonce) DO NOTHING RETURNING nonce',[nonce,expires])).length===1;},
    async hit(bucket,expires){const [row]=await run('INSERT INTO rate_limits(id,hits,expires) VALUES ($1,1,$2) ON CONFLICT(id) DO UPDATE SET hits=rate_limits.hits+1 RETURNING hits',[bucket,expires]);return Number(row?.hits);},
    async latest(owner){const [row]=await run('SELECT revision,entries FROM libraries WHERE owner=$1',[owner]);return row?snapshot(row):{revision:0,entries:[]};},
    async save(owner,revision,entries){
      // Conditional insertion and row-locked comparison keep concurrent first saves and updates atomic.
      const [row]=revision===0
        ?await run('INSERT INTO libraries(owner,revision,entries) VALUES ($1,1,$2::jsonb) ON CONFLICT(owner) DO NOTHING RETURNING revision,entries',[owner,JSON.stringify(entries)])
        :await run('UPDATE libraries SET revision=revision+1,entries=$3::jsonb WHERE owner=$1 AND revision=$2 RETURNING revision,entries',[owner,revision,JSON.stringify(entries)]);
      return row?snapshot(row):null;
    },
    close(){},
  };
}
