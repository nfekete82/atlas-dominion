/** Offline, reproducible 3D -> 2D asset build. No Three.js in the game runtime. */
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '../tests/browser/node_modules/@playwright/test/index.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname),out=path.join(root,'src/assets/reborn/animation');await mkdir(out,{recursive:true});
const args=process.argv.slice(2),hd=args.includes('--hd');
const vehicleKinds=['rover','tank','artillery','scout','gunship','bomber'];
const kinds=args.filter(arg=>!arg.startsWith('--'));
const requested=hd&&kinds.length===0?vehicleKinds:kinds;
if(hd&&requested.some(kind=>!vehicleKinds.includes(kind)))throw Error('HD vehicle exporter accepts: '+vehicleKinds.join(', '));
const server=createServer(async(req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))throw Error('outside root');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true});
try{
 const page=await browser.newPage();page.on('pageerror',e=>console.error(e));page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
 await page.goto(`http://127.0.0.1:${server.address().port}/scripts/animation/render.html${hd?'?cell=192&atlasOnly=1':''}`);await page.waitForFunction(()=>!!window.compileAtlases);
 await page.exposeFunction('saveAtlas',async(name,png,metadata)=>{await writeFile(path.join(out,name+'.png'),Buffer.from(png.split(',')[1],'base64'));await writeFile(path.join(out,name+'.json'),JSON.stringify(metadata,null,2)+'\n');console.log(name,metadata.frames.length,'frames');});
 await page.exposeFunction('saveVehicleModel',async(name,data)=>{await writeFile(path.join(out,name),Buffer.from(data));});
 await page.evaluate(kinds=>window.compileAtlases(kinds),requested);
}finally{await browser.close();await new Promise(r=>server.close(r));}
