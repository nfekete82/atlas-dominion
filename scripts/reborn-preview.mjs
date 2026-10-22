import {chromium} from '../tests/browser/node_modules/@playwright/test/index.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8097/?debug');await page.locator('#loading').waitFor({state:'detached'});
 await page.screenshot({path:'docs/reborn/initial.png'});
 console.log(JSON.stringify(await page.evaluate(()=>({title:document.title,sprite:{x:window.__reborn.renderer.infantry.x,y:window.__reborn.renderer.infantry.y,w:window.__reborn.renderer.infantry.w,h:window.__reborn.renderer.infantry.h},time:window.__reborn.game.time})),null,2));
 console.log('Browser errors:',errors);
} finally {await browser.close();}
