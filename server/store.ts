export type Session={id:string;owner:string;csrf:string;expires:number};
export type Snapshot={revision:number;entries:unknown[]};
export interface Store{
  cleanup(now:number):Promise<void>;
  session(id:string,now:number):Promise<Session|undefined>;
  addSession(session:Session):Promise<void>;
  deleteSession(id:string):Promise<void>;
  addState(id:string,expires:number):Promise<void>;
  consumeState(id:string,now:number):Promise<boolean>;
  hasNonce(nonce:string):Promise<boolean>;
  addNonce(nonce:string,expires:number):Promise<boolean>;
  /** Atomically count one hit in a fixed window bucket and return the bucket's total so far. */
  hit(bucket:string,expires:number):Promise<number>;
  latest(owner:string):Promise<Snapshot>;
  save(owner:string,revision:number,entries:unknown[]):Promise<Snapshot|null>;
  /** Account preview preferences, or null before the first save. Last write wins. */
  preferences(owner:string):Promise<unknown|null>;
  savePreferences(owner:string,value:unknown,updated:number):Promise<void>;
  close():void;
}
