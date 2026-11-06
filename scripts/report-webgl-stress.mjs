/** Create an Actions summary from the exact CI stress JSON evidence. */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(process.env.STRESS_OUTPUT_DIR??'tests/browser/artifacts/stress');
const read=name=>{
 const path=join(root,name);
 if(!existsSync(path))return null;
 try{return JSON.parse(readFileSync(path,'utf8'));}catch{return null;}
};
const rows=['# Sandforge WebGL 3D — automated stress evidence','',
 'Runner: '+(process.env.RUNNER_OS??process.platform)+' · Commit: '+(process.env.GITHUB_SHA??'local'),
 '',
 '## Authoritative simulation (synthetic opposing armies + regular AI)',
 '',
 '| Bastionen | Simulierte Sekunden | Partien | Kampfereignisse | Sim p95 (early / mid / late) | Heap MB | Status |',
 '|---:|---:|---:|---:|---:|---:|---|'];
for(const n of [4,8,12,16]){
 const r=read('simulation-'+n+'.json');
 rows.push(r?'| '+n+' | '+r.secondsReached.toFixed(1)+' | '+r.episodes.length+' | '+r.combat.damageEvents+
  ' | '+r.stages.map(s=>s.p95.toFixed(2)).join(' / ')+' ms | '+r.heapMB+
  ' | '+(r.errors.length?'FAIL: '+r.errors.join(', '):'PASS')+' |':
  '| '+n+' | — | — | — | — | — | no report |');
}
rows.push('','## Real Chromium/Three.js load (software GPU)',
 '',
 '| Bastionen | FPS (idle / combat / post) | Frame p95 (idle / combat / post) | Draw calls | JS Heap MB (idle / combat / post) | Warnungen |',
 '|---:|---:|---:|---:|---:|---|');
for(const n of [4,8,12,16]){
 const r=read('webgl-'+n+'.json');
 rows.push(r?'| '+n+' | '+[r.before,r.battle,r.after].map(s=>s.fps.toFixed(1)).join(' / ')+
  ' | '+[r.before,r.battle,r.after].map(s=>s.frameP95.toFixed(1)).join(' / ')+' ms | '+
  [r.before,r.battle,r.after].map(s=>s.drawCalls).join(' / ')+' | '+
  [r.before,r.battle,r.after].map(s=>s.heapMB.toFixed(1)).join(' / ')+' | '+
  (r.warnings.length?r.warnings.join('; '):'—')+' |':
  '| '+n+' | — | — | — | — | no report |');
}
rows.push('',
 '### Interpretation',
 'This is a synthetic, repeatable load test, not an AI win-rate or full-duration manual gameplay certification.',
 'FPS and frame p95 depend heavily on the GitHub Ubuntu runner and software-rendered WebGL; do not compare them directly with Apple Silicon hardware.',
 'Hard checks detect crashes, missing frames, stalled game time and catastrophic resource growth. Moderate post-fight regressions appear as warnings and should be inspected.',
 'Artifacts include exact per-scenario JSON, screenshots and Playwright failure traces.');
const report=rows.join('\n')+'\n';
mkdirSync(root,{recursive:true});
writeFileSync(join(root,'README.md'),report);
if(process.env.GITHUB_STEP_SUMMARY){
 writeFileSync(process.env.GITHUB_STEP_SUMMARY,report,{flag:'a'});
}
console.log(report);
