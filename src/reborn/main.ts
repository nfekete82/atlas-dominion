import {roleBadgeMarkup} from './role-visuals.js';
import {getVeterancyLevel,sanitizeXp,VETERANCY_NAMES,VETERANCY_THRESHOLDS,veterancyBonuses} from './veterancy.js';
import { profiler, PerformanceRecorder, setProfiler, mountPerformancePanel } from './performance.js';
import { QwenGeneral } from './qwen-general.js';
import { RULES, mapLayout, campaignLayout, CAMPAIGN_SIZES, type MapVersion, type CampaignSize } from './config.js';
import { Simulation, type Base } from './simulation.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { saveCampaign, loadCampaign,readAiLearningPreference,storeAiLearningPreference,loadAiLearningProfile,saveAiLearningProfile } from './storage.js';
import {finishExperience} from './battle-learning.js';
import {newCampaignReport,observeCampaignReport,finishCampaignReport,readCampaignReports,writeCampaignReport,summarizeCampaignArchive,campaignStatisticsRecords,factionInReport,mostDeployed,type CampaignReport} from './campaign-history.js';
import { Soundscape } from './audio.js';
import { BUILDINGS, UNITS, unitKinds, buildingSpec, unitSpec, type UnitKind, type BuildingKind } from './catalog.js';
import { icon } from './icons.js';
import {transportCapacity} from './transports.js';

