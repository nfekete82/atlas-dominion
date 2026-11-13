import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
const files=[
 {path:'src/assets/reborn/sandforge-bastion-logo.webp',hash:'1ca72dc86a5498dbe84e6e7bc48feb921f25e25fd681c0fa32c59b30a3573fed'},
 {path:'src/assets/reborn/sandforge-start-background.png',hash:'3b5e44516773816fb8a8f983ea707863cd4d2e607051726d36a1cc4852b40dd8'},
];
const required=process.argv.includes('--require');
let missing=0,invalid=0;
for(const {path,hash} of files){
 if(!existsSync(path)){missing++;console.error('Nicht installiert:',path);continue;}
 const result=createHash('sha256').update(readFileSync(path)).digest('hex');
 if(result!==hash){invalid++;console.error('Abweichende Bilddatei:',path);continue;}
 console.log('Originalbild verifiziert:',path);
}
if(invalid||(required&&missing)){console.error('Sandforge-Branding unvollständig oder verändert.');process.exitCode=1;}
else if(missing)console.log('Optionales Branding-Paket noch nicht vollständig installiert.');
else console.log('Finales Sandforge-Branding vollständig.');
