#!/usr/bin/env node
/** Compare the untouched PR #239 source and the feature on the SAME JS engine.
 * Cross-engine libm last bits are not a map migration. Navigation bytes must
 * still match exactly, with no tolerance or geometry normalization here. */
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {World} from '../dist/src/reborn/world.js';
const ref=process.argv[2]??'d97da1a35adf020c85c8566ee54bf267aa2790bb';
if(!/^[a-f0-9]{40}$/.test(ref))throw Error('Expected a full immutable baseline commit SHA');
const dir=mkdtempSync(join(tmpdir(),'sandforge-original-'));
const hash=w=>createHash('sha256').update(JSON.stringify(w.generated??null)).update(w.blocked).update(w.opaque).update(JSON.stringify(w.territories())).digest('hex');
try{
 writeFileSync(join(dir,'package.json'),'{"type":"module"}');
 const files=execFileSync('git',['ls-tree','-r','--name-only',ref,'src/reborn'],{encoding:'utf8'}).trim().split('\n').filter(f=>f.endsWith('.ts'));
 for(const path of files){
  const source=execFileSync('git',['show',`${ref}:${path}`],{encoding:'utf8',maxBuffer:20*1024*1024});
  const target=join(dir,path.replace(/\.ts$/,'.js'));mkdirSync(dirname(target),{recursive:true});
  const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
  writeFileSync(target,result.outputText);
 }
 const Before=(await import(pathToFileURL(join(dir,'src/reborn/world.js')).href)).World;
 let count=0;
 for(let version=0;version<=22;version++)for(const seed of [0,2074,4294967295]){
  if(hash(new World(seed,version))!==hash(new Before(seed,version)))throw Error(`Historical gameplay changed: v${version}, seed ${seed}`);
  count++;
 }
 console.log(JSON.stringify({baseline:ref,node:process.version,platform:process.platform,arch:process.arch,exactComparisons:count,passed:true}));
}finally{rmSync(dir,{recursive:true,force:true});}
