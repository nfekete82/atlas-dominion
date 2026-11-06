import {chromium} from '../tests/browser/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),results=[];
const base=process.env.ATLAS_BASE_URL??'http://127.0.0.1:8127';
for(const bastions of [4,16]){
 let focus;
 for(const enabled of [true,false]){
  await page.goto(`${base}/?bastions=${bastions}&seed=2074&pause=1&fog=off&oases=${enabled?'on':'off'}`);
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded&&window.__sandforgeWebGL.desertArtReady);
  if(enabled)focus=await page.evaluate(()=>window.__sandforgeWebGL.oases.layout[0]);
  await page.evaluate(f=>{const a=window.__sandforgeWebGL,t=a.controls.target.clone();
   t.set(f.x-a.game.world.size/2,a.heightAt(f.x,f.y)+24,f.y-a.game.world.size/2);
   a.camera.position.add(t.clone().sub(a.controls.target));a.controls.target.copy(t);a.camera.zoom=1.55;a.camera.updateProjectionMatrix();a.controls.update();},focus);
  await page.waitForTimeout(2500);
  const metrics=await page.evaluate(async()=>{
   const a=window.__sandforgeWebGL,frames=[];let last=performance.now();
   for(let i=0;i<180;i++){await new Promise(requestAnimationFrame);const now=performance.now();frames.push(now-last);last=now;}
   frames.sort((a,b)=>a-b);const gl=a.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
   const geometries=new Set(),textures=new Set();let attributeBytes=0;
   a.oases.root.traverse(n=>{if(n.geometry)geometries.add(n.geometry);});
   for(const g of geometries){for(const v of Object.values(g.attributes))attributeBytes+=v.array.byteLength;if(g.index)attributeBytes+=g.index.array.byteLength;}
   return {render:a.renderer.info.render,memory:a.renderer.info.memory,programs:a.renderer.info.programs.length,
    frameMs:{median:frames[90],p95:frames[171]},renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
    oasisGeometryBufferBytes:attributeBytes,oases:a.oases.layout.length};
  });
  results.push({bastions,enabled,focus,...metrics});
 }
}
writeFileSync('docs/qa/premium-oases/performance-comparison.json',JSON.stringify(results,null,2));await browser.close();
