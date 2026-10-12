import {chromium} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
const source=new URL('./artifacts/screenshots/',import.meta.url),output=new URL('../../docs/qa/city-markers-20261012/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome'});
const page=await browser.newPage({viewport:{width:1296,height:1200},deviceScaleFactor:1});
for(const dpr of [1,2]){
 const items=[];
 for(const [width,height]of[[1440,900],[1920,1080],[2560,1440]])for(const zoom of[100,150,200,400]){
  const name=`after-${width}-${zoom}-dpr${dpr}`;
  const [raw,state]=await Promise.all([readFile(new URL(name+'.jpg',source)),readFile(new URL(name+'.json',source),'utf8')]);
  items.push({width,height,zoom,dpr,image:'data:image/jpeg;base64,'+raw.toString('base64'),state:JSON.parse(state)});
 }
 await page.setContent('<body style="margin:0;background:#07131c;color:#edf0ea;font:14px system-ui"></body>');
 await page.evaluate(items=>{
  document.body.style.display='grid';document.body.style.gridTemplateColumns='repeat(3, 416px)';document.body.style.gap='12px';document.body.style.padding='12px';
  for(const item of items){const card=document.createElement('div');card.innerHTML=`<p>${item.width}×${item.height} · ${item.zoom}% · DPR ${item.dpr}</p><img style="width:416px" src="${item.image}">`;document.body.append(card);}
 },items);
 await page.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
 await page.screenshot({path:new URL(`audit-maps-dpr${dpr}.jpg`,output).pathname,type:'jpeg',quality:90,fullPage:true});
 await page.setContent('<body style="margin:0;padding:12px;background:#07131c;color:#edf0ea;font:14px system-ui"></body>');
 await page.evaluate(items=>{
  document.body.style.width='800px';
  for(const item of items){
   const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:12px;margin:10px 0';
   const title=document.createElement('span');title.style.width='240px';title.textContent=`${item.width}×${item.height} · ${item.zoom}% · DPR ${item.dpr}`;row.append(title);
   for(let level=0;level<=5;level++){
    const marker=item.state.markers.find(m=>m.level===level),tile=document.createElement('div');tile.style.cssText='position:relative;overflow:hidden;width:70px;height:70px;border:1px solid #34505a;flex-shrink:0';
    if(marker){const img=document.createElement('img');img.src=item.image;img.style.cssText=`position:absolute;max-width:none;width:${item.width*2}px;left:${35-marker.x*2}px;top:${35-(marker.y+66)*2}px`;tile.append(img);}else tile.textContent=`${level}: hidden`;
    row.append(tile);
   }
   document.body.append(row);
  }
 },items);
 await page.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
 await page.screenshot({path:new URL(`audit-markers-dpr${dpr}.jpg`,output).pathname,type:'jpeg',quality:95,fullPage:true});
}
await browser.close();
