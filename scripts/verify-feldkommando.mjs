import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
const path='src/assets/reborn/buildings-3d/sandforge_feldkommando_meshy.glb';
const expected='3cd32f7845dcf64707d71c682a0a3985e929ab18a42d76684ba5937153f63bf3';
if(!existsSync(path)){console.error('Meshy-Feldkommando noch nicht installiert:',path);process.exit(1);}
const bytes=readFileSync(path);
if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||
 bytes.readUInt32LE(8)!==bytes.length){
 console.error('Ungültige GLB-Datei');process.exit(1);
}
const hash=createHash('sha256').update(bytes).digest('hex');
if(hash!==expected){console.error('SHA-256 weicht vom hochgeladenen Original ab:',hash);process.exit(1);}
console.log('Originales Sandforge Meshy-Feldkommando überprüft:',bytes.length,'Byte');
