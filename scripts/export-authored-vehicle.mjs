/** Shared deterministic browser exporter for self-contained authored vehicles. */
import {canonicalizeGlb} from './animation/canonical-glb.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '../tests/browser/node_modules/@playwright/test/index.mjs';
export async function exportAuthoredVehicle({kind,modulePath,builder}){
 const root=path.resolve(new URL('..',import.meta.url).pathname);
 const html=`<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script><script type="module">import {${builder} as create} from ${JSON.stringify(modulePath)};import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';window.build=async()=>{for(const team of [0,1]){const {model,animations}=create(team);const buffer=await new GLTFExporter().parseAsync(model,{binary:true,animations});let str='';const bytes=new Uint8Array(buffer);for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));await window.save(team,btoa(str),model.userData.atlasDesign);}};</script>`;
 const server=createServer(async(req,res)=>{try{if(req.url==='/build'){res.setHeader('Content-Type','text/html');res.end(html);return;}const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))throw Error('outside root');res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch({channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true});const page=await browser.newPage();page.on('pageerror',e=>console.error(e));await page.exposeFunction('save',async(team,data,stats)=>{await writeFile(path.join(root,`src/assets/reborn/animation/${kind}-${team}.glb`),canonicalizeGlb(Buffer.from(data,'base64')));console.log(JSON.stringify(stats));});await page.goto(`http://127.0.0.1:${server.address().port}/build`);await page.waitForFunction(()=>window.build);await page.evaluate(()=>window.build());}finally{await browser?.close();await new Promise(r=>server.close(r));}
}
