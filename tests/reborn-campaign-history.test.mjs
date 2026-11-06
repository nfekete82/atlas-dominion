import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newCampaignReport,observeCampaignReport,finishCampaignReport,
 readCampaignReports,writeCampaignReport,summarizeCampaignArchive,validCampaignReport} from '../dist/src/reborn/campaign-history.js';
import {WeatherPresentation} from '../dist/src/reborn/weather-presentation.js';
import {PALM_ART_SCALE} from '../dist/src/reborn/palm-grove.js';
const game=()=>new Simulation(2026,4);

test('history: a real red bastion capture counts as won duel; neutral captures remain separate',()=>{
 const g=game(),report=newCampaignReport(g,'2026-10-29T19:00:00.000Z');
 const red=g.territories.find(t=>t.owner===1),neutral=g.territories.find(t=>t.owner===-1),blue=g.territories.find(t=>t.owner===0);
 assert.ok(red&&neutral&&blue);
 red.owner=0;neutral.owner=0;blue.owner=1;g.time=75;
 observeCampaignReport(report,g,'2026-10-29T19:01:15.000Z');
 assert.equal(report.enemyBastionsTaken,1);
 assert.equal(report.neutralBastionsTaken,1);
 assert.equal(report.ownBastionsLost,1);
 assert.equal(report.bastions,8);
 assert.equal(report.seed,g.seed);
 assert.equal(report.seconds,75);
 observeCampaignReport(report,g,'2026-10-29T19:01:17.000Z');
 assert.equal(report.enemyBastionsTaken,1,'polling a settled frontier never double-counts');
 g.status='victory';observeCampaignReport(report,g);
 assert.equal(report.result,'victory');
 assert.ok(report.endedAt);
 assert.deepEqual(summarizeCampaignArchive([report]),{matches:1,victories:1,defeats:0,enemyCaptures:1,neutralCaptures:1,lostBastions:1});
});
test('history: failed and abandoned games do not inflate victory totals',()=>{
 const g=game(),lost=newCampaignReport(g),aborted=newCampaignReport(g);
 finishCampaignReport(lost,'defeat');finishCampaignReport(aborted,'abandoned');
 assert.deepEqual(summarizeCampaignArchive([lost,aborted]),{matches:1,victories:0,defeats:1,enemyCaptures:0,neutralCaptures:0,lostBastions:0});
 assert.ok(validCampaignReport(lost));
 assert.equal(validCampaignReport({...lost,owners:[0]}),false);
 assert.equal(validCampaignReport({...lost,enemyBastionsTaken:-1}),false);
});
test('history: browser archive upserts, limits length and survives a page refresh',()=>{
 const before=globalThis.localStorage,items=new Map();
 globalThis.localStorage={getItem:key=>items.get(key)??null,setItem:(key,value)=>items.set(key,value)};
 try{
  const g=game(),first=newCampaignReport(g);
  writeCampaignReport(first);
  first.enemyBastionsTaken=2;writeCampaignReport(first);
  assert.equal(readCampaignReports().length,1);
  assert.equal(readCampaignReports()[0].enemyBastionsTaken,2);
  for(let i=0;i<50;i++){const r=newCampaignReport(g);r.id='round-'+i;writeCampaignReport(r);}
  assert.equal(readCampaignReports().length,40);
 }finally{if(before===undefined)delete globalThis.localStorage;else globalThis.localStorage=before;}
});
test('weather: full sandstorm still paints moving dust when optional combat particles are disabled',()=>{
 const original=globalThis.document;
 let streaks=0,fills=0,images=0;
 const ctx={save(){},restore(){},drawImage(){images++;},fillRect(){fills++;},
  beginPath(){},moveTo(){},lineTo(){},stroke(){streaks++;},
  createLinearGradient(){return {addColorStop(){}}}};
 globalThis.document={createElement(){return {width:0,height:0,getContext(){return ctx}}}};
 try{
  const r={game:{weather:{intensity:1},time:240,seed:72,canSee(){return true}},
   width:900,height:550,context:ctx,units:{particles:{enabled:false}},world:p=>p};
  new WeatherPresentation().draw(r,false);
  assert.ok(images>0&&fills>0&&streaks>=40);
  streaks=0;
  new WeatherPresentation().draw(r,true);
  assert.equal(streaks,0,'reduced motion keeps visible static haze, not moving streaks');
 }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});
test('palm: enlarged high-resolution artwork is scaled at draw time',()=>{
 assert.ok(PALM_ART_SCALE>=1.3&&PALM_ART_SCALE<1.6);
});
