import { profiler, PerformanceRecorder, setProfiler, mountPerformancePanel } from './performance.js';
import { QwenGeneral } from './qwen-general.js';
import { RULES, mapLayout, CAMPAIGN_SIZES, type MapVersion, type CampaignSize } from './config.js';
import { Simulation, type Base } from './simulation.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { saveCampaign, loadCampaign } from './storage.js';
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
let selectedMapVersion:MapVersion=query.has('debug')?2:4;
const requestedSize=query.get('map');
if(requestedSize&&Object.hasOwn(CAMPAIGN_SIZES,requestedSize))selectedMapVersion=CAMPAIGN_SIZES[requestedSize as CampaignSize];
el<HTMLSelectElement>('map-size').value=selectedMapVersion===3?'small':selectedMapVersion===5?'large':'medium';
const createCampaign=()=>query.has('debug')&&query.has('legacy')?new Simulation():Simulation.campaign(query.has('debug')&&query.has('seed')?Number(query.get('seed'))>>>0:undefined,selectedMapVersion);
let game=createCampaign();
const qwenGeneral=new QwenGeneral();
if(query.has('debug')&&query.has('perfTest'))game.paused=true;
const renderer=new Renderer(el<HTMLCanvasElement>('world'),el<HTMLCanvasElement>('minimap'),game),input=new Input(renderer),audio=new Soundscape();
let accumulator=0,last=performance.now(),uiClock=0,resultShown=false,busy=false,ready=false,selectionSound='',catalogTab='units';
const messages:{time:string;message:string}[]=[];
try{const s=JSON.parse(localStorage.getItem('atlas-reborn-sound')??'null');if(s){audio.setEnabled(s.enabled!==false);audio.setVolume(Number.isFinite(s.volume)?s.volume:.6);audio.ambience=s.ambience!==false;audio.radio.setEnabled(s.speech!==false);audio.radio.setVolume(Number.isFinite(s.speechVolume)?s.speechVolume:.85);}}catch{/* Optional local preferences. */}
const timestamp=()=>`${Math.floor(game.time/60).toString().padStart(2,'0')}:${Math.floor(game.time%60).toString().padStart(2,'0')}`;
function notify(message:string):void{
 const item=document.createElement('div');item.className='notice';item.textContent=message;el('notices').append(item);while(el('notices').children.length>3)el('notices').firstElementChild?.remove();setTimeout(()=>item.remove(),6000);
 messages.unshift({time:timestamp(),message});if(messages.length>60)messages.pop();el('unread').hidden=false;
}
input.notify=notify;
function showTacticalPause(visible:boolean):void{el('pause-label').hidden=!visible;el('app').inert=visible;document.body.classList.toggle('tactical-paused',visible);}
function setPause(paused:boolean):void{game.paused=paused;if(paused)audio.pause();accumulator=0;showTacticalPause(paused&&!document.querySelector('dialog[open]'));setText('pause',paused?'▶':'Ⅱ');el('pause').setAttribute('aria-label',paused?'Fortsetzen':'Pause');setText('simulation-status',paused?'PAUSIERT':'LIVE SIMULATION');}
function closeDialogs():void{for(const d of document.querySelectorAll<HTMLDialogElement>('dialog[open]'))d.close('switch');}
function modal(id:string):void{
 const d=el<HTMLDialogElement>(id);if(d.open)return;const wasPaused=game.paused;setPause(true);d.returnValue='';d.showModal();
 showTacticalPause(false);d.addEventListener('close',()=>{if(d.returnValue==='resume')setPause(false);else if(!['switch','new'].includes(d.returnValue))setPause(wasPaused);},{once:true});
}
function openMenu():void{modal('pause-dialog');}
function contextBase():Base|undefined{return game.bases.find(b=>b.id===renderer.selectedBase&&b.owner===0&&b.hp>0);}
function productionBase():Base|undefined{const selected=contextBase();return selected&&selected.buildRemaining<=0&&unitKinds.some(k=>UNITS[k].producers.includes(selected.kind))?selected:game.bases.find(b=>b.owner===0&&b.hp>0&&b.buildRemaining<=0&&b.queue.length>0)??game.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0)??game.bases.find(b=>b.owner===0&&b.hp>0&&b.buildRemaining<=0&&unitKinds.some(k=>UNITS[k].producers.includes(b.kind)));}
function tab(next:string):void{catalogTab=next;for(const name of ['units','territories']){el('catalog-'+name).hidden=name!==next;el('tab-'+name).setAttribute('aria-pressed',String(name===next));}setText('catalog-detail',next==='territories'?'Sektor wählen, um die Kamera zu seiner Bastion zu bewegen.':'Bauarbeiter errichten Produktionsgebäude. Fertige Gebäude schalten ihre Einheiten frei.');refresh();}
function train(kind:UnitKind,contextOnly=false):void{
 const selected=contextBase(),producer=contextOnly?selected:selected&&UNITS[kind].producers.includes(selected.kind)&&selected.buildRemaining<=0&&selected.queue.length<8?selected:game.producer(0,kind);
 if(producer&&game.recruit(producer.id,kind)){audio.command();refresh();}else notify(producer?'Produktion derzeit nicht möglich.':`${UNITS[kind].producers.map(k=>BUILDINGS[k].name).join(' oder ')} erforderlich.`);
}
function prepareCatalog():void{
 for(const building of ['headquarters','barracks','factory','airfield'] as const){
  const category=document.createElement('section');category.dataset.productionBuilding=building;
  const heading=document.createElement('h2');heading.textContent=(building==='headquarters'?'Hauptquartier':BUILDINGS[building].name).toLocaleUpperCase('de-DE');category.append(heading);
  const grid=document.createElement('div');grid.className='catalog-grid';category.append(grid);el('catalog-units').append(category);
  for(const kind of unitKinds.filter(k=>UNITS[k].producers.includes(building))){
   const spec=UNITS[kind],button=document.createElement('button');button.className='catalog-card';button.dataset.unit=kind;button.setAttribute('aria-label',`${spec.name} ausbilden · ${spec.cost} Credits`);
   button.innerHTML=`<img src="${renderer.icon('unit',kind)}" alt=""/><span class="card-meta" aria-hidden="true"><span class="card-name"></span><span class="card-cost">${spec.cost.toLocaleString('de-DE')}</span></span>`;button.querySelector<HTMLElement>('.card-name')!.textContent=spec.name;button.title=spec.name;
   button.onclick=()=>train(kind);button.onpointerenter=()=>{setText('catalog-detail',`${spec.name} · ${spec.buildTime} S — ${spec.description}`);};grid.append(button);
  }
 }
 prepareTerritories();
 for(let i=0;i<8;i++){const button=document.createElement('button');button.onclick=()=>{const b=productionBase();if(b&&i<b.queue.length){game.cancel(b.id,i);refresh();}else tab('units');};el('queue-slots').append(button);}
}
function prepareTerritories():void{el('catalog-territories').replaceChildren();
 for(const t of game.territories){const button=document.createElement('button');button.className='territory-row';button.dataset.territory=String(t.id);button.innerHTML='<i></i><strong></strong><small></small>';button.onclick=()=>{renderer.camera.x=game.territories[t.id].point.x;renderer.camera.y=game.territories[t.id].point.y;renderer.boundCamera();};el('catalog-territories').append(button);}
}
function reset():void{closeDialogs();game=createCampaign();qwenGeneral.resetCampaign();audio.bindGame(game);renderer.game=game;renderer.invalidate();renderer.selected.clear();renderer.selectedBase=null;renderer.attackMode=false;renderer.placement=null;renderer.commandMode=null;renderer.canvas.classList.remove('attack','building');renderer.home();prepareTerritories();accumulator=0;resultShown=false;messages.length=0;setPause(false);tab('units');refresh();notify('Neue Kampagne. Wähle deinen Bauarbeiter und errichte zuerst eine Kaserne.');}
function refresh():void{
 if(!profiler)return refreshMeasured();const at=performance.now();try{refreshMeasured();}finally{profiler.record('hud',performance.now()-at);}
}
function refreshMeasured():void{
 if(!ready)return;
 const selected=game.units.filter(u=>renderer.selected.has(u.id)&&u.owner===0&&!u.carrier);renderer.selected=new Set(selected.map(u=>u.id));
 if(!game.bases.some(b=>b.id===renderer.selectedBase&&b.hp>0&&b.owner===0))renderer.selectedBase=null;
 const base=contextBase(),production=productionBase(),first=selected[0],spec=first?unitSpec(first):undefined;
 el('selection-panel').hidden=!selected.length&&!base;
 setText('production-title',production?`PRODUKTION · ${buildingSpec(production).name}`:'PRODUKTION');
 setText('campaign-goal',`Erkunde Aridis. Sichere alle ${mapLayout(game.world.mapVersion).starts[1].length} roten Startgebiete und erobere das feindliche Hauptquartier, um zu gewinnen. Zerstöre es zuerst und sichere anschließend seinen Kontrollpunkt.`);
 setText('credits',Math.floor(game.credits[0]).toLocaleString('de-DE'));setText('income',`+${game.income(0)}`);setHtml('capacity',`${game.count(0)} <em>/ ${RULES.capacity}</em>`);
 setText('territories',`${game.territories.filter(t=>t.owner===0).length} / ${game.territories.length}`);setText('clock',timestamp());setText('exploration',`${Math.round(game.explored[0].reduce((n,v)=>n+v,0)/game.explored[0].length*100)} % ERKUNDET`);
 const title=selected.length?(selected.length===1?spec!.name:`${selected.length} Einheiten`):base?(base.kind==='headquarters'?'Hauptquartier':buildingSpec(base).name):'';
 setText('selection-title',title);setText('selection-tag',`BLAUE LEGION${spec?' / '+spec.group.toLocaleUpperCase('de-DE'):''}`);
 const img=el('portrait').querySelector('img')!,desired=first?renderer.icon('unit',first.kind):renderer.icon('building',base?.kind??'headquarters');if(img.getAttribute('src')!==desired)img.src=desired;
 const hp=selected.length?selected.reduce((n,u)=>n+u.hp,0):base?.hp??0,max=selected.length?selected.reduce((n,u)=>n+unitSpec(u).hp,0):base?buildingSpec(base).hp:1;
 el('health-fill').style.width=`${Math.max(0,hp/max*100)}%`;setText('selection-health',`${Math.round(hp)} / ${max}${spec?' · '+spec.sight+' M SICHT':''}`);
 let detail=selected.length?(renderer.attackMode?'Angriffsziel mit Linksklick wählen.':selected.length>1?unitKinds.filter(k=>selected.some(u=>u.kind===k)).map(k=>`${selected.filter(u=>u.kind===k).length} × ${UNITS[k].name}`).join(' · '):spec!.description):base?(base.buildRemaining>0?`${base.constructionActive?'Bau aktiv':'Bau pausiert — Bauarbeiter erforderlich'}. ${Math.round((1-base.buildRemaining/buildingSpec(base).buildTime)*100)} % · noch ${Math.ceil(base.buildRemaining)} S. Rechtsklick mit Bauarbeiter setzt fort.`:buildingSpec(base).description):'Wähle eine Einheit.';
 el('unit-commands').hidden=selected.length===0;el('attack').setAttribute('aria-pressed',String(renderer.attackMode));el('overlay').setAttribute('aria-pressed',String(renderer.overlay));
 const medics=selected.some(u=>u.kind==='medic'),workers=selected.some(u=>u.kind==='engineer');
 el('support-commands').hidden=!selected.length;el('heal-mode').hidden=!medics;el('repair-mode').hidden=!workers;el('build-mode').hidden=!workers;
 if(!workers){renderer.placement=null;el('build-menu').hidden=true;renderer.canvas.classList.remove('building');}
 el('load-mode').hidden=!selected.some(u=>transportCapacity(u.kind)>0);el('unload-mode').hidden=!selected.some(u=>transportCapacity(u.kind)>0);el<HTMLButtonElement>('unload-mode').disabled=!selected.some(u=>transportCapacity(u.kind)>0&&u.transport?.cargo.length);
 if(selected.length===1&&first&&transportCapacity(first.kind)>0)detail=`${first.transport?.cargo.length??0} / ${transportCapacity(first.kind)} Passagiere · ${spec!.description}`;
 el('move-mode').hidden=!selected.length;el('rally-mode').hidden=!base||base.buildRemaining>0||!unitKinds.some(k=>UNITS[k].producers.includes(base.kind));
 const context=el('building-commands'),contextKey=base?`${base.id}:${base.buildRemaining>0}`:'';
 if(context.dataset.key!==contextKey){context.dataset.key=contextKey;context.replaceChildren();
  if(base&&base.buildRemaining<=0)for(const kind of unitKinds.filter(k=>UNITS[k].producers.includes(base.kind))){const button=document.createElement('button');button.dataset.contextUnit=kind;button.title=`${UNITS[kind].name} ausbilden · ${UNITS[kind].cost} Credits · ${UNITS[kind].buildTime} S`;button.setAttribute('aria-label',`${UNITS[kind].name} ausbilden`);button.innerHTML=`<img src="${renderer.icon('unit',kind)}" alt=""/><span>${UNITS[kind].name}</span>`;button.onclick=()=>train(kind,true);context.append(button);}
  if(base){const cancel=document.createElement('button');cancel.id='context-cancel';cancel.textContent=base.buildRemaining>0?'Bau abbrechen · 75 % zurück':'Letzten Auftrag stornieren';cancel.onclick=()=>{const b=contextBase();if(!b)return;if(b.buildRemaining>0){game.cancelConstruction(b.id);renderer.selectedBase=null;}else game.cancel(b.id);refresh();};context.append(cancel);}
 }
 context.hidden=!base;
 for(const button of context.querySelectorAll<HTMLButtonElement>('[data-context-unit]')){const kind=button.dataset.contextUnit as UnitKind;button.disabled=!base||base.queue.length>=8||game.credits[0]<UNITS[kind].cost||game.count(0)+game.queued(0)>=RULES.capacity||game.status!=='playing';}
 const contextCancel=document.getElementById('context-cancel') as HTMLButtonElement|null;if(contextCancel)contextCancel.disabled=!!base&&base.buildRemaining<=0&&!base.queue.length;
 if(selected.length===1&&first?.supportPaused)detail='Heilziel ist zu weit voraus. Sanitäter wartet; der Heilauftrag bleibt erhalten.';
 if(renderer.placement)detail=`${BUILDINGS[renderer.placement].name}: Linksklick setzt die Baustelle. Esc / Rechtsklick bricht ab.`;
 setText('selection-detail',detail);
 setText('hint',renderer.attackMode?'ANGRIFFSBEWEGUNG: LINKSKLICK AUF DAS ZIEL':'ZIEHEN: AUSWAHL · RECHTSKLICK: BEWEGEN · SHIFT: BEFEHLSKETTE');
 if(production){
  const building=production.buildRemaining>0,duration=production.queue[0]??5,ratio=building?1-production.buildRemaining/buildingSpec(production).buildTime:production.production/duration;
  el('production-fill').style.width=`${ratio*100}%`;setText('production-time',building?`BAU ${Math.ceil(production.buildRemaining).toString().padStart(2,'0')} S`:production.queue.length?`00:${Math.ceil(duration-production.production).toString().padStart(2,'0')}`:'00:00');
  setText('queue',building?'BAUSTELLE AKTIV':production.queue.length?`${production.queue.length} IM AUFTRAG · ${Math.max(0,duration-production.production).toFixed(1)} S`:'WARTESCHLANGE LEER');
  el<HTMLButtonElement>('cancel').disabled=!building&&!production.queue.length;
 }else{setText('queue','KEINE PRODUKTIONSSTÄTTE');el('production-fill').style.width='0';setText('production-time','00:00');el<HTMLButtonElement>('cancel').disabled=true;}
 for(const [i,button] of [...el('queue-slots').children].entries()){
  const kind=production?.queueTypes[i],key=kind??'empty';if((button as HTMLElement).dataset.kind!==key){(button as HTMLElement).dataset.kind=key;button.innerHTML=kind?`<img src="${renderer.icon('unit',kind)}" alt=""/><span class="queue-index">${i+1}</span>`:'+';}
  button.classList.toggle('empty',!kind);button.classList.toggle('current',!!kind&&i===0);(button as HTMLElement).title=kind?`${UNITS[kind].name} · Auftrag stornieren`:'Einheit hinzufügen';
 }
 const facilities=new Set(game.bases.filter(b=>b.owner===0&&b.hp>0&&b.buildRemaining<=0).map(b=>b.kind));
 for(const category of document.querySelectorAll<HTMLElement>('[data-production-building]'))category.hidden=!facilities.has(category.dataset.productionBuilding as BuildingKind);
 const quickKind=production?unitKinds.find(k=>UNITS[k].producers.includes(production.kind)):undefined,quick=el<HTMLButtonElement>('recruit');
 quick.hidden=!quickKind;
 if(quickKind){const quickSpec=UNITS[quickKind];quick.disabled=production!.queue.length>=8||game.credits[0]<quickSpec.cost||game.count(0)+game.queued(0)>=RULES.capacity||game.status!=='playing';
  quick.title=`${quickSpec.name} ausbilden · ${quickSpec.cost} Credits`;quick.setAttribute('aria-label',`${quickSpec.name} ausbilden`);
  if(quick.dataset.kind!==quickKind){quick.dataset.kind=quickKind;quick.innerHTML=`<img src="${renderer.icon('unit',quickKind)}" alt=""/>`;}
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
 for(const message of game.notices.splice(0))notify(message);
 if(game.status!=='playing'&&!resultShown){resultShown=true;closeDialogs();setPause(true);setText('result-title',game.status==='victory'?'Aridis gesichert.':'Die Legion ist gefallen.');setText('result-copy',game.status==='victory'?`Das feindliche Hauptquartier und seine ${mapLayout(game.world.mapVersion).starts[1].length} Startgebiete sind unter deiner Kontrolle.`:'Deine Produktionsstätten und Truppen wurden vernichtet.');el<HTMLDialogElement>('result-dialog').showModal();}
}
async function save():Promise<void>{if(busy)return;busy=true;try{await saveCampaign(game);notify('Kampagne lokal gespeichert.');}catch(e){notify((e as Error).message);}finally{busy=false;}}
async function load():Promise<void>{if(busy)return;busy=true;try{const loaded=await loadCampaign();closeDialogs();game=loaded;qwenGeneral.resetCampaign();audio.bindGame(game);renderer.game=game;renderer.invalidate();renderer.selected.clear();renderer.selectedBase=null;renderer.attackMode=false;renderer.placement=null;renderer.commandMode=null;renderer.canvas.classList.remove('attack','building');renderer.home();prepareTerritories();resultShown=false;accumulator=0;setPause(false);refresh();notify('Kampagne geladen.');}catch(e){notify((e as Error).message);}finally{busy=false;}}
el('resume-tactical').onclick=()=>setPause(false);
input.onPause=()=>setPause(!game.paused);input.onMenu=openMenu;input.onHelp=()=>modal('help-dialog');input.onSave=()=>void save();input.onLoad=()=>void load();
input.onSelection=()=>{const next=[...renderer.selected].join(',')+':'+renderer.selectedBase;if(next!==selectionSound){selectionSound=next;audio.select();}refresh();};input.onOrder=order=>audio.acknowledge(order,game);
el('save').onclick=()=>void save();el('load').onclick=()=>void load();el('main-load').onclick=()=>void load();el('pause').onclick=input.onPause;el('menu').onclick=openMenu;el('help').onclick=input.onHelp;
el('to-main').onclick=()=>{closeDialogs();modal('main-dialog');};el('main-continue').onclick=()=>{closeDialogs();setPause(false);};el('new').onclick=()=>modal('new-dialog');el<HTMLDialogElement>('new-dialog').addEventListener('close',()=>{
 if(el<HTMLDialogElement>('new-dialog').returnValue==='new'){
  const size=el<HTMLSelectElement>('map-size').value as CampaignSize;
  selectedMapVersion=CAMPAIGN_SIZES[size]??4;reset();
 }
});
el('result-new').onclick=()=>{closeDialogs();modal('new-dialog');};el('result-close').onclick=()=>el<HTMLDialogElement>('result-dialog').close();
el('home').onclick=()=>renderer.home();el('command-home').onclick=()=>renderer.home();el('overlay').onclick=()=>{renderer.overlay=!renderer.overlay;refresh();};
el('select-unit').onclick=()=>{renderer.selectedBase=null;const u=game.units.find(u=>u.owner===0&&!u.carrier);renderer.selected=new Set(u?[u.id]:[]);if(u){renderer.camera.x=u.x;renderer.camera.y=u.y;renderer.boundCamera();}refresh();};
el('select-base').onclick=()=>{renderer.selected.clear();renderer.selectedBase=game.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0)?.id??null;renderer.home();refresh();};
el('hold').onclick=()=>{input.stop(true);refresh();};
el('heal-mode').onclick=()=>{renderer.commandMode='heal';renderer.attackMode=false;renderer.canvas.classList.remove('attack');notify('Verletzte eigene Infanterie mit Linksklick wählen.');};
el('load-mode').onclick=()=>{renderer.commandMode='load';renderer.attackMode=false;notify('Eigene Infanterie mit Linksklick als Abholgruppe wählen.');};
el('unload-mode').onclick=()=>{renderer.commandMode='unload';renderer.attackMode=false;notify('Linksklick auf den gewünschten Ausladeort.');};
el('repair-mode').onclick=()=>{renderer.commandMode='repair';renderer.attackMode=false;renderer.canvas.classList.remove('attack');notify('Eigenes beschädigtes Gebäude oder Baustelle mit Linksklick wählen.');};
el('close-build-menu').onclick=()=>{el('build-menu').hidden=true;};
el('build-mode').onclick=()=>{el('build-menu').hidden=!el('build-menu').hidden;};
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-build]'))button.onclick=()=>{renderer.placement=button.dataset.build as BuildingKind;renderer.commandMode=null;renderer.attackMode=false;renderer.canvas.classList.remove('attack');renderer.canvas.classList.add('building');el('build-menu').hidden=true;refresh();};
el('stop').onclick=()=>{input.stop();refresh();};el('attack').onclick=()=>{renderer.attackMode=!renderer.attackMode;renderer.canvas.classList.toggle('attack',renderer.attackMode);refresh();};
el('move-mode').onclick=()=>{if(renderer.selected.size){renderer.attackMode=false;renderer.commandMode='move';renderer.canvas.classList.remove('attack');notify('Linksklick auf das Bewegungsziel.');}else notify('Zuerst eine Einheit auswählen.');};
el('rally-mode').onclick=()=>{const b=contextBase();if(b){renderer.selected.clear();renderer.selectedBase=b.id;notify('Rechtsklick auf den neuen Sammelpunkt.');refresh();}};
el('recruit').onclick=()=>{const b=productionBase(),kind=b?unitKinds.find(k=>UNITS[k].producers.includes(b.kind)):undefined;if(kind)train(kind);};el('cancel').onclick=()=>{const b=productionBase();if(b){if(b.buildRemaining>0){game.cancelConstruction(b.id);renderer.selectedBase=null;}else game.cancel(b.id);refresh();}};
el('cancel-action').onclick=()=>{if(renderer.placement||renderer.commandMode){renderer.placement=null;renderer.commandMode=null;renderer.canvas.classList.remove('building');}else{const b=contextBase();if(b&&b.buildRemaining>0){game.cancelConstruction(b.id);renderer.selectedBase=null;}else{renderer.selected.clear();renderer.selectedBase=null;renderer.attackMode=false;}}refresh();};
for(const name of ['units','territories'])el('tab-'+name).onclick=()=>tab(name);
try{renderer.units.particles.enabled=localStorage.getItem('atlas-reborn-particles')!=='false';}catch{/* Optional local setting. */}
el<HTMLInputElement>('particles-enabled').checked=renderer.units.particles.enabled;
el('particles-enabled').onchange=()=>{renderer.units.particles.enabled=el<HTMLInputElement>('particles-enabled').checked;renderer.units.particles.clear();try{localStorage.setItem('atlas-reborn-particles',String(renderer.units.particles.enabled));}catch{/* Optional. */}};
const soundPreferences=()=>{audio.setEnabled(el<HTMLInputElement>('audio-enabled').checked);audio.setVolume(Number(el<HTMLInputElement>('audio-volume').value)/100);audio.ambience=el<HTMLInputElement>('audio-ambience').checked;audio.radio.setEnabled(el<HTMLInputElement>('audio-speech').checked);audio.radio.setVolume(Number(el<HTMLInputElement>('speech-volume').value)/100);setText('speech-level',`${Math.round(audio.radio.volume*100)} %`);setText('audio-level',`${Math.round(audio.volume*100)} %`);try{localStorage.setItem('atlas-reborn-sound',JSON.stringify({enabled:audio.enabled,volume:audio.volume,ambience:audio.ambience,speech:audio.radio.enabled,speechVolume:audio.radio.volume}));}catch{/* Optional. */}};
el<HTMLInputElement>('audio-enabled').checked=audio.enabled;el<HTMLInputElement>('audio-volume').value=String(Math.round(audio.volume*100));el<HTMLInputElement>('audio-ambience').checked=audio.ambience;setText('audio-level',`${Math.round(audio.volume*100)} %`);
el<HTMLInputElement>('audio-speech').checked=audio.radio.enabled;el<HTMLInputElement>('speech-volume').value=String(Math.round(audio.radio.volume*100));setText('speech-level',`${Math.round(audio.radio.volume*100)} %`);
for(const id of ['audio-enabled','audio-volume','audio-ambience','audio-speech','speech-volume'])el(id).addEventListener('input',soundPreferences);
const openAudio=()=>{modal('audio-panel');el('sound').setAttribute('aria-expanded','true');};el('sound').onclick=openAudio;el('options').onclick=openAudio;el<HTMLDialogElement>('audio-panel').addEventListener('close',()=>{audio.radio.stop();el('sound').setAttribute('aria-expanded','false');});el('audio-test').onclick=()=>{void audio.unlock().then(()=>audio.radio.ready).then(()=>audio.radio.request('move','infantry',true)).catch(()=>{});};
const qwenToggle=el<HTMLInputElement>('qwen-enabled');
qwenGeneral.onChange=()=>{qwenToggle.checked=qwenGeneral.enabled;setText('qwen-status',qwenGeneral.description());};
qwenToggle.onchange=()=>{if(qwenToggle.checked)qwenGeneral.enable();else qwenGeneral.disable();};
qwenGeneral.onChange();
el('messages').onclick=()=>{const history=el('message-history');history.replaceChildren();if(!messages.length){const p=document.createElement('p');p.textContent='Keine neuen Funkmeldungen.';history.append(p);}for(const item of messages){const p=document.createElement('p'),time=document.createElement('time');time.textContent=item.time;p.append(time,document.createTextNode(item.message));history.append(p);}el('unread').hidden=true;modal('message-dialog');};
window.addEventListener('pointerdown',()=>{void audio.unlock().catch(()=>{});},{capture:true});window.addEventListener('keydown',()=>{void audio.unlock().catch(()=>{});},{capture:true});window.addEventListener('resize',()=>renderer.resize());document.addEventListener('visibilitychange',()=>{last=performance.now();accumulator=0;if(document.hidden){audio.silenceScene();setPause(true);}});
function frame(now:number):void{profiler?.beginFrame(now);const dt=Math.min(.1,(now-last)/1000);last=now;const inputAt=profiler?performance.now():0;input.update(dt);if(profiler)profiler.record('input',performance.now()-inputAt);if(!game.paused){accumulator+=dt;let steps=0;while(accumulator>=RULES.tick&&steps++<5){game.step();accumulator-=RULES.tick;}}else accumulator=0;const audioAt=profiler?performance.now():0;audio.update(game,renderer);if(profiler)profiler.record('audio',performance.now()-audioAt);renderer.render(dt,accumulator/RULES.tick);uiClock+=dt;if(uiClock>.1){qwenGeneral.maybePlan(game);refresh();uiClock=0;}profiler?.endFrame(now);requestAnimationFrame(frame);}
void audio.radio.preload();
try{await renderer.load();prepareCatalog();ready=true;el('loading').remove();refresh();last=performance.now();requestAnimationFrame(frame);if(!query.has('debug'))modal('new-dialog');}catch(e){setHtml('loading','<strong>Der Wüstensektor konnte nicht geladen werden.</strong><p>Bitte neu laden und die lokalen Grafiken prüfen.</p>');console.error(e);}
if(new URLSearchParams(location.search).has('debug'))Object.assign(window,{__reborn:{get game(){return game;},renderer,input,refresh,audio,profiler,qwenGeneral,advance(seconds:number){for(let i=0;i<Math.round(seconds/RULES.tick);i++)game.step();refresh();renderer.render(0);},save,load}});