const elements=new Map<string,HTMLElement>();
const el=<T extends HTMLElement=HTMLElement>(id:string):T=>{let node=elements.get(id);if(!node){node=document.getElementById(id)!;if(node)elements.set(id,node);}return node as T;};
function text(node:Element,value:string):void{if(node.textContent!==value)node.textContent=value;}
function setText(id:string,value:string):void{text(el(id),value);}
function setHtml(id:string,value:string):void{const node=el(id);if(node.innerHTML!==value)node.innerHTML=value;}
for(const span of document.querySelectorAll<HTMLElement>('[data-icon]'))span.innerHTML=icon(span.dataset.icon!);
const query=new URLSearchParams(location.search);
if(query.has('debug')&&query.has('perf')){const recorder=new PerformanceRecorder();setProfiler(recorder);if(!query.has('perfTest'))mountPerformancePanel(recorder);}
// Explicit legacy fixture for regression checks; normal launches always roll a new seed.
let selectedMapVersion:MapVersion=query.has('debug')?2:CAMPAIGN_SIZES.medium;
const requestedSize=query.get('map');
if(requestedSize&&Object.hasOwn(CAMPAIGN_SIZES,requestedSize))selectedMapVersion=CAMPAIGN_SIZES[requestedSize as CampaignSize];
el<HTMLSelectElement>('map-size').value=selectedMapVersion===11?'small':selectedMapVersion===13?'large':selectedMapVersion===14?'extraLarge':'medium';
const createCampaign=()=>{
 const campaign=query.has('debug')&&query.has('legacy')?new Simulation():Simulation.campaign(query.has('debug')&&query.has('seed')?Number(query.get('seed'))>>>0:undefined,selectedMapVersion);
 if(!query.has('debug')&&readAiLearningPreference()){
  const profile=loadAiLearningProfile();
  if(profile)campaign.tactical.state.experience=profile;
 }
 return campaign;
};
el<HTMLInputElement>('carry-ai-learning').checked=readAiLearningPreference();
el<HTMLInputElement>('carry-ai-learning').onchange=()=>storeAiLearningPreference(el<HTMLInputElement>('carry-ai-learning').checked);
let game=createCampaign();
const qwenGeneral=new QwenGeneral();
if(query.has('debug')&&query.has('perfTest'))game.paused=true;
const renderer=new Renderer(el<HTMLCanvasElement>('world'),el<HTMLCanvasElement>('minimap'),game),input=new Input(renderer),audio=new Soundscape();
let accumulator=0,last=performance.now(),uiClock=0,resultShown=false,busy=false,ready=false,hasEnteredCampaign=query.has('debug'),selectionSound='',catalogTab='units';
const messages:{time:string;message:string}[]=[];
let lastAttackGame:Simulation|null=null,lastAttackSequence=0;
let campaignReport:CampaignReport|null=hasEnteredCampaign&&!query.has('debug')?newCampaignReport(game):null;
let historyPersistAt=-10;
let archiveOwner:0|1=0;
/** Game history is presentation-only and cannot affect AI, map generation or combat. */
function syncCampaignHistory(force=false):void{
 if(!campaignReport||query.has('debug'))return;
 observeCampaignReport(campaignReport,game);
 if(force||game.time-historyPersistAt>=8||campaignReport.result!=='running'){
  writeCampaignReport(campaignReport);historyPersistAt=game.time;
 }
}
function retireCampaignHistory():void{
 if(!campaignReport)return;
 syncCampaignHistory(true);
 if(campaignReport.result==='running'){
  finishCampaignReport(campaignReport,'abandoned');
  writeCampaignReport(campaignReport);
 }
}
function renderCampaignHistory():void{
 syncCampaignHistory(true);
 const reports=readCampaignReports(),summary=summarizeCampaignArchive(reports),records=campaignStatisticsRecords(reports,archiveOwner);
 const summaryNode=el('history-summary'),listNode=el('history-list'),recordNode=el('history-records');
 summaryNode.replaceChildren();listNode.replaceChildren();recordNode.replaceChildren();
 el('history-player').setAttribute('aria-pressed',String(archiveOwner===0));
 el('history-ai').setAttribute('aria-pressed',String(archiveOwner===1));
 const stats:[string,number][]= [
  ['Kampagnen abgeschlossen',summary.matches],['Kampagnen gewonnen',summary.victories],
  ['Bastionsduelle gewonnen',summary.enemyCaptures],['Bastionen verloren',summary.lostBastions]
 ];
 for(const [label,value] of stats){
  const item=document.createElement('div'),number=document.createElement('strong'),name=document.createElement('span');
  number.textContent=value.toLocaleString('de-DE');name.textContent=label;item.append(number,name);summaryNode.append(item);
 }
 const statNumber=(n:number)=>Math.floor(n).toLocaleString('de-DE');
 const recordCards:[string,string,string][]=[
  ['Meist eingesetzte Einheit',records.topKind?UNITS[records.topKind.kind].name:'—',records.topKind?`${statNumber(records.topKind.count)} Einsätze (erzeugte Einheiten)`:'Noch keine Daten'],
  ['Credits insgesamt verdient',records.bestCredits?statNumber(records.earnedTotal):'—',records.bestCredits?'Summe aller erfassten Partien':'Noch keine Daten'],
  ['Höchste Credits pro Partie',records.bestCredits?statNumber(records.bestCredits.value):'—',records.bestCredits?`${records.bestCredits.report.bastions} Bastionen · ${new Date(records.bestCredits.report.startedAt).toLocaleDateString('de-DE')}`:'Noch keine Daten'],
  ['Größte Armee gleichzeitig',records.bestArmy?statNumber(records.bestArmy.value):'—',records.bestArmy?`${records.bestArmy.report.bastions} Bastionen · ${new Date(records.bestArmy.report.startedAt).toLocaleDateString('de-DE')}`:'Noch keine Daten'],
  ['Einheiten insgesamt produziert',records.bestProduction?statNumber(records.producedTotal):'—',records.bestProduction?'Tatsächlich fertiggestellt, ohne Starttruppen':'Noch keine Daten'],
  ['Meiste Einheiten pro Partie',records.bestProduction?statNumber(records.bestProduction.value):'—',records.bestProduction?`${records.bestProduction.report.bastions} Bastionen · ${new Date(records.bestProduction.report.startedAt).toLocaleDateString('de-DE')}`:'Noch keine Daten'],
  ['Höchste Einnahme / 10 Sek.',records.bestIncome?statNumber(records.bestIncome.value):'—',records.bestIncome?`${records.bestIncome.report.bastions} Bastionen · ${new Date(records.bestIncome.report.startedAt).toLocaleDateString('de-DE')}`:'Noch keine Daten']
 ];
 for(const [label,value,detail] of recordCards){
  const card=document.createElement('div'),heading=document.createElement('span'),number=document.createElement('strong'),sub=document.createElement('small');
  heading.textContent=label;number.textContent=value;sub.textContent=detail;card.append(heading,number,sub);recordNode.append(card);
 }
 if(!reports.length){
  const empty=document.createElement('p');
  empty.textContent='Noch keine Berichte vorhanden. Starte eine Kampagne – ab jetzt werden deine Ergebnisse lokal erfasst.';
  listNode.append(empty);
 }else{
  const table=document.createElement('table'),thead=document.createElement('thead'),tbody=document.createElement('tbody'),head=document.createElement('tr');
  for(const h of ['Datum','Karte','Ergebnis','Spielzeit','Bastionsduelle','Neutral','Verloren','Top-Einheit','Credits verdient','Truppen-Max.','Produziert','Einnahmen-Max.']){
   const th=document.createElement('th');th.scope='col';th.textContent=h;head.append(th);
  }
  thead.append(head);
  for(const report of reports){
   const row=document.createElement('tr');
   const faction=factionInReport(report,archiveOwner),top=faction?mostDeployed(faction):null;
   const metric=(n:number|undefined)=>n===undefined?'—':n.toLocaleString('de-DE')+(report.stats?.partial?' *':'');
   const values=[
    new Date(report.startedAt).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'}),
    `${report.bastions} Bastionen · Karte #${report.seed}`,
    ({victory:'Sieg',defeat:'Niederlage',running:'Läuft',abandoned:'Abgebrochen'} as const)[report.result],
    `${Math.floor(report.seconds/60)}:${Math.floor(report.seconds%60).toString().padStart(2,'0')}`,
    String(report.enemyBastionsTaken),String(report.neutralBastionsTaken),String(report.ownBastionsLost),
    top?`${UNITS[top.kind].name} (${top.count})`:'—',metric(faction?.earnedCredits),metric(faction?.peakArmy),metric(faction?.producedUnits),metric(faction?.peakIncome)
   ];
   for(const value of values){const td=document.createElement('td');td.textContent=value;row.append(td);}
   tbody.append(row);
  }
  table.append(thead,tbody);listNode.append(table);
  const note=document.createElement('p');note.className='history-legend';note.textContent='Top-Einheit = am häufigsten erzeugte Einheit, einschließlich Starttruppen. Credits = tatsächlich ausgezahlte Einnahmen. * = Teilaufzeichnung aus älterem Spielstand; — = noch keine Daten.';listNode.append(note);
 }
}
function showCampaignHistory():void{renderCampaignHistory();modal('campaign-history-dialog');}
try{const s=JSON.parse(localStorage.getItem('atlas-reborn-sound')??'null');if(s){audio.setEnabled(s.enabled!==false);audio.setVolume(Number.isFinite(s.volume)?s.volume:.6);audio.ambience=s.ambience!==false;audio.radio.setEnabled(s.speech!==false);audio.radio.setVolume(Number.isFinite(s.speechVolume)?s.speechVolume:.85);audio.radio.setStyle(s.radioStyle==='original'?'original':'military');}}catch{/* Optional local preferences. */}
const timestamp=()=>`${Math.floor(game.time/60).toString().padStart(2,'0')}:${Math.floor(game.time%60).toString().padStart(2,'0')}`;
function notify(message:string,urgent=false):void{
 const item=document.createElement('div');item.className=urgent?'notice notice--attack':/^(Gebäude fertiggestellt:|Einheit bereit:)/.test(message)?'notice notice--ready':'notice';item.textContent=message;el('notices').append(item);while(el('notices').children.length>3)el('notices').firstElementChild?.remove();setTimeout(()=>item.remove(),6000);
 messages.unshift({time:timestamp(),message});if(messages.length>60)messages.pop();el('unread').hidden=false;
}
input.notify=notify;
function showTacticalPause(visible:boolean):void{el('pause-label').hidden=!visible;el('app').inert=visible;document.body.classList.toggle('tactical-paused',visible);}
function setPause(paused:boolean):void{game.paused=paused;if(paused)audio.pause();accumulator=0;showTacticalPause(paused&&game.status==='playing'&&!document.querySelector('dialog[open]'));setText('pause',paused?'▶':'Ⅱ');el('pause').setAttribute('aria-label',paused?'Fortsetzen':'Pause');setText('simulation-status',paused?'PAUSIERT':'LIVE SIMULATION');}
function closeDialogs():void{for(const d of document.querySelectorAll<HTMLDialogElement>('dialog[open]'))d.close('switch');}
function modal(id:string):void{
 const d=el<HTMLDialogElement>(id);if(d.open)return;if(id==='main-dialog')el<HTMLButtonElement>('main-continue').hidden=!hasEnteredCampaign;const wasPaused=game.paused;setPause(true);d.returnValue='';d.showModal();
 showTacticalPause(false);d.addEventListener('close',()=>{if(d.returnValue==='resume')setPause(false);else if(!['switch','new'].includes(d.returnValue))setPause(wasPaused);},{once:true});
}
function openMenu():void{modal('pause-dialog');}
function contextBase():Base|undefined{return game.bases.find(b=>b.id===renderer.selectedBase&&b.owner===0&&b.hp>0);}
function productionBase():Base|undefined{
 const selected=contextBase(),produces=(b:Base)=>unitKinds.some(k=>UNITS[k].producers.includes(b.kind));
 // A selected site keeps its own progress, and a non-producer must not show HQ units.
 if(selected)return produces(selected)?selected:undefined;
 return game.bases.find(b=>b.owner===0&&b.hp>0&&b.buildRemaining<=0&&b.queue.length>0&&produces(b))??game.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0&&b.buildRemaining<=0)??game.bases.find(b=>b.owner===0&&b.hp>0&&b.buildRemaining<=0&&produces(b));
}
function tab(next:string):void{catalogTab=next;for(const name of ['units','territories']){el('catalog-'+name).hidden=name!==next;el('tab-'+name).setAttribute('aria-pressed',String(name===next));}setText('catalog-detail',next==='territories'?'Sektor wählen, um die Kamera zu seiner Bastion zu bewegen.':'Pioniere errichten Produktionsgebäude. Fertige Gebäude schalten ihre Einheiten frei.');refresh();}
function train(kind:UnitKind,contextOnly=false,requestedProducer?:Base):void{
 const selected=contextBase(),producer=requestedProducer??(contextOnly?selected:selected&&UNITS[kind].producers.includes(selected.kind)&&selected.buildRemaining<=0&&selected.queue.length<8?selected:game.producer(0,kind));
 if(producer&&game.recruit(producer.id,kind)){audio.command();refresh();}else notify(producer?'Produktion derzeit nicht möglich.':`${UNITS[kind].producers.map(k=>BUILDINGS[k].name).join(' oder ')} erforderlich.`);
}
function prepareCatalog():void{
 for(const building of ['headquarters','barracks','factory','airfield'] as const){
  const category=document.createElement('section');category.dataset.productionBuilding=building;
  const heading=document.createElement('h2');heading.textContent=(building==='headquarters'?'Hauptquartier':BUILDINGS[building].name).toLocaleUpperCase('de-DE');category.append(heading);
  const grid=document.createElement('div');grid.className='catalog-grid';category.append(grid);el('catalog-units').append(category);
  for(const kind of unitKinds.filter(k=>UNITS[k].producers.includes(building))){
   const spec=UNITS[kind],button=document.createElement('button');button.className='catalog-card';button.dataset.unit=kind;button.setAttribute('aria-label',`${spec.name} ausbilden · ${spec.cost} Credits`);
   button.innerHTML=`<img src="${renderer.icon('unit',kind)}" alt=""/>${roleBadgeMarkup(kind)}<span class="card-meta" aria-hidden="true"><span class="card-name"></span><span class="card-cost">${spec.cost.toLocaleString('de-DE')}</span></span>`;button.querySelector<HTMLElement>('.card-name')!.textContent=spec.name;button.title=spec.name;
   button.onclick=()=>train(kind);button.onpointerenter=()=>{setText('catalog-detail',`${spec.name} · ${spec.buildTime} S — ${spec.description}`);};grid.append(button);
  }
 }
 prepareTerritories();
 for(let i=0;i<8;i++){const button=document.createElement('button');button.onclick=()=>{const b=productionBase();if(b&&i<b.queue.length){game.cancel(b.id,i);refresh();}else tab('units');};el('queue-slots').append(button);}
}
function prepareTerritories():void{el('catalog-territories').replaceChildren();
 for(const t of game.territories){const button=document.createElement('button');button.className='territory-row';button.dataset.territory=String(t.id);button.innerHTML='<i></i><strong></strong><small></small>';button.onclick=()=>{renderer.camera.x=game.territories[t.id].point.x;renderer.camera.y=game.territories[t.id].point.y;renderer.boundCamera();};el('catalog-territories').append(button);}
}
function reset():void{
 if(!query.has('debug')&&readAiLearningPreference())saveAiLearningProfile(game.tactical.state.experience);
 retireCampaignHistory();
 hasEnteredCampaign=true;closeDialogs();game=createCampaign();
 campaignReport=query.has('debug')?null:newCampaignReport(game);historyPersistAt=-10;syncCampaignHistory(true);qwenGeneral.resetCampaign();audio.bindGame(game);renderer.game=game;renderer.invalidate();renderer.selected.clear();renderer.selectedBase=null;renderer.attackMode=false;renderer.placement=null;renderer.commandMode=null;renderer.canvas.classList.remove('attack','building');renderer.home();prepareTerritories();accumulator=0;resultShown=false;messages.length=0;setPause(false);tab('units');refresh();notify('Neue Kampagne. Wähle deinen Pionier und errichte zuerst eine Kaserne.');}
