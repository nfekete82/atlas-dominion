import {writeFile,mkdir} from 'node:fs/promises';
const {Simulation}=await import(process.env.ATLAS_SIM_MODULE??'../dist/src/reborn/simulation.js');
const seeds=process.argv.slice(3).length?process.argv.slice(3).map(Number):[2026,42],results=[];
for(const seed of seeds){
 const g=Simulation.campaign(seed),blue=new Set(g.territories.filter(t=>t.owner===0).map(t=>t.id));
 let firstShot=null,firstPlayerSector=null,shots=0,attacks=0,lastPhase='';const snapshots=[];
 for(let i=0;i<6000&&g.status==='playing';i++){
  g.step(.1);const s=g.tactical.state;
  if(s.phase==='attack'&&lastPhase!=='attack')attacks++;lastPhase=s.phase;
  if(g.shots.some(s=>s.owner===1)&&firstShot===null)firstShot=g.time;
  for(const shot of g.shots)if(shot.owner===1&&Math.abs((shot.at??-1)-g.time)<.01)shots++;
  if(firstPlayerSector===null&&g.territories.some(t=>blue.has(t.id)&&t.owner===1))firstPlayerSector=g.time;
  if(i%300===299)snapshots.push({time:g.time,phase:s.phase,group:[...s.group],units:g.count(1),playerSectorsTaken:g.territories.filter(t=>blue.has(t.id)&&t.owner===1).length,redSectors:g.territories.filter(t=>t.owner===1).length,production:s.economy?.produced,built:s.economy?.built});
 }
 const result={seed,firstShot,firstPlayerSector,endTime:g.time,status:g.status,attacks,shots,snapshots};results.push(result);
 console.log(`Seed ${seed}: first player sector ${firstPlayerSector?.toFixed(1)} s; first shot ${firstShot?.toFixed(1)} s; ${g.status} at ${g.time.toFixed(1)} s`);
}
await mkdir('docs/qa/2026-10-24-tactics',{recursive:true});await writeFile(`docs/qa/2026-10-24-tactics/pressure-${process.argv[2]??'after'}.json`,JSON.stringify(results,null,2)+'\n');
