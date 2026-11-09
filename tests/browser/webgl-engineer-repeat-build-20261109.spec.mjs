import {test,expect} from '@playwright/test';

test('pioneer remains selected and places an HQ despite normal mouse movement',async({page})=>{
 test.setTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-preview.html?bastions=4&seed=2074&terrain=dunes&play=1&lite=1&pause=1',
  {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:100000});
 const result=await page.evaluate(()=>{
  const {game:g,battlefield:b}=window.__sandforgeWebGL;
  const engineer=b.selectEngineer();
  if(!engineer)throw Error('Starting engineer not found');
  b.beginPlacement('headquarters');
  b.drawInterface();
  const before=g.bases.length;
  let selectedBoxCalled=0;
  const originalBox=b.selectBoxUnits,originalTerrain=b.terrainPoint;
  b.selectBoxUnits=()=>{selectedBoxCalled++;};
  let built=null;
  try{
   for(const point of g.headquartersCandidates(0)){
    if(g.buildError(0,'headquarters',point))continue;
    b.terrainPoint=()=>({...point});
    b.clickStart={x:120,y:120,button:0};
    b.pointerUp({button:0,clientX:136,clientY:120,shiftKey:false});
    built=g.bases.find(x=>x.owner===0&&x.kind==='headquarters'&&x.buildRemaining>0);
    if(built)break;
   }
  }finally{
   b.selectBoxUnits=originalBox;b.terrainPoint=originalTerrain;
  }
  return {
   before,after:g.bases.length,
   built:!!built,
   workerSelected:b.selected.has(engineer.id),
   workerId:engineer.id,
   actualOrders:engineer.orders.map(x=>x.kind),
   selectedBoxCalled,
   hudParent:document.querySelector('#sf-selection-panel').parentElement.id,
   builderButton:!!document.querySelector('[data-action="select-engineer"]'),
   lpRow:!!document.querySelector('#sf-selection .sf-health-row')
  };
 });
 expect(result.built).toBe(true);
 expect(result.after).toBe(result.before+1);
 expect(result.workerSelected).toBe(true);
 expect(result.actualOrders).toContain('build');
 expect(result.selectedBoxCalled).toBe(0);
 expect(result.hudParent).toBe('sidebar');
 expect(result.builderButton).toBe(true);
 expect(result.lpRow).toBe(true);
 expect(errors).toEqual([]);
});
