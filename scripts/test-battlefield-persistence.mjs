#!/usr/bin/env node
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(new URL('../tests/browser/package.json',import.meta.url));
const {chromium}=require('playwright');
const profile=mkdtempSync(join(tmpdir(),'sandforge-persistence-')),base=process.env.BATTLEFIELD_BASE_URL??'http://127.0.0.1:8132';
const options={channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true,viewport:{width:1280,height:820}},rows=[];
let context;
try{
 for(const [version,count,terrain] of [[19,4,null],[23,4,'rocky'],[26,16,'oasis']]){
  context=await chromium.launchPersistentContext(profile,options);
  let page=context.pages()[0];await page.goto(`${base}/?bastions=${count}&seed=4294967295&pause=1&lite=1${terrain?'&terrain='+terrain:''}`);
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded);
  const saved=await page.evaluate(()=>{
   const a=window.__sandforgeWebGL;if(!a.battlefield.saveGame())throw Error('Save failed');
   return {seed:a.game.seed,version:a.game.world.mapVersion,geometry:JSON.stringify(a.terrain),blocked:Array.from(a.game.world.blocked),fog:Array.from(a.game.explored[0])};
  });
  await context.close();context=null; // close the actual Chrome process
  context=await chromium.launchPersistentContext(profile,options);page=context.pages()[0];
  await page.goto(base+'/');await page.locator('#sf3d-continue').click();await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded);
  const restored=await page.evaluate(()=>{
   const a=window.__sandforgeWebGL;return {seed:a.game.seed,version:a.game.world.mapVersion,geometry:JSON.stringify(a.terrain),blocked:Array.from(a.game.world.blocked),fog:Array.from(a.game.explored[0])};
  });
  if(JSON.stringify(saved)!==JSON.stringify(restored))throw Error(`Save changed across browser restart: v${version}`);
  rows.push({version,count,terrain,seed:saved.seed,realBrowserRestart:true,geometryCollisionAndExplorationUnchanged:true});
  await context.close();context=null;console.log(`persistent browser restart v${version}: passed`);
 }
}finally{await context?.close();rmSync(profile,{recursive:true,force:true});}
mkdirSync('docs/qa/procedural-battlefields',{recursive:true});writeFileSync('docs/qa/procedural-battlefields/persistence.json',JSON.stringify({rows},null,2)+'\n');
