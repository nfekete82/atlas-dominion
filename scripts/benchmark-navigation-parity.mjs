#!/usr/bin/env node
/** Count pure A* edge checks and compare exact route results on known inputs.
 * No sources are rewritten: instrumentation is imported from data: modules.
 * node scripts/benchmark-navigation-parity.mjs --before /reference/checkout \
 *   --after dist/src/reborn/world.js --output /tmp/navigation-parity.json
 * Paths accept a checkout containing dist/src/reborn/world.js, a compiled
 * directory containing world.js, or the compiled world.js file itself. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,stat,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';

const hash=value=>createHash('sha256').update(value).digest('hex');
const maps=[3,4,5],seeds=[2026,2027];
const edgeGuard=/if\s*\(\s*precise\s*&&\s*!line\(i\s*===\s*s\s*\?\s*start\s*:\s*this\.center\(i\),\s*j\s*===\s*goal\s*\?\s*end\s*:\s*this\.center\(j\)\)\s*\)\s*continue\s*;/g;

function options(argv){
 const out={};
 for(let i=0;i<argv.length;i+=2){
  if(!['--before','--after','--output'].includes(argv[i])||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Use --before path [--after path --output file]');
  if(Object.hasOwn(out,argv[i].slice(2)))throw Error('Duplicate option '+argv[i]);
  out[argv[i].slice(2)]=argv[i+1];
 }
 if(!out.before)throw Error('--before requires an immutable compiled reference; no temporary archive is assumed');
 return {before:resolve(out.before),after:resolve(out.after??'dist/src/reborn/world.js'),output:out.output?resolve(out.output):null};
}

async function worldPath(input){
 if((await stat(input)).isFile())return input;
 for(const candidate of [join(input,'dist/src/reborn/world.js'),join(input,'world.js')]){
  try{if((await stat(candidate)).isFile())return candidate;}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 throw Error('No compiled world.js under '+input);
}

async function model(input){
 const path=await worldPath(input),url=pathToFileURL(path),raw=await readFile(path,'utf8');
 assert.equal([...raw.matchAll(edgeGuard)].length,1,'Expected one exact A* edge guard in '+path);
 assert.ok(raw.includes('import { navigationLine }'),'Expected direct navigationLine import in '+path);
 const source=raw.replace(/from '\.\/([^']+)'/g,(_,name)=>`from '${new URL(name,url).href}'`)
  .replace('import { navigationLine }','import { navigationLine as exactNavigationLine }')
  .replace(edgeGuard,guard=>'if (precise) __edgeChecks++;\n'+guard);
 const instrumentation=`let __edgeChecks=0,__navigationCalls=0;
export const navigationParityCounts=()=>({edgeChecks:__edgeChecks,navigationLineCalls:__navigationCalls});
export const resetNavigationParityCounts=()=>{__edgeChecks=__navigationCalls=0;};
const navigationLine=(...args)=>{__navigationCalls++;return exactNavigationLine(...args);};\n`;
 const module=await import('data:text/javascript;base64,'+Buffer.from(instrumentation+source).toString('base64'));
 const config=await import(new URL('config.js',url).href),hashes={};
 for(const name of ['world.js','navigation-line.js','config.js','world-generation.js','terrain-art.js','performance.js'])hashes[name]=hash(await readFile(new URL(name,url)));
 return {module,grid:config.RULES.grid,metadata:{path,sourceHashes:hashes}};
}

function routeHash(route){
 const bytes=Buffer.alloc(route.length*16);
 route.forEach((point,i)=>{bytes.writeDoubleLE(point.x,i*16);bytes.writeDoubleLE(point.y,i*16+8);});
 return hash(bytes);
}

export async function main(argv){
 const args=options(argv),before=await model(args.before),after=await model(args.after);
 assert.equal(before.grid,after.grid,'Unequal navigation grids');
 const grid=before.grid;
 const report={schemaVersion:1,complete:false,scope:'Exact route parity and deterministic call counts only; no wall-clock CPU claim. Instrumentation is in memory and changes no source files.',
  inputs:{maps,seeds,heldoutInputs:false,clearance:10,obstacles:[],route:'First to last public territory control point, each projected with nearest(clearance=10)',
   riskVariants:['none','synthetic band: grid columns 100..139, every row, value 3; all other cells zero']},
  modules:{before:before.metadata,after:after.metadata},observerHash:hash(await readFile(new URL(import.meta.url))),
  expectedCases:12,details:[],totals:{before:{edgeChecks:0,navigationLineCalls:0},after:{edgeChecks:0,navigationLineCalls:0}},allRoutesIdentical:false};
 const persist=async()=>{if(args.output){await mkdir(dirname(args.output),{recursive:true});await writeFile(args.output+'.tmp',JSON.stringify(report,null,2)+'\n');await rename(args.output+'.tmp',args.output);}};
 await persist();
 try{
  for(const map of maps)for(const seed of seeds){
   const worlds=[before,after].map(m=>new m.module.World(seed,map)),points=worlds.map(w=>w.territories(seed).map(t=>t.point));
   assert.deepEqual(worlds[1].blocked,worlds[0].blocked,'Unequal terrain');assert.deepEqual(points[1],points[0],'Unequal public control points');
   const projected=worlds.map((w,i)=>({start:w.nearest(points[i][0],[],[],undefined,10),end:w.nearest(points[i].at(-1),[],[],undefined,10)}));
   assert.deepEqual(projected[1],projected[0],'Unequal projected endpoints');
   const {start,end}=projected[0];assert.ok(start&&end,'Missing walkable endpoints');
   for(const weighted of [false,true]){
    const risk=weighted?new Float32Array(grid**2):undefined;
    if(risk)for(let y=0;y<grid;y++)for(let x=100;x<140;x++)risk[y*grid+x]=3;
    const variants={};
    for(const [i,label] of ['before','after'].entries()){
     const m=i?after:before;m.module.resetNavigationParityCounts();
     const route=worlds[i].path(start,end,[],10,risk,false,true);
     variants[label]={route,routeHash:routeHash(route),counts:m.module.navigationParityCounts()};
    }
    assert.deepEqual(variants.after.route,variants.before.route,`Route differs: map ${map}, seed ${seed}, weighted ${weighted}`);
    assert.equal(variants.after.routeHash,variants.before.routeHash,'Waypoint IEEE754 bytes differ');
    assert.ok(variants.before.route.length,'Fixture must return a real route');
    for(const label of ['before','after'])for(const key of ['edgeChecks','navigationLineCalls'])report.totals[label][key]+=variants[label].counts[key];
    report.details.push({map,seed,weighted,start,end,terrainHash:hash(worlds[0].blocked),routesIdentical:true,...variants});await persist();
    console.log(`map=${map} seed=${seed} weighted=${weighted} identical=true edgeChecks=${variants.before.counts.edgeChecks}->${variants.after.counts.edgeChecks}`);
   }
  }
  report.complete=report.details.length===report.expectedCases;report.allRoutesIdentical=report.complete;
  report.avoidedEdgeChecksPercent=100*(1-report.totals.after.edgeChecks/report.totals.before.edgeChecks);
  await persist();return report;
 }catch(error){report.failure=String(error);await persist();throw error;}
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const report=await main(process.argv.slice(2));console.log(JSON.stringify({complete:report.complete,cases:report.details.length,allRoutesIdentical:report.allRoutesIdentical,totals:report.totals,avoidedEdgeChecksPercent:report.avoidedEdgeChecksPercent}));
}
