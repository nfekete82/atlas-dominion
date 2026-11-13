#!/usr/bin/env node
/**
 * Copy the separately supplied, optimized user Meshy GLBs into Sandforge.
 *
 * Usage: node scripts/install-meshy-assets.mjs /path/to/unzipped-assets
 *        npm run build:3d
 *        PORT=8299 npm run preview
 *        open http://localhost:8299/?models=meshy
 *
 * This does not touch existing buildings, stats, collision, or animation files.
 */
import {copyFileSync,mkdirSync,readFileSync,statSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const source=process.argv[2];
if(!source){console.error('Usage: node scripts/install-meshy-assets.mjs /path/to/unzipped-assets');process.exitCode=2;}
else{
 const origin=resolve(source);
 const target=resolve(fileURLToPath(new URL('../src/assets/meshy/',import.meta.url)));
 mkdirSync(target,{recursive:true});
 const manifestPath=join(origin,'manifest.json');
 const rows=existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath,'utf8')):[];
 if(!Array.isArray(rows))throw Error('manifest.json must be an array');
 const approved=new Set(['headquarters','tank','infantry','artillery','rocket']);
 let copied=0;
 for(const kind of approved){
  const filename=kind+'.glb',input=join(origin,filename);
  if(!existsSync(input))continue;
  const bytes=readFileSync(input);
  const magic=bytes.length>=12?bytes.subarray(0,4).toString('ascii'):'';
  if(magic!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)
   throw Error('Invalid GLB v2 '+filename);
  const row=rows.find(r=>r.kind===kind);
  const sha=createHash('sha256').update(bytes).digest('hex');
  if(row?.sha256&&sha!==row.sha256)throw Error('Asset checksum mismatch '+filename);
  const out=join(target,filename);
  copyFileSync(input,out);copied++;
  console.log('Installed',kind,Math.round(bytes.length/1024)+' KiB','sha256='+sha.slice(0,16));
 }
 if(!copied)throw Error('No valid headquarters/tank/infantry/artillery/rocket GLB found in '+origin);
 console.log('Installed',copied,'original user-provided GLBs.');
 console.log('Rebuild with npm run build:3d; test with ?models=meshy in the URL.');
 console.log('Unrigged infantry requires explicit ?meshyStaticSoldier=1 and cannot play clips.');
}
