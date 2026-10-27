import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import type {Store,Session,Snapshot} from './store.js';
export function createSqliteStore(path:string):Store{
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  const db=new DatabaseSync(path);db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, owner TEXT NOT NULL, csrf TEXT NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS libraries (owner TEXT PRIMARY KEY, revision INTEGER NOT NULL, entries TEXT NOT NULL); CREATE TABLE IF NOT EXISTS nonces (nonce TEXT PRIMARY KEY, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS states (id TEXT PRIMARY KEY, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS rate_limits (id TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS preferences (owner TEXT PRIMARY KEY, value TEXT NOT NULL, updated INTEGER NOT NULL);');
  function latest(owner:string):Snapshot{const row=db.prepare('SELECT revision,entries FROM libraries WHERE owner=?').get(owner) as {revision:number;entries:string}|undefined;return row?{revision:row.revision,entries:JSON.parse(row.entries)}:{revision:0,entries:[]};}
  return {
    async cleanup(now){for(const table of ['sessions','states','nonces','rate_limits'])db.prepare(`DELETE FROM ${table} WHERE expires<=?`).run(now);},
    async session(id,now){return db.prepare('SELECT * FROM sessions WHERE id=? AND expires>?').get(id,now) as Session|undefined;},
    async addSession(s){db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(s.id,s.owner,s.csrf,s.expires);},
    async deleteSession(id){db.prepare('DELETE FROM sessions WHERE id=?').run(id);},
    async addState(id,expires){db.prepare('INSERT INTO states VALUES (?,?)').run(id,expires);},
    async consumeState(id,now){return !!db.prepare('DELETE FROM states WHERE id=? AND expires>? RETURNING id').get(id,now);},
    async hasNonce(nonce){return !!db.prepare('SELECT nonce FROM nonces WHERE nonce=?').get(nonce);},
    async addNonce(nonce,expires){return !!db.prepare('INSERT INTO nonces VALUES (?,?) ON CONFLICT(nonce) DO NOTHING RETURNING nonce').get(nonce,expires);},
    async hit(bucket,expires){return (db.prepare('INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET hits=hits+1 RETURNING hits').get(bucket,expires) as {hits:number}).hits;},
    async latest(owner){return latest(owner);},
    async save(owner,revision,entries){db.exec('BEGIN IMMEDIATE');try{if(latest(owner).revision!==revision){db.exec('ROLLBACK');return null;}const updated={revision:revision+1,entries};db.prepare('INSERT INTO libraries VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET revision=excluded.revision,entries=excluded.entries').run(owner,updated.revision,JSON.stringify(entries));db.exec('COMMIT');return updated;}catch(error){db.exec('ROLLBACK');throw error;}},
    async preferences(owner){const row=db.prepare('SELECT value FROM preferences WHERE owner=?').get(owner) as {value:string}|undefined;return row?JSON.parse(row.value):null;},
    async savePreferences(owner,value,updated){db.prepare('INSERT INTO preferences VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET value=excluded.value,updated=excluded.updated').run(owner,JSON.stringify(value),updated);},
    close(){db.close();},
  };
}
