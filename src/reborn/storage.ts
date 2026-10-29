import { Simulation, type Save } from './simulation.js';
import {portableExperience,readPortableExperience,type Experience} from './battle-learning.js';
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

/** Optional local tactical lessons. Deliberately excludes active missions,
 * unit positions, map seeds, ownership and IDs; never sent to a server. */
const LESSON_KEY='sandforge-tactical-lessons-v1';
const PREFERENCE_KEY='sandforge-transfer-lessons-enabled';
export function readAiLearningPreference():boolean {
 try{return localStorage.getItem(PREFERENCE_KEY)==='true';}catch{return false;}
}
export function storeAiLearningPreference(enabled:boolean):void {
 try{localStorage.setItem(PREFERENCE_KEY,String(enabled));}catch{/* storage optional */}
}
export function loadAiLearningProfile():Experience|undefined {
 try{return readPortableExperience(JSON.parse(localStorage.getItem(LESSON_KEY)??'null'));}catch{return undefined;}
}
export function saveAiLearningProfile(source:Experience|undefined):void {
 if(!source?.records.length)return;
 try{localStorage.setItem(LESSON_KEY,JSON.stringify(portableExperience(source)));}catch{/* storage optional */}
}
