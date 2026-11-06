import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arenaMarkdown,analyzeArena} from '../scripts/ai-test-arena-analysis.mjs';

test('artillery diagnostics distinguishes unbuilt, queued and completed rockets',()=>{
 const d=[
  {mode:'director',mapVersion:3,seed:1,firstFactory:110,firstArtilleryOrder:160,firstArtillery:189,
   factoryToArtilleryOrderSeconds:50,artilleryOrderToUnitSeconds:29,artilleryQueueAtEnd:0,
   outcome:'timeout',score:0,redUnitsLost:0,blueUnitsLost:0,captures:0,enemyHQDamage:0},
  {mode:'director',mapVersion:4,seed:2,firstFactory:150,firstArtilleryOrder:230,firstArtillery:null,
   factoryToArtilleryOrderSeconds:80,artilleryOrderToUnitSeconds:null,artilleryQueueAtEnd:1,
   outcome:'timeout',score:0,redUnitsLost:0,blueUnitsLost:0,captures:0,enemyHQDamage:0},
  {mode:'director',mapVersion:5,seed:3,firstFactory:150,firstArtilleryOrder:null,firstArtillery:null,
   factoryToArtilleryOrderSeconds:null,artilleryOrderToUnitSeconds:null,artilleryQueueAtEnd:0,
   outcome:'timeout',score:0,redUnitsLost:0,blueUnitsLost:0,captures:0,enemyHQDamage:0}
 ];
 const report={details:d,expectedRuns:3,complete:true};
 const markdown=arenaMarkdown({...report,analysis:analyzeArena(report)});
 assert.match(markdown,/Erste Artillerie: Produktionskette/);
 assert.match(markdown,/\| 3 \| 1 \| 110 \| 160 \| 189 \| 50 \| 29 \| 0 \|/);
 assert.match(markdown,/\| 4 \| 2 \| 150 \| 230 \| – \| 80 \| – \| 1 \|/);
 assert.match(markdown,/\| 5 \| 3 \| 150 \| – \| – \| – \| – \| 0 \|/);
});