function refresh():void{
 if(!profiler)return refreshMeasured();const at=performance.now();try{refreshMeasured();}finally{profiler.record('hud',performance.now()-at);}
}
function refreshMeasured():void{
 if(!ready)return;
 if(campaignReport)syncCampaignHistory();
 const selected=game.units.filter(u=>renderer.selected.has(u.id)&&u.owner===0&&!u.carrier);renderer.selected=new Set(selected.map(u=>u.id));
 if(!game.bases.some(b=>b.id===renderer.selectedBase&&b.hp>0&&b.owner===0))renderer.selectedBase=null;
 const base=contextBase(),production=productionBase(),first=selected[0],spec=first?unitSpec(first):undefined;
 el('selection-panel').hidden=!selected.length&&!base;
 setText('production-title',production?`${buildingSpec(production).name} · PRODUKTION`:'PRODUKTION');
 setText('campaign-goal',`Erkunde Aridis. Sichere alle ${campaignLayout(game.world.mapVersion,game.seed).starts[1].length} roten Startgebiete und erobere das feindliche Hauptquartier, um zu gewinnen. Zerstöre es zuerst und sichere anschließend seinen Kontrollpunkt.`);
 setText('credits',Math.floor(game.credits[0]).toLocaleString('de-DE'));setText('income',`+${game.income(0)}`);setHtml('capacity',`${game.count(0)} <em>/ ${RULES.capacity}</em>`);
 setText('territories',`${game.territories.filter(t=>t.owner===0).length} / ${game.territories.length}`);setText('clock',timestamp());setText('exploration',`${Math.round(game.explored[0].reduce((n,v)=>n+v,0)/game.explored[0].length*100)} % ERKUNDET`);
 const title=selected.length?(selected.length===1?spec!.name:`${selected.length} Einheiten`):base?(base.kind==='headquarters'?'Hauptquartier':buildingSpec(base).name):'';
 setText('selection-title',title+(selected.length===1&&getVeterancyLevel(first.xp)>0?' · '+VETERANCY_NAMES[getVeterancyLevel(first.xp)]:''));setText('selection-tag',`BLAUE LEGION${spec?' / '+spec.group.toLocaleUpperCase('de-DE'):''}`);
 const img=el('portrait').querySelector('img')!,desired=first?renderer.icon('unit',first.kind):renderer.icon('building',base?.kind??'headquarters');if(img.getAttribute('src')!==desired)img.src=desired;
 const portrait=el('portrait'),role=first?.kind??'';if(portrait.dataset.role!==role){portrait.dataset.role=role;portrait.querySelector('.role-badge')?.remove();if(first)portrait.insertAdjacentHTML('beforeend',roleBadgeMarkup(first.kind));}
 const experience=el('veterancy');experience.hidden=selected.length!==1;
 if(selected.length===1){const xp=sanitizeXp(first.xp),level=getVeterancyLevel(xp),next=VETERANCY_THRESHOLDS[level+1],floor=VETERANCY_THRESHOLDS[level];setText('veterancy-xp',level===3?`HELD · MAXIMALER RANG · ${Math.floor(xp)} XP`:`${Math.floor(xp)} XP · ${Math.ceil(next-xp)} XP bis ${VETERANCY_NAMES[level+1]}`);el('veterancy-fill').style.width=`${level===3?100:(xp-floor)/(next-floor)*100}%`;setText('veterancy-bonuses',veterancyBonuses(first));}
 const weather=el('weather-status'),phase=game.weather.phase;weather.hidden=phase==='CLEAR';const remaining=Math.ceil(game.weather.remaining);setText('weather-status',`${phase==='WARNING'?'STURMWARNUNG':phase==='SANDSTORM'?'SANDSTURM':'SICHT KLART AUF'} · ${Math.floor(remaining/60).toString().padStart(2,'0')}:${(remaining%60).toString().padStart(2,'0')}`);weather.dataset.phase=phase;
 const hp=selected.length?selected.reduce((n,u)=>n+u.hp,0):base?.hp??0,max=selected.length?selected.reduce((n,u)=>n+unitSpec(u).hp,0):base?buildingSpec(base).hp:1;
 el('health-fill').style.width=`${Math.max(0,hp/max*100)}%`;setText('selection-health',`${Math.round(hp)} / ${max}${spec?' · '+Math.round(game.sight(first!))+' M SICHT':''}`);
 let detail=selected.length?(renderer.attackMode?'Angriffsziel mit Linksklick wählen.':selected.length>1?unitKinds.filter(k=>selected.some(u=>u.kind===k)).map(k=>`${selected.filter(u=>u.kind===k).length} × ${UNITS[k].name}`).join(' · '):spec!.description):base?(base.buildRemaining>0?`${base.constructionActive?'Bau aktiv':'Bau pausiert — Pionier erforderlich'}. ${Math.round((1-base.buildRemaining/buildingSpec(base).buildTime)*100)} % · noch ${Math.ceil(base.buildRemaining)} S. Rechtsklick mit Pionier setzt fort.`:buildingSpec(base).description):'Wähle eine Einheit.';
 el('unit-commands').hidden=selected.length===0;el('attack').setAttribute('aria-pressed',String(renderer.attackMode));el('overlay').setAttribute('aria-pressed',String(renderer.overlay));
 const medics=selected.some(u=>u.kind==='medic'),workers=selected.some(u=>u.kind==='engineer');
 el('support-commands').hidden=!selected.length;el('heal-mode').hidden=!medics;el('repair-mode').hidden=!workers;el('build-mode').hidden=!workers;
 if(!workers){renderer.placement=null;el('build-menu').hidden=true;renderer.canvas.classList.remove('building');}
 el<HTMLButtonElement>('rotate-building').hidden=!renderer.placement;
 el('load-mode').hidden=!selected.some(u=>transportCapacity(u.kind)>0);el('unload-mode').hidden=!selected.some(u=>transportCapacity(u.kind)>0);el<HTMLButtonElement>('unload-mode').disabled=!selected.some(u=>transportCapacity(u.kind)>0&&u.transport?.cargo.length);
 if(selected.length===1&&first&&transportCapacity(first.kind)>0)detail=`${first.transport?.cargo.length??0} / ${transportCapacity(first.kind)} Passagiere · ${spec!.description}`;

 const rover=selected.length===1&&first?.kind==='rover'?first:null;
 const passengerPanel=el('transport-passengers');
 passengerPanel.hidden=!rover;
 if(rover){
  const cargo=rover.transport?.cargo??[],slots=el('passenger-slots'),key=rover.id+':'+cargo.join(',');
  setText('passenger-count',`${cargo.length} / ${transportCapacity(rover.kind)}`);
  if(slots.dataset.key!==key){
   slots.dataset.key=key;slots.replaceChildren();
   for(let i=0;i<transportCapacity(rover.kind);i++){
    const passenger=game.units.find(u=>u.id===cargo[i]&&u.carrier===rover.id&&u.owner===rover.owner&&u.hp>0);
    const button=document.createElement('button');button.type='button';
    button.className='passenger-slot'+(passenger?' occupied':' empty');
    if(passenger){
     button.dataset.passengerId=String(passenger.id);
     button.title=`${UNITS[passenger.kind].name} · einzeln am Humvee ausladen`;
     button.setAttribute('aria-label',`${UNITS[passenger.kind].name} einzeln ausladen`);
     const image=document.createElement('img');image.src=renderer.icon('unit',passenger.kind);image.alt='';button.append(image);
     button.insertAdjacentHTML('beforeend',roleBadgeMarkup(passenger.kind));
     const carrierId=rover.id,passengerId=passenger.id;
     button.onclick=()=>{
      const carrier=game.units.find(u=>u.id===carrierId&&u.kind==='rover'&&u.owner===0&&u.hp>0);
      const rider=game.units.find(u=>u.id===passengerId&&u.carrier===carrierId&&u.hp>0);
      if(!carrier||!rider||!carrier.transport?.cargo.includes(passengerId))return;
      if(game.transports.unload(carrier.id,{x:carrier.x,y:carrier.y},passengerId)){
       notify(`${UNITS[rider.kind].name} steigt am Humvee aus.`);refresh();
      }else notify('Kein sicherer Ausladeort am Humvee.');
     };
    }else{button.disabled=true;button.textContent='+';button.title='Freier Sitzplatz';}
    slots.append(button);
   }
  }
  const unloading=rover.transport?.task==='unload'&&rover.transport.phase!=='cruise';
  for(const button of slots.querySelectorAll<HTMLButtonElement>('[data-passenger-id]'))button.disabled=unloading;
 }

 el('move-mode').hidden=!selected.length;el('rally-mode').hidden=!base||base.buildRemaining>0||!unitKinds.some(k=>UNITS[k].producers.includes(base.kind));
 const context=el('building-commands'),contextKey=base?`${base.id}:${base.buildRemaining>0}`:'';
 if(context.dataset.key!==contextKey){context.dataset.key=contextKey;context.replaceChildren();
  if(base&&base.buildRemaining<=0)for(const kind of unitKinds.filter(k=>UNITS[k].producers.includes(base.kind))){const button=document.createElement('button');button.dataset.contextUnit=kind;button.title=`${UNITS[kind].name} ausbilden · ${UNITS[kind].cost} Credits · ${UNITS[kind].buildTime} S`;button.setAttribute('aria-label',`${UNITS[kind].name} ausbilden`);button.innerHTML=`<img src="${renderer.icon('unit',kind)}" alt=""/>${roleBadgeMarkup(kind)}<span>${UNITS[kind].name}</span>`;button.onclick=()=>train(kind,true);context.append(button);}
  if(base){const cancel=document.createElement('button');cancel.id='context-cancel';cancel.textContent=base.buildRemaining>0?'Bau abbrechen · 75 % zurück':'Letzten Auftrag stornieren';cancel.onclick=()=>{const b=contextBase();if(!b)return;if(b.buildRemaining>0){game.cancelConstruction(b.id);renderer.selectedBase=null;}else game.cancel(b.id);refresh();};context.append(cancel);}
 }
 context.hidden=!base;
 for(const button of context.querySelectorAll<HTMLButtonElement>('[data-context-unit]')){const kind=button.dataset.contextUnit as UnitKind;button.disabled=!base||base.queue.length>=8||game.credits[0]<UNITS[kind].cost||game.count(0)+game.queued(0)>=RULES.capacity||game.status!=='playing';}
 const contextCancel=document.getElementById('context-cancel') as HTMLButtonElement|null;if(contextCancel)contextCancel.disabled=!!base&&base.buildRemaining<=0&&!base.queue.length;
 if(selected.length===1&&first?.supportPaused)detail='Heilziel ist zu weit voraus. Sanitäter wartet; der Heilauftrag bleibt erhalten.';
 if(renderer.placement)detail=`${BUILDINGS[renderer.placement].name}: ${renderer.placementFacing===1?'Gespiegelt':'Standardausrichtung'}. R / ↔ wechselt die Richtung · Linksklick baut · Esc bricht ab.`;
 setText('selection-detail',detail);
 setText('hint',renderer.attackMode?'ANGRIFFSBEWEGUNG: LINKSKLICK AUF DAS ZIEL':'ZIEHEN: AUSWAHL · RECHTSKLICK: BEWEGEN · SHIFT: BEFEHLSKETTE');
 if(production){
  const building=production.buildRemaining>0,duration=production.queue[0]??5,ratio=building?1-production.buildRemaining/buildingSpec(production).buildTime:production.production/duration;
  el('production-fill').style.width=`${ratio*100}%`;setText('production-time',building?`BAU ${Math.ceil(production.buildRemaining).toString().padStart(2,'0')} S`:production.queue.length?`00:${Math.ceil(duration-production.production).toString().padStart(2,'0')}`:'00:00');
  setText('queue',building?'BAUSTELLE AKTIV':production.queue.length?`${production.queue.length} IM AUFTRAG · ${Math.max(0,duration-production.production).toFixed(1)} S`:'WARTESCHLANGE LEER');
  el<HTMLButtonElement>('cancel').disabled=!building&&!production.queue.length;
 }else{setText('queue','KEINE PRODUKTIONSSTÄTTE');el('production-fill').style.width='0';setText('production-time','00:00');el<HTMLButtonElement>('cancel').disabled=true;}
 for(const [i,button] of [...el('queue-slots').children].entries()){
  const kind=production?.queueTypes[i],key=kind??'empty';if((button as HTMLElement).dataset.kind!==key){(button as HTMLElement).dataset.kind=key;button.innerHTML=kind?`<img src="${renderer.icon('unit',kind)}" alt=""/>${roleBadgeMarkup(kind)}<span class="queue-index">${i+1}</span>`:'+';}
  button.classList.toggle('empty',!kind);button.classList.toggle('current',!!kind&&i===0);(button as HTMLElement).title=kind?`${UNITS[kind].name} · Auftrag stornieren`:'Einheit hinzufügen';
 }
 const facilities=new Set(game.bases.filter(b=>b.owner===0&&b.hp>0&&b.buildRemaining<=0).map(b=>b.kind));
 for(const category of document.querySelectorAll<HTMLElement>('[data-production-building]'))category.hidden=!facilities.has(category.dataset.productionBuilding as BuildingKind);
 const quickKind=production&&production.buildRemaining<=0?unitKinds.find(k=>UNITS[k].producers.includes(production.kind)):undefined,quick=el<HTMLButtonElement>('recruit');
 quick.hidden=!quickKind;
 if(quickKind){const quickSpec=UNITS[quickKind];quick.disabled=production!.queue.length>=8||game.credits[0]<quickSpec.cost||game.count(0)+game.queued(0)>=RULES.capacity||game.status!=='playing';
  quick.title=`${quickSpec.name} ausbilden · ${quickSpec.cost} Credits`;quick.setAttribute('aria-label',`${quickSpec.name} ausbilden`);
  if(quick.dataset.kind!==quickKind){quick.dataset.kind=quickKind;quick.innerHTML=`<img src="${renderer.icon('unit',quickKind)}" alt=""/>${roleBadgeMarkup(quickKind)}`;}
 }
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-build]')){
  const kind=button.dataset.build as BuildingKind;
  const existing=['barracks','factory','airfield'].includes(kind)&&game.bases.some(b=>b.owner===0&&b.hp>0&&b.kind===kind);
  button.disabled=existing;button.title=existing?'Bereits vorhanden: maximal ein Gebäude dieses Typs.':'';
 }
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-unit]')){
  const kind=button.dataset.unit as UnitKind,producer=game.producer(0,kind);button.hidden=!UNITS[kind].producers.some(k=>facilities.has(k));button.disabled=!producer||game.credits[0]<UNITS[kind].cost||game.count(0)+game.queued(0)>=RULES.capacity||game.status!=='playing';button.classList.toggle('locked',!producer);button.title=`${UNITS[kind].name} · ${UNITS[kind].cost} Credits · ${UNITS[kind].buildTime} S${producer?'':' · '+UNITS[kind].producers.map(k=>BUILDINGS[k].name).join(' / ')+' erforderlich'}`;
 }
 if(catalogTab==='territories')for(const button of document.querySelectorAll<HTMLButtonElement>('[data-territory]')){const t=game.territories[Number(button.dataset.territory)],known=game.hasExplored(0,t.point)||t.owner===0;button.className=`territory-row ${known?t.owner===0?'blue':t.owner===1?'red':'neutral':'unknown'}`;text(button.querySelector('strong')!,known?t.name:`Unbekannter Sektor ${t.id+1}`);text(button.querySelector('small')!,known?`+${t.income}`:'—');}
 for(const message of game.notices.splice(0)){
  notify(message);
  if(!game.paused&&game.status==='playing'){
   if(message.startsWith('Gebäude fertiggestellt:'))audio.announceReady('building');
   else if(message.startsWith('Einheit bereit:'))audio.announceReady('unit');
  }
 }
 if(game.status!=='playing'&&!resultShown){
   if(game.tactical.state.experience?.active){
    finishExperience(game.tactical.state.experience,game.status==='defeat',
      game.units.filter(u=>u.owner===1&&u.hp>0).reduce((n,u)=>n+u.hp,0));
   }
   if(!query.has('debug')&&readAiLearningPreference())saveAiLearningProfile(game.tactical.state.experience);
   resultShown=true;closeDialogs();setPause(true);setText('result-title',game.status==='victory'?'Aridis gesichert.':'Die Legion ist gefallen.');setText('result-copy',game.status==='victory'?`Das feindliche Hauptquartier und seine ${mapLayout(game.world.mapVersion).starts[1].length} Startgebiete sind unter deiner Kontrolle.`:'Deine Produktionsstätten und Truppen wurden vernichtet.');el<HTMLDialogElement>('result-dialog').showModal();}
}
async function save():Promise<void>{if(busy)return;busy=true;try{syncCampaignHistory(true);await saveCampaign(game);if(!query.has('debug')&&readAiLearningPreference())saveAiLearningProfile(game.tactical.state.experience);notify('Kampagne lokal gespeichert.');}catch(e){notify((e as Error).message);}finally{busy=false;}}
async function load():Promise<void>{if(busy)return;busy=true;try{const loaded=await loadCampaign();retireCampaignHistory();hasEnteredCampaign=true;closeDialogs();game=loaded;
  campaignReport=query.has('debug')?null:readCampaignReports().find(r=>r.seed===(game.seed>>>0)&&r.mapVersion===game.world.mapVersion&&r.result==='running'&&r.seconds<=game.time+.01)??newCampaignReport(game);
  historyPersistAt=-10;syncCampaignHistory(true);qwenGeneral.resetCampaign();audio.bindGame(game);renderer.game=game;renderer.invalidate();renderer.selected.clear();renderer.selectedBase=null;renderer.attackMode=false;renderer.placement=null;renderer.commandMode=null;renderer.canvas.classList.remove('attack','building');renderer.home();prepareTerritories();resultShown=false;accumulator=0;setPause(false);refresh();notify('Kampagne geladen.');}catch(e){notify((e as Error).message);}finally{busy=false;}}
