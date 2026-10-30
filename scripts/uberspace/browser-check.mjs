/** Uses real HTTPS + HTTP Basic. No traces, credential files or debug endpoints. */
import {cancellation} from './transport.mjs';
import {mkdir} from 'node:fs/promises';
export async function browserCheck({baseURL,credentials,release,artifacts}){
 const {chromium}=await import('../../tests/browser/node_modules/@playwright/test/index.mjs');
 const browser=await chromium.launch({channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true});
 const abort=()=>{void browser.close().catch(()=>{});};cancellation.signal.addEventListener('abort',abort,{once:true});
 const errors=[],failed=[],external=[];
 let phase='Browserkontext erstellen';
 try{
  const context=await browser.newContext({httpCredentials:credentials,viewport:{width:1440,height:1000}}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('response',r=>{if(new URL(r.url()).origin===baseURL&&r.status()>=400&&r.status()!==401)failed.push({status:r.status(),path:new URL(r.url()).pathname});});
  page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==baseURL)external.push(new URL(r.url()).origin);});
  phase='Hauptmenü und Assets laden';
  await page.goto(baseURL+'/',{waitUntil:'domcontentloaded'});await page.locator('#loading').waitFor({state:'detached',timeout:90000});
  await page.locator('#main-dialog').waitFor({state:'visible'});
  if(await page.evaluate(()=>('__reborn' in window)))throw Error('Production exposed debug state');
  phase='Neues Spiel öffnen';
  const start=page.locator('#main-dialog button').filter({hasText:/neue|neues/i}).first();await start.click();
  await page.locator('#new-dialog').waitFor({state:'visible'});await page.locator('#new-dialog button[value="new"]').click();
  phase='HQ-Baumenü prüfen';
  await page.locator('#radar-offline').waitFor({state:'visible'});await page.locator('#build-mode').click();
  await page.locator('[data-build="headquarters"]').waitFor({state:'visible'});await page.locator('[data-build="headquarters"]').click();await page.keyboard.press('r');
  if(!await page.locator('#hint').textContent().then(t=>t.includes('R: GEBÄUDE DREHEN')))throw Error('Construction hint missing');
  await page.keyboard.press('Escape');
  phase='Renderausgabe prüfen';
  const pixels=await page.locator('#world').evaluate(canvas=>{const c=canvas.getContext('2d'),d=c.getImageData(0,0,canvas.width,canvas.height).data;let n=0;for(let i=0;i<d.length;i+=400)if(d[i]>70&&d[i+1]>40)n++;return n;});
  if(pixels<100)throw Error('World/units failed to render');
  // Exercise the exact shipped modules in the authenticated browser, without
  // publishing instrumentation or changing the live game's running state.
  phase='Simulation und IndexedDB prüfen';
  const simulation=await page.evaluate(async release=>{
   const prefix='/releases/'+release+'/src/reborn/';
   const {Simulation}=await import(prefix+'simulation.js'),{saveCampaign,loadCampaign}=await import(prefix+'storage.js');
   const g=Simulation.campaign(2026,12),worker=g.units.find(u=>u.owner===0&&u.kind==='engineer');let site;
   for(const p of g.headquartersCandidates(0))if(!g.buildError(0,'headquarters',p)){site=g.build(0,'headquarters',p,[worker.id]);if(site)break;}
   if(!site)throw Error('No valid HQ in deployed simulation');
   for(let i=0;i<1800;i++)g.step();
   if(!g.radarOnline(0)||!g.radarOnline(1)||!g.bases.some(b=>b.owner===1&&b.kind==='barracks'))throw Error('Deployed HQ/AI progression failed');
   await saveCampaign(g);const loaded=await loadCampaign();if(loaded.seed!==g.seed||!loaded.radarOnline(0))throw Error('IndexedDB save roundtrip failed');
   return {headquarters:true,ai:true,indexedDB:true,statistics:!!g.stats?.factions};
  },release);
  if(!simulation.statistics)throw Error('Match statistics missing');
  phase='Browserkonsole und Ressourcenzugriffe prüfen';
  if(external.length)throw Error('Default play unexpectedly required external services');
  if(errors.length||failed.length)throw Error('Browser errors: '+JSON.stringify({errors,failed}));
  if(artifacts){await mkdir(artifacts,{recursive:true});await page.screenshot({path:artifacts+'/online-game.png'});}
  return {menu:true,game:true,construction:true,debugDisabled:true,...simulation,consoleErrors:0,failedResources:0,defaultExternalRequests:0};
 }catch(error){throw new Error('Browserprüfung ('+phase+'): '+error.message,{cause:error});}
 finally{cancellation.signal.removeEventListener('abort',abort);await browser.close();}
}
