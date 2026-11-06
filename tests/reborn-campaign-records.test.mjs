import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mostDeployed,validMatchStatistics} from '../dist/src/reborn/match-statistics.js';
import {newCampaignReport,observeCampaignReport,campaignStatisticsRecords,
 validCampaignReport,factionInReport} from '../dist/src/reborn/campaign-history.js';

test('statistics: both factions record actual deployed starting units and separate peak armies',()=>{
 const g=new Simulation(2026,4);
 for(const owner of [0,1]){
  assert.equal(g.stats.factions[owner].deployedUnits.infantry,1);
  assert.equal(g.stats.factions[owner].deployedUnits.engineer,1);
  assert.equal(g.stats.factions[owner].peakArmy,2);
  assert.equal(g.stats.factions[owner].producedUnits,0);
  assert.equal(g.stats.factions[owner].earnedCredits,0);
 }
 const next=g.units.find(u=>u.owner===0);
 const u=g.spawn(0,{x:next.x+150,y:next.y},'tank');
 assert.equal(g.stats.factions[0].deployedUnits.tank,1);
 assert.equal(g.stats.factions[0].peakArmy,3);
 g.units=g.units.filter(x=>x.id!==u.id);
 assert.equal(g.stats.factions[0].peakArmy,3,'historical peak survives casualties');
 assert.deepEqual(mostDeployed(g.stats.factions[0]),{kind:'infantry',count:1});
});

test('statistics: income counts real payouts, not credits on hand or purchases',()=>{
 const g=new Simulation(2026,4),before=g.credits.slice();
 g.aiClock=-1e8;g.incomeClock=9.96;
 const expected=[g.income(0),g.income(1)];
 g.step(.08);
 for(const owner of [0,1]){
  assert.equal(g.credits[owner],before[owner]+expected[owner]);
  assert.equal(g.stats.factions[owner].earnedCredits,expected[owner]);
  assert.equal(g.stats.factions[owner].peakIncome,expected[owner]);
 }
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(g.recruit(hq.id,'engineer'));
 assert.equal(g.stats.factions[0].earnedCredits,expected[0],'spending is not negative income');
 assert.equal(g.stats.factions[0].producedUnits,0,'queuing is not producing');
 for(let i=0;i<90;i++)g.step(.1);
 assert.equal(g.stats.factions[0].producedUnits,1,'actual HQ production completed');
 assert.equal(g.stats.factions[0].deployedUnits.engineer,2);
 assert.equal(g.stats.factions[0].earnedCredits,expected[0],'no second payout before next interval');
 assert.ok(validMatchStatistics(g.stats));
});

test('statistics: save and reload preserve cumulative income, produced units and maxima without double counting',()=>{
 const g=new Simulation(2026,4);g.aiClock=-1e8;g.incomeClock=9.95;g.step(.1);
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(g.recruit(hq.id,'engineer'));
 for(let i=0;i<90;i++)g.step(.1);
 const snapshot=g.save();
 const loaded=Simulation.load(snapshot);
 assert.deepEqual(loaded.stats,g.stats);
 for(let i=0;i<20;i++){g.step(.1);loaded.step(.1);}
 assert.deepEqual(loaded.stats,g.stats);
 assert.equal(loaded.stats.factions[0].producedUnits,1);
 assert.equal(loaded.stats.factions[0].earnedCredits,g.stats.factions[0].earnedCredits);
});

test('statistics: legacy saves are loadable, and their unavailable history is flagged partial',()=>{
 const game=new Simulation(2026,4),saved=game.save();
 delete saved.stats;
 const legacy=Simulation.load(saved);
 assert.equal(legacy.stats.partial,true);
 assert.equal(legacy.stats.factions[0].peakArmy,game.count(0));
 assert.equal(legacy.stats.factions[0].earnedCredits,0);
 assert.equal(validMatchStatistics({...legacy.stats,factions:[{...legacy.stats.factions[0],earnedCredits:-3},legacy.stats.factions[1]]}),false);
 const broken=game.save();broken.stats.factions[1].producedUnits=-1;
 assert.throws(()=>Simulation.load(broken));
});

test('history: archive keeps military/economic data for blue and red, plus records per campaign',()=>{
 const a=new Simulation(2026,4),b=new Simulation(2027,5);
 a.stats.factions[0].earnedCredits=5000;a.stats.factions[0].peakIncome=100;a.stats.factions[0].producedUnits=3;a.stats.factions[0].deployedUnits.tank=3;a.stats.factions[0].peakArmy=5;
 a.stats.factions[1].earnedCredits=8000;a.stats.factions[1].peakIncome=200;
 b.stats.factions[0].earnedCredits=9000;b.stats.factions[0].peakIncome=300;b.stats.factions[0].producedUnits=6;b.stats.factions[0].deployedUnits.tank=6;b.stats.factions[0].peakArmy=9;
 const ar=newCampaignReport(a),br=newCampaignReport(b);
 observeCampaignReport(ar,a);observeCampaignReport(br,b);
 assert.equal(factionInReport(ar,0).earnedCredits,5000);
 assert.equal(factionInReport(ar,1).earnedCredits,8000);
 const records=campaignStatisticsRecords([ar,br],0);
 assert.equal(records.earnedTotal,14000);
 assert.equal(records.producedTotal,9);
 assert.equal(records.bestCredits.value,9000);
 assert.equal(records.bestArmy.value,9);
 assert.equal(records.bestIncome.value,300);
 assert.deepEqual(records.topKind,{kind:'tank',count:9});
 assert.equal(campaignStatisticsRecords([ar,br],1).earnedTotal,8000);
 assert.equal(validCampaignReport(ar),true);
 assert.equal(validCampaignReport({...ar,stats:{...a.stats,factions:[]}}),false);
});

test('history: old reports without metrics show missing rather than fake zero records',()=>{
 const game=new Simulation(2026,4),old=newCampaignReport(game);
 delete old.stats;
 assert.equal(validCampaignReport(old),true);
 const stats=campaignStatisticsRecords([old],0);
 assert.equal(stats.bestCredits,null);
 assert.equal(stats.topKind,null);
 assert.equal(stats.bestArmy,null);
});
