import { Simulation, type Save } from './simulation.js';
const DB='atlas-dominion-reborn', STORE='campaigns';
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('Der lokale Spielstandspeicher ist nicht verfügbar.'));
});}
export async function saveCampaign(game:Simulation):Promise<void>{
  const snapshot=game.save(),db=await open();try{await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(snapshot,'campaign');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
}
export async function loadCampaign():Promise<Simulation>{
  const db=await open();try{const snapshot=await new Promise<Save|undefined>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get('campaign');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });if(!snapshot)throw new Error('Noch kein Spielstand vorhanden. Zuerst mit F5 speichern.');return Simulation.load(snapshot);}finally{db.close();}
}

/** Availability probe only: never loads, changes or overwrites the last save. */
export async function hasSavedCampaign():Promise<boolean>{
 const db=await open();
 try{return await new Promise<boolean>((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly');
  const req=tx.objectStore(STORE).getKey('campaign');
  req.onsuccess=()=>resolve(req.result!==undefined);
  req.onerror=()=>reject(req.error);
 });}finally{db.close();}
}
