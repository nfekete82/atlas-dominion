import {readFileSync} from 'node:fs';

if(process.argv.length!==4){
 console.error('Usage: node scripts/compare-rts-ai.mjs old-report.json new-report.json');
 process.exitCode=2;
}else{
 const [oldFile,newFile]=process.argv.slice(2);
 const old=JSON.parse(readFileSync(oldFile,'utf8'));
 const current=JSON.parse(readFileSync(newFile,'utf8'));
 if(old.seed!==current.seed||old.ticks!==current.ticks||(old.opponents??8)!==(current.opponents??8)||
    (old.playerCode??'DE')!==(current.playerCode??'DE')){
   console.error('Reports require identical seed, tick count, opponents and player country');
   process.exitCode=2;
 }else{
   const get=(source,path)=>path.split('.').reduce((value,key)=>value?.[key],source);
   const measures=[
     ['neutralGainsByPhase.opening','Neutral opening captures','higher'],
     ['neutralGainsByPhase.middle','Neutral mid-game captures','higher'],
     ['neutralGainsByPhase.late','Neutral late-game captures','higher'],
     ['aiTerritoryDelta','Net AI territory','higher'],
     ['losses','Real soldier losses','lower'],
     ['movement.movedSquadTicks','Actual movement ticks','context'],
     ['movement.reversals','Immediate reversals','lower'],
     ['movement.invalidLandMoves','Invalid land moves','lower'],
     ['movement.seaLandings','Actual sea landings','context'],
     ['performance.medianStepMs','Median tick duration (ms)','lower'],
     ['performance.p95StepMs','P95 tick duration (ms)','lower'],
     ['shape.thinShare','Thin-sector share','lower'],
     ['shape.perimeterPerSector','Perimeter per owned sector','lower'],
     ['inactivity.stationaryUnorderedTicks','Stationary without orders','lower'],
     ['inactivity.longIdleEpisodes','Long stationary streaks','lower'],
     ['activeSquadShare','Squads with orders','context']
   ];
   const rows=measures.flatMap(([path,label,better])=>{
     const previous=get(old,path),now=get(current,path);
     if(typeof previous!=='number'||typeof now!=='number')return [];
     const delta=Number((now-previous).toFixed(5));
     return [{metric:label,previous,current:now,delta,
       interpretation:better==='context'?'context':
         delta===0?'same':(better==='higher'?delta>0:delta<0)?'improved':'worse'}];
   });
   console.log(JSON.stringify({seed:current.seed,ticks:current.ticks,rows},null,2));
 }
}
