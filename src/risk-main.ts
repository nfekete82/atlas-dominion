import {TurnGame,type Province} from './engine/turn-game.js';
import {playComputerRound} from './engine/turn-ai.js';
import {TurnMapRenderer} from './render/turn-map.js';
import {COUNTRY_STARTS} from './data/countries.js';

const $=<T extends HTMLElement>(id:string):T=>{
  const el=document.getElementById(id);
  if(!el)throw new Error('Missing risk UI element: '+id);
  return el as T;
};
const STORE='atlas-dominion-risk-v1';
const phases=['Verstärken','Städte entwickeln','Angreifen','Verschieben'];
let game:TurnGame;
try{
  const existing=localStorage.getItem(STORE);
  game=existing?TurnGame.fromSave(JSON.parse(existing)):new TurnGame(20261012);
}catch{game=new TurnGame(20261012);}
const map=new TurnMapRenderer($<HTMLCanvasElement>('riskCanvas'),game);
let source:number|null=game.provinces.find(p=>p.owner===0)?.id??null;
let target:number|null=null;
const quantity=$<HTMLInputElement>('quantity');
const next=$<HTMLButtonElement>('nextPhase');

function name(p:Province|undefined):string{
  if(!p)return '—';
  return p.capital?'Hauptstadtregion '+COUNTRY_STARTS[p.id]?.capital:'Provinz '+(p.id+1);
}
function report(message:string):void{
  $('status').textContent=message;
}
function persist():void{
  try{localStorage.setItem(STORE,JSON.stringify(game.exportSave()));}
  catch{report('Spielstand konnte nicht gespeichert werden.');}
}
function update():void{
  const owned=game.provinces.filter(p=>p.owner===0);
  $('country').textContent=game.factions[0].name;
  $('roundLabel').textContent='RUNDE '+game.round;
  $('phaseLabel').textContent=phases[['reinforce','develop','attack','fortify'].indexOf(game.phase)].toUpperCase();
  $('provinceCount').textContent=String(owned.length);
  $('armyCount').textContent=String(owned.reduce((sum,p)=>sum+p.troops,0));
  $('goldCount').textContent=String(game.factions[0].gold);
  $('reserveCount').textContent=String(game.factions[0].reserve);
  const p=source===null?undefined:game.provinces[source];
  const t=target===null?undefined:game.provinces[target];
  $('selectedName').textContent=name(p);
  $('selectedDetails').textContent=p?
    ('Besitzer: '+(p.owner<0?'Neutral':game.factions[p.owner]?.name)+
      ' · '+p.troops+' Truppen · Stadt-Level '+p.cityLevel+
      ' · '+p.neighbors.length+' angrenzende Provinzen'):'Klicke eine Provinz an.';
  $('sourceName').textContent=name(p);
  $('targetName').textContent=name(t);
  const step=['reinforce','develop','attack','fortify'].indexOf(game.phase);
  $('phaseStep').textContent='PHASE '+(step+1)+' / 4';
  $('phaseDescription').textContent=phases[step];
  const own=!!p&&p.owner===0;
  const enemy=!!t&&t.owner!==0&&!!p&&p.neighbors.includes(t.id);
  const n=Number(quantity.value);
  $<HTMLButtonElement>('deploy').disabled=game.phase!=='reinforce'||!own||!Number.isInteger(n)||n<1||n>game.factions[0].reserve;
  $<HTMLButtonElement>('upgrade').disabled=game.phase!=='develop'||!own||p!.cityLevel>=5||game.factions[0].gold<[5,10,20,35,55][p!.cityLevel];
  $<HTMLButtonElement>('attack').disabled=game.phase!=='attack'||!own||!enemy||p!.troops<3;
  $<HTMLButtonElement>('quickAttack').disabled=$<HTMLButtonElement>('attack').disabled;
  $<HTMLButtonElement>('move').disabled=game.phase!=='fortify'||!own||!t||t.owner!==0||
    !p!.neighbors.includes(t.id)||!Number.isInteger(n)||n<1||n>=p!.troops;
  next.textContent=step===3?'RUNDE BEENDEN →':'NÄCHSTE PHASE →';
  map.selected=source;map.target=target;map.render();
}
function action(result:{ok:boolean;reason:string}):void{
  report(result.reason);
  persist();update();
}
function selectProvince(id:number):void{
  if(id<0)return;
  const p=game.provinces[id];
  if(p.owner===0){
    if(game.phase==='fortify'&&source!==null&&source!==id&&game.provinces[source]?.neighbors.includes(id)){
      target=id;
    }else{source=id;target=null;}
  }else{
    target=id;
    if(source===null||game.provinces[source]?.owner!==0){
      source=game.provinces.find(p=>p.owner===0&&p.neighbors.includes(id))?.id??null;
    }
  }
  report(name(p)+' ausgewählt · '+p.troops+' Truppen.');
  update();
}
map.canvas.addEventListener('click',event=>selectProvince(map.pick(event.clientX,event.clientY)));
quantity.addEventListener('input',update);
$<HTMLButtonElement>('deploy').addEventListener('click',()=>{
  if(source===null)return;
  action(game.deploy(source,Number(quantity.value)));
});
$<HTMLButtonElement>('upgrade').addEventListener('click',()=>{
  if(source===null)return;
  action(game.upgrade(source));
});
function attack(quick:boolean):void{
  if(source===null||target===null)return;
  let exchanges=0,attackerLoss=0,defenderLoss=0,captured=false;
  let lastDice='';
  for(let i=0;i<(quick?80:1);i++){
    const a=game.provinces[source],d=game.provinces[target];
    if(a.owner!==0||d.owner===0||a.troops<3||!a.neighbors.includes(target))break;
    const r=game.attack(source,target,Math.min(3,a.troops-1));
    if(!r.ok){report(r.reason);break;}
    attackerLoss+=r.attackerLoss??0;defenderLoss+=r.defenderLoss??0;
    lastDice=' · 🎲 '+(r.attackerDice??[]).join(' / ')+' gegen '+(r.defenderDice??[]).join(' / ');
    exchanges++;if(r.captured){captured=true;break;}
    if(a.troops<=d.troops+1)break;
  }
  const message=exchanges?
    ('⚔ '+exchanges+' Würfelrunden · Eigene Verluste: '+attackerLoss+
      ' · Gegner: '+defenderLoss+lastDice+(captured?' · Provinz erobert!':'')):
    'Angriff nicht möglich. Wähle eine eigene Provinz und ein erreichbares Ziel.';
  $('combatResult').textContent=message;
  report(message);
  if(captured)target=null;
  persist();update();
}
$<HTMLButtonElement>('attack').addEventListener('click',()=>attack(false));
$<HTMLButtonElement>('quickAttack').addEventListener('click',()=>attack(true));
$<HTMLButtonElement>('move').addEventListener('click',()=>{
  if(source===null||target===null)return;
  action(game.move(source,target,Number(quantity.value)));
});
next.addEventListener('click',()=>{
  if(game.phase==='fortify'){
    game.nextPhase();
    const summaries=playComputerRound(game);
    const wars=summaries.reduce((sum,a)=>sum+a.battles,0);
    const captured=summaries.reduce((sum,a)=>sum+a.conquered,0);
    report('Runde '+(game.round-1)+' beendet · KI: '+wars+' Würfelkämpfe, '+captured+
      ' Provinzen erobert. Du bist wieder am Zug!');
    source=game.provinces.find(p=>p.owner===0)?.id??null;
    target=null;
  }else{
    game.nextPhase();
    report(phases[['reinforce','develop','attack','fortify'].indexOf(game.phase)]+' – wähle deine Aktion.');
  }
  persist();update();
});
$<HTMLButtonElement>('reset').addEventListener('click',()=>{
  if(!window.confirm('Neue Risiko-Partie beginnen? Dein aktueller Risiko-Spielstand wird überschrieben.'))return;
  game=new TurnGame((Date.now()>>>0)||1);
  map.setGame(game);source=game.provinces.find(p=>p.owner===0)?.id??null;target=null;
  persist();report('Neue Partie gestartet.');update();
});
window.addEventListener('resize',()=>map.render());
setTimeout(()=>map.render(),1000); // Relief imagery loads asynchronously.
report('Deine Runde: Verstärke zunächst eine eigene Provinz.');
update();
