#!/usr/bin/env node
/** Install the exact owner-approved Meshy Military HQ in this working copy. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const allowed=new Set([
 '3cd32f7845dcf64707d71c682a0a3985e929ab18a42d76684ba5937153f63bf3',
 'd3fb94bd20cbf695c53c3b0de9d77d0d3c7c8c2704beb94c8c5666468a5fac00'
]);
if(!process.argv[2]){
 console.error('Usage: node scripts/install-meshy-headquarters.mjs /path/to/headquarters.glb');
 process.exit(2);
}
const source=resolve(process.argv[2]),bytes=readFileSync(source);
if(bytes.length<28||bytes.toString('ascii',0,4)!=='glTF'||
 bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)
 throw Error('Invalid GLB v2');
const sha=createHash('sha256').update(bytes).digest('hex');
if(!allowed.has(sha))throw Error('Different HQ GLB supplied: SHA256='+sha);
const len=bytes.readUInt32LE(12);
if(bytes.toString('ascii',16,20)!=='JSON'||20+len+8>bytes.length)
 throw Error('GLB JSON chunk malformed');
const gltf=JSON.parse(bytes.subarray(20,20+len).toString('utf8'));
if(gltf.meshes?.length!==1||gltf.animations?.length)
 throw Error('Unexpected HQ mesh/animation layout');
const dest=resolve(dirname(fileURLToPath(import.meta.url)),'../src/assets/meshy/headquarters.glb');
mkdirSync(dirname(dest),{recursive:true});
writeFileSync(dest,bytes);
console.log('Installed Meshy Feldkommando: '+dest);
console.log('SHA-256: '+sha);
console.log('Now: npm run build:3d, then commit src/assets/meshy/headquarters.glb');
