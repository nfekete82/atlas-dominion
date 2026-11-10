import {test,expect} from '@playwright/test';

test('walking infantry stays silent without footsteps or motor voices',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&terrain=dunes&play=1&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:100000});
 // One real user gesture unlocks Chromium WebAudio, just as clicking a unit does.
 await page.mouse.click(46,115);
 await page.waitForFunction(()=>window.__sandforgeWebGL?.sound?.context?.state==='running',
  null,{timeout:10000});
 const result=await page.evaluate(()=>{
  const {game:g,sound}=window.__sandforgeWebGL;
  const soldier=g.units.find(u=>u.kind==='infantry'&&u.owner===0&&u.hp>0);
  if(!soldier)throw Error('Starting infantry missing');
  sound.bindGame(g);
  const view={
   width:1440,height:900,
   camera:{x:soldier.x,y:soldier.y,zoom:1},
   screen:()=>({x:720,y:400})
  };
  // Move the infantry unit without scheduling any synthetic footstep effect.
  sound.update(g,view);
  soldier.previousX=soldier.x;
  soldier.previousY=soldier.y;
  soldier.x+=5;soldier.moving=true;
  soldier.walkDistance+=64;
  g.time+=.1;
  sound.update(g,view);
  const engineVoices=[...sound.engineVoices.entries()].map(([kind,voice])=>({
   kind,value:voice.gain.gain.value,previousMotion:voice.previousMotion
  }));
  return {unit:soldier.kind,steps:sound.played.steps,engines:engineVoices};
 });
 expect(result.unit).toBe('infantry');
 expect(result.steps).toBe(0);
 expect(result.engines).toHaveLength(5);
 for(const motor of result.engines){
  expect(motor.value).toBe(0);
  expect(motor.previousMotion).toBe(0);
 }
 expect(errors).toEqual([]);
});
