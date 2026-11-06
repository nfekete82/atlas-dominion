import {test,expect} from '@playwright/test';

test('live Sandforge never activates a sandstorm, even after time skip or restoring a historic storm save',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?debug&perfTest&seed=2026&map=medium');
 await page.locator('#loading').waitFor({state:'detached'});
 const result=await page.evaluate(async()=>{
  const app=window.__reborn,g=app.game;
  g.paused=false;g.aiClock=-1e8;
  const before={phase:g.weather.phase,intensity:g.weather.intensity};
  g.time=12000;g.step(.05);app.refresh();app.renderer.render(0);
  const after={phase:g.weather.phase,intensity:g.weather.intensity,sight:g.units.find(u=>u.owner===0)?.kind};
  const {Simulation}=await import('/src/reborn/simulation.js');
  const historical=new Simulation(2026,8,true);
  historical.time=historical.weather.endsAt+12;
  historical.weather.update(historical.time);
  const reloaded=Simulation.load(historical.save());
  return {before,after,hidden:document.querySelector('#weather-status').hidden,
    restoredPhase:reloaded.weather.phase,restoredIntensity:reloaded.weather.intensity,
    notices:g.notices.filter(n=>/sandsturm|sichtbedingungen/i.test(n))};
 });
 expect(result.before).toEqual({phase:'CLEAR',intensity:0});
 expect(result.after.phase).toBe('CLEAR');
 expect(result.after.intensity).toBe(0);
 expect(result.hidden).toBe(true);
 expect(result.restoredPhase).toBe('CLEAR');
 expect(result.restoredIntensity).toBe(0);
 expect(result.notices).toEqual([]);
 expect(errors).toEqual([]);
});
