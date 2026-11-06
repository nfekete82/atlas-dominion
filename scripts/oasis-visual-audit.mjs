import {chromium} from '../tests/browser/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],layouts={};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const base=process.env.ATLAS_BASE_URL??'http://127.0.0.1:8127';
for(const bastions of [4,16]){
 await page.goto(`${base}/?bastions=${bastions}&seed=2074&pause=1&fog=off`);
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded&&window.__sandforgeWebGL.desertArtReady);
 layouts[bastions]=await page.evaluate(()=>window.__sandforgeWebGL.oases.layout);
 const views=bastions===4?[
  ['water-close','water',.5,3.2,.65],['water-standard','water',.5,.59,.65],
  ['water-max-out','water',1,.46,.65],['dry-close','dry',.5,3.2,.65],
  ['semi-close','semi',.5,3.2,.65],['water-rotated','water',2.8,3.2,.65],
  ['water-low-angle','water',1.6,3.2,.29]
 ]:[['large-water','water',.5,1.55,.65],['large-dry','dry',2,1.55,.65],['large-semi','semi',1,1.55,.65]];
 for(const [name,type,angle,zoom,slope] of views){
  await page.evaluate(({type,angle,zoom,slope})=>{
   const a=window.__sandforgeWebGL,o=a.oases.layout.find(o=>o.type===type);if(!o)throw Error('Missing '+type);
   const half=a.game.world.size/2,y=a.heightAt(o.x,o.y);a.controls.target.set(o.x-half,y+22,o.y-half);
   a.camera.position.set(o.x-half+Math.sin(angle)*1000,y+1000*slope,o.y-half+Math.cos(angle)*1000);
   a.camera.zoom=zoom;a.camera.updateProjectionMatrix();a.controls.update();
  },{type,angle,zoom,slope});
  await page.waitForTimeout(700);await page.screenshot({path:`docs/qa/premium-oases/${name}.png`});
 }
}
writeFileSync('docs/qa/premium-oases/browser-errors.json',JSON.stringify(errors,null,2));
writeFileSync('docs/qa/premium-oases/layouts.json',JSON.stringify(layouts,null,2));
console.log({errors});await browser.close();
