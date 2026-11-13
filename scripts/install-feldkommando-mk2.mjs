#!/usr/bin/env node
/**
 * Install the user-supplied Sandforge Feldkommando MK2 GLB.
 * Never replaces HQ3; keeps it as the game's safe fallback.
 */
import {readFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const input=process.argv[2];
if(!input){
 console.error('Usage: npm run assets:feldkommando-mk2 -- "/path/to/Sandforge_Feldkommando_MK2.glb"');
 process.exit(2);
}
const bytes=readFileSync(resolve(input));
if(bytes.length<20||bytes.toString('ascii',0,4)!=='glTF'||
 bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)
 throw new Error('Not a valid binary glTF 2.0 (GLB).');
const jsonSize=bytes.readUInt32LE(12),chunkType=bytes.toString('ascii',16,20);
if(chunkType!=='JSON'||20+jsonSize>bytes.length)throw Error('Invalid GLB JSON chunk.');
const doc=JSON.parse(bytes.subarray(20,20+jsonSize).toString('utf8'));
const nodes=new Set((doc.nodes??[]).map(node=>node.name));
const clips=new Set((doc.animations??[]).map(anim=>anim.name));
for(const name of ['Door_Left_Pivot','Door_Right_Pivot',
 'Fence_Gate_Left_Pivot','Fence_Gate_Right_Pivot','Radar_Dish_Pivot'])
 if(!nodes.has(name))throw Error('Required MK2 node missing: '+name);
for(const name of ['Doors_Open','Doors_Close','Doors_Cycle','Radar_Scan'])
 if(!clips.has(name))throw Error('Required MK2 animation missing: '+name);
const destination=resolve(dirname(fileURLToPath(import.meta.url)),
 '../src/assets/reborn/buildings-3d/sandforge_feldkommando_mk2.glb');
mkdirSync(dirname(destination),{recursive:true});
copyFileSync(resolve(input),destination);
const sha=createHash('sha256').update(bytes).digest('hex');
console.log('Feldkommando MK2 installed: '+destination);
console.log('Size: '+(bytes.length/1024/1024).toFixed(2)+' MiB; SHA-256: '+sha);
console.log('Run: npm run build:3d && PORT=8107 npm run dev');
