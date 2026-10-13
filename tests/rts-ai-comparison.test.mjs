import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('AI revision comparator uses matched seed and tick count',()=>{
 const dir=mkdtempSync(join(tmpdir(),'atlas-compare-'));
 try{
  const a=join(dir,'a.json'),b=join(dir,'b.json');
  writeFileSync(a,JSON.stringify({seed:7,ticks:100,aiTerritoryDelta:25,
    shape:{thinShare:.2}}));
  writeFileSync(b,JSON.stringify({seed:7,ticks:100,aiTerritoryDelta:35,
    shape:{thinShare:.1}}));
  const cmd=()=>spawnSync(process.execPath,['scripts/compare-rts-ai.mjs',a,b],
    {encoding:'utf8'});
  const result=cmd();
  assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(result.stdout);
  assert.equal(report.rows.find(r=>r.metric==='Net AI territory').interpretation,'improved');
  assert.equal(report.rows.find(r=>r.metric==='Thin-sector share').interpretation,'improved');
  writeFileSync(b,JSON.stringify({seed:8,ticks:100}));
  assert.equal(cmd().status,2);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