el('resume-tactical').onclick=()=>setPause(false);
input.onPause=()=>setPause(!game.paused);input.onMenu=openMenu;input.onHelp=()=>modal('help-dialog');input.onSave=()=>void save();input.onLoad=()=>void load();
input.onSelection=()=>{const next=[...renderer.selected].join(',')+':'+renderer.selectedBase;if(next!==selectionSound){selectionSound=next;audio.select();}refresh();};input.onOrder=order=>audio.acknowledge(order,game);
el('main-history').onclick=showCampaignHistory;
 el('history-player').onclick=()=>{archiveOwner=0;renderCampaignHistory();};
 el('history-ai').onclick=()=>{archiveOwner=1;renderCampaignHistory();};el('history-close').onclick=()=>el<HTMLDialogElement>('campaign-history-dialog').close();
 el('save').onclick=()=>void save();el('load').onclick=()=>void load();el('main-load').onclick=()=>void load();el('pause').onclick=input.onPause;el('menu').onclick=openMenu;el('help').onclick=input.onHelp;
el('to-main').onclick=()=>{closeDialogs();modal('main-dialog');};el('main-continue').onclick=()=>{if(!hasEnteredCampaign)return;closeDialogs();setPause(false);};el<HTMLDialogElement>('main-dialog').addEventListener('cancel',event=>event.preventDefault());el('new').onclick=()=>modal('new-dialog');el<HTMLDialogElement>('new-dialog').addEventListener('close',()=>{
 if(el<HTMLDialogElement>('new-dialog').returnValue==='new'){
  const size=el<HTMLSelectElement>('map-size').value as CampaignSize;
  selectedMapVersion=CAMPAIGN_SIZES[size]??CAMPAIGN_SIZES.medium;
  storeAiLearningPreference(el<HTMLInputElement>('carry-ai-learning').checked);
  reset();
 }
});
el('result-new').onclick=()=>{closeDialogs();modal('new-dialog');};el('result-close').onclick=()=>el<HTMLDialogElement>('result-dialog').close();
el('command-home').onclick=()=>renderer.home();el('overlay').onclick=()=>{renderer.overlay=!renderer.overlay;refresh();};
el('select-unit').onclick=()=>{renderer.selectedBase=null;const u=game.units.find(u=>u.owner===0&&!u.carrier);renderer.selected=new Set(u?[u.id]:[]);if(u){renderer.camera.x=u.x;renderer.camera.y=u.y;renderer.boundCamera();}refresh();};
el('select-base').onclick=()=>{renderer.selected.clear();renderer.selectedBase=game.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0)?.id??null;renderer.home();refresh();};
el('hold').onclick=()=>{input.stop(true);refresh();};
el('heal-mode').onclick=()=>{renderer.commandMode='heal';renderer.attackMode=false;renderer.canvas.classList.remove('attack');notify('Verletzte eigene Infanterie mit Linksklick wählen.');};
el('load-mode').onclick=()=>{renderer.commandMode='load';renderer.attackMode=false;notify('Eigene Infanterie mit Linksklick als Abholgruppe wählen.');};
el('unload-mode').onclick=()=>{renderer.commandMode='unload';renderer.attackMode=false;notify('Linksklick auf den gewünschten Ausladeort.');};
el('repair-mode').onclick=()=>{renderer.commandMode='repair';renderer.attackMode=false;renderer.canvas.classList.remove('attack');notify('Eigenes beschädigtes Gebäude oder Baustelle mit Linksklick wählen.');};
el('close-build-menu').onclick=()=>{el('build-menu').hidden=true;};
el('build-mode').onclick=()=>{el('build-menu').hidden=!el('build-menu').hidden;};
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-build]'))button.onclick=()=>{renderer.placementFacing=0;renderer.placement=button.dataset.build as BuildingKind;renderer.commandMode=null;renderer.attackMode=false;renderer.canvas.classList.remove('attack');renderer.canvas.classList.add('building');el('build-menu').hidden=true;refresh();};
el('rotate-building').onclick=()=>{if(!renderer.placement)return;renderer.placementFacing=renderer.placementFacing===0?1:0;audio.select();refresh();};
el('stop').onclick=()=>{input.stop();refresh();};el('attack').onclick=()=>{renderer.attackMode=!renderer.attackMode;renderer.canvas.classList.toggle('attack',renderer.attackMode);refresh();};
el('move-mode').onclick=()=>{if(renderer.selected.size){renderer.attackMode=false;renderer.commandMode='move';renderer.canvas.classList.remove('attack');notify('Linksklick auf das Bewegungsziel.');}else notify('Zuerst eine Einheit auswählen.');};
el('rally-mode').onclick=()=>{const b=contextBase();if(b){renderer.selected.clear();renderer.selectedBase=b.id;notify('Rechtsklick auf den neuen Sammelpunkt.');refresh();}};
el('recruit').onclick=()=>{const b=productionBase(),kind=b?unitKinds.find(k=>UNITS[k].producers.includes(b.kind)):undefined;if(kind)train(kind,false,b);};el('cancel').onclick=()=>{const b=productionBase();if(b){if(b.buildRemaining>0){game.cancelConstruction(b.id);renderer.selectedBase=null;}else game.cancel(b.id);refresh();}};
el('cancel-action').onclick=()=>{if(renderer.placement||renderer.commandMode){renderer.placement=null;renderer.commandMode=null;renderer.canvas.classList.remove('building');}else{const b=contextBase();if(b&&b.buildRemaining>0){game.cancelConstruction(b.id);renderer.selectedBase=null;}else{renderer.selected.clear();renderer.selectedBase=null;renderer.attackMode=false;}}refresh();};
for(const name of ['units','territories'])el('tab-'+name).onclick=()=>tab(name);
try{renderer.units.particles.enabled=localStorage.getItem('atlas-reborn-particles')!=='false';}catch{/* Optional local setting. */}
el<HTMLInputElement>('particles-enabled').checked=renderer.units.particles.enabled;
el('particles-enabled').onchange=()=>{renderer.units.particles.enabled=el<HTMLInputElement>('particles-enabled').checked;renderer.units.particles.clear();try{localStorage.setItem('atlas-reborn-particles',String(renderer.units.particles.enabled));}catch{/* Optional. */}};
const soundPreferences=()=>{audio.setEnabled(el<HTMLInputElement>('audio-enabled').checked);audio.setVolume(Number(el<HTMLInputElement>('audio-volume').value)/100);audio.ambience=el<HTMLInputElement>('audio-ambience').checked;audio.radio.setEnabled(el<HTMLInputElement>('audio-speech').checked);audio.radio.setVolume(Number(el<HTMLInputElement>('speech-volume').value)/100);audio.radio.setStyle(el<HTMLInputElement>('audio-radio-military').checked?'military':'original');setText('speech-level',`${Math.round(audio.radio.volume*100)} %`);setText('audio-level',`${Math.round(audio.volume*100)} %`);try{localStorage.setItem('atlas-reborn-sound',JSON.stringify({enabled:audio.enabled,volume:audio.volume,ambience:audio.ambience,speech:audio.radio.enabled,speechVolume:audio.radio.volume,radioStyle:audio.radio.style}));}catch{/* Optional. */}};
el<HTMLInputElement>('audio-enabled').checked=audio.enabled;el<HTMLInputElement>('audio-volume').value=String(Math.round(audio.volume*100));el<HTMLInputElement>('audio-ambience').checked=audio.ambience;setText('audio-level',`${Math.round(audio.volume*100)} %`);
el<HTMLInputElement>('audio-speech').checked=audio.radio.enabled;el<HTMLInputElement>('audio-radio-military').checked=audio.radio.style==='military';el<HTMLInputElement>('speech-volume').value=String(Math.round(audio.radio.volume*100));setText('speech-level',`${Math.round(audio.radio.volume*100)} %`);
for(const id of ['audio-enabled','audio-volume','audio-ambience','audio-speech','speech-volume','audio-radio-military'])el(id).addEventListener('input',soundPreferences);
const openAudio=()=>{modal('audio-panel');el('sound').setAttribute('aria-expanded','true');};el('sound').onclick=openAudio;el('options').onclick=openAudio;el<HTMLDialogElement>('audio-panel').addEventListener('close',()=>{audio.radio.stop();el('sound').setAttribute('aria-expanded','false');});el('audio-test').onclick=()=>{void audio.unlock().then(()=>audio.radio.ready).then(()=>audio.radio.request('move','infantry',true)).catch(()=>{});};
const qwenToggle=el<HTMLInputElement>('qwen-enabled');
qwenGeneral.onChange=()=>{qwenToggle.checked=qwenGeneral.enabled;setText('qwen-status',qwenGeneral.description());};
qwenToggle.onchange=()=>{if(qwenToggle.checked)qwenGeneral.enable();else qwenGeneral.disable();};
qwenGeneral.onChange();
el('messages').onclick=()=>{const history=el('message-history');history.replaceChildren();if(!messages.length){const p=document.createElement('p');p.textContent='Keine neuen Funkmeldungen.';history.append(p);}for(const item of messages){const p=document.createElement('p'),time=document.createElement('time');time.textContent=item.time;p.append(time,document.createTextNode(item.message));history.append(p);}el('unread').hidden=true;modal('message-dialog');};
window.addEventListener('pointerdown',()=>{void audio.unlock().catch(()=>{});},{capture:true});window.addEventListener('keydown',()=>{void audio.unlock().catch(()=>{});},{capture:true});window.addEventListener('resize',()=>renderer.resize());document.addEventListener('visibilitychange',()=>{last=performance.now();accumulator=0;if(document.hidden){audio.silenceScene();setPause(true);}});
function showIncomingAttacks():void{
 if(lastAttackGame!==game){lastAttackGame=game;lastAttackSequence=0;}
 const seq=game.attackAlerts.sequence;
 if(seq<=lastAttackSequence||game.paused||game.status!=='playing')return;
 lastAttackSequence=seq;
 notify('Captain, wir werden angegriffen!',true);
 audio.announceAttack();
}
function frame(now:number):void{profiler?.beginFrame(now);const dt=Math.min(.1,(now-last)/1000);last=now;const inputAt=profiler?performance.now():0;input.update(dt);if(profiler)profiler.record('input',performance.now()-inputAt);if(!game.paused){accumulator+=dt;let steps=0;while(accumulator>=RULES.tick&&steps++<5){game.step();accumulator-=RULES.tick;}}else accumulator=0;showIncomingAttacks();const audioAt=profiler?performance.now():0;audio.update(game,renderer);if(profiler)profiler.record('audio',performance.now()-audioAt);renderer.render(dt,accumulator/RULES.tick);uiClock+=dt;if(uiClock>.1){qwenGeneral.maybePlan(game);refresh();uiClock=0;}profiler?.endFrame(now);requestAnimationFrame(frame);}
void audio.radio.preload();
try{await renderer.load();prepareCatalog();ready=true;el('loading').remove();refresh();last=performance.now();requestAnimationFrame(frame);if(!query.has('debug'))modal('main-dialog');}catch(e){setHtml('loading','<strong>Der Wüstensektor konnte nicht geladen werden.</strong><p>Bitte neu laden und die lokalen Grafiken prüfen.</p>');console.error(e);}
if(new URLSearchParams(location.search).has('debug'))Object.assign(window,{__reborn:{get game(){return game;},renderer,input,refresh,audio,profiler,qwenGeneral,advance(seconds:number){for(let i=0;i<Math.round(seconds/RULES.tick);i++)game.step();refresh();renderer.render(0);},save,load}});
