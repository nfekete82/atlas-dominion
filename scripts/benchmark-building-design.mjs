/** Isolated material/render comparison against the exact starting branch.
 * Requires a built site running at SANDFORGE_BASE_URL and browser QA deps. */
import {execFileSync} from 'node:child_process';
import {writeFileSync,unlinkSync} from 'node:fs';
import {chromium} from '../tests/browser/node_modules/playwright/index.mjs';
const ref=process.env.SANDFORGE_BUILDING_BASELINE??'9274482c';
const temporary='dist/qa-building-baseline.js';
writeFileSync(temporary,execFileSync('git',['show',ref+':scripts/webgl-faction-accents.js']));
let browser;
try{
 browser=await chromium.launch({channel:process.env.SANDFORGE_BROWSER_CHANNEL??'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 await page.goto((process.env.SANDFORGE_BASE_URL??'http://127.0.0.1:8095')+'/building-gallery.html');
 await page.waitForFunction(()=>window.__sandforgeBuildingGallery?.ready,null,{timeout:120000});
 const result=await page.evaluate(async()=>{
  const T=await import('three');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const {clone}=await import('three/addons/utils/SkeletonUtils.js');
  const old=await import('/qa-building-baseline.js'),current=await import('/webgl-faction-accents.js');
  const {applyStrategicGlbFinish}=await import('/webgl-strategic-glb.js');
  const {simplifyBarracksSilhouette}=await import('/webgl-barracks-silhouette.js');
  const {BUILDING_MEASUREMENTS}=await import('/webgl-hq3-reference.js');
  const renderer=__sandforgeBuildingGallery.renderer,gl=renderer.getContext();
  renderer.shadowMap.enabled=false;renderer.setScissorTest(false);renderer.setViewport(0,0,640,480);
  const loader=new GLTFLoader(),report={};
  const camera=new T.OrthographicCamera(-220,220,165,-165,1,4000);camera.position.set(330,290,410);camera.lookAt(0,65,0);
  const measure=scene=>{
   for(let i=0;i<12;i++)renderer.render(scene,camera);gl.finish();
   const times=[];let calls,triangles;
   for(let i=0;i<40;i++){
    renderer.info.reset();const start=performance.now();renderer.render(scene,camera);gl.finish();times.push(performance.now()-start);
    calls=renderer.info.render.calls;triangles=renderer.info.render.triangles;
   }
   times.sort((a,b)=>a-b);
   return {calls,triangles,medianMs:times[20],p95Ms:times[38]};
  };
  for(const [kind,m]of Object.entries(BUILDING_MEASUREMENTS)){
   const data=await loader.loadAsync('/src/assets/reborn/buildings-3d/'+m.file);
   const create=finish=>{
    const model=clone(data.scene);if(kind==='barracks')simplifyBarracksSilhouette(model);
    model.scale.set(m.scale,m.scale*m.heightScale,m.scale);
    const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3());model.position.set(-center.x,-bounds.min.y,-center.z);
    if(['headquarters','barracks','research','silo','bastion'].includes(kind))applyStrategicGlbFinish(model);
    finish(model,0,kind,'building');const scene=new T.Scene();scene.background=new T.Color('#ad9879');scene.add(model);
    scene.add(new T.HemisphereLight('#fff1dd','#675246',1.2));const sun=new T.DirectionalLight('#fff0d4',2.85);sun.position.set(-700,1100,420);scene.add(sun);
    return {scene,model};
   };
   const a=create(old.tintFactionMaterials),b=create(current.tintFactionMaterials);
   await renderer.compileAsync(a.scene,camera);await renderer.compileAsync(b.scene,camera);
   // Give local image requests a chance to finish before synchronized timing.
   await new Promise(resolve=>setTimeout(resolve,100));
   const before=measure(a.scene),after=measure(b.scene),back=measure(a.scene);
   const geometries=new Set();b.model.traverse(o=>{if(o.isMesh)geometries.add(o.geometry);});
   const projectionBytes=[...geometries].reduce((n,g)=>n+(g.getAttribute('sfBuildingPosition')?.array.byteLength??0),0);
   report[kind]={before,after,baselineRepeat:back,projectionBytes};
  }
  return {method:'40 synchronous 640x480 renders per GLB shell after 12 warmups; performance.now + gl.finish; same camera/lights/geometry scale; no shadows, terrain, service yards, simulation or AI; baseline repeated after candidate to expose timing noise',renderer:gl.getParameter(gl.RENDERER),results:report};
 });
 result.baseline=ref;
 writeFileSync('docs/building-design-system/qa/render-costs.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}finally{if(browser)await browser.close();unlinkSync(temporary);}
