import type {UnitKind} from './catalog.js';
export type UpgradeKind='armor1'|'armor2'|'precision'|'engines'|'infantryTraining'|
 'rocketDevelopment'|'radar'|'tankArmor'|'tankMobility';
export interface UpgradeSpec {
 name:string;cost:number;seconds:number;description:string;
 requires?:UpgradeKind;exclusive?:'tankPath';
}
export const UPGRADES:Record<UpgradeKind,UpgradeSpec>={
 armor1:{name:'Verbesserte Panzerung I',cost:800,seconds:40,
  description:'+10 % maximale Fahrzeug-LP (auch vorhandene Einheiten).'},
 armor2:{name:'Verbesserte Panzerung II',cost:1500,seconds:65,requires:'armor1',
  description:'Weitere +10 % maximale Fahrzeug-LP.'},
 precision:{name:'Präzisionswaffen',cost:1200,seconds:55,description:'+15 % Schaden.'},
 engines:{name:'Motorenoptimierung',cost:900,seconds:40,description:'+12 % Tempo für Bodenfahrzeuge.'},
 infantryTraining:{name:'Infanterieausbildung',cost:700,seconds:35,description:'+15 % Infanterie-LP.'},
 rocketDevelopment:{name:'Raketenentwicklung',cost:1800,seconds:90,description:'+20 % Reichweite für Kampfpanzer und Raketenwerfer.'},
 radar:{name:'Radaroptimierung',cost:1000,seconds:50,description:'+20 % Sichtweite.'},
 tankArmor:{name:'Panzer-Spezialisierung',cost:1700,seconds:75,exclusive:'tankPath',
  description:'+15 % weitere LP für Kampfpanzer. Unvereinbar mit schneller Panzerung.'},
 tankMobility:{name:'Bewegliche Panzer',cost:1700,seconds:75,exclusive:'tankPath',
  description:'+15 % weitere Kampfpanzer-Geschwindigkeit. Unvereinbar mit schwerer Panzerung.'}
};
export const UPGRADE_KINDS=Object.keys(UPGRADES) as UpgradeKind[];
export interface ResearchState{
 completed:UpgradeKind[];
 active:UpgradeKind|null;
 remaining:number;
}
export const newResearchState=():ResearchState=>({completed:[],active:null,remaining:0});
const groundVehicle=(kind:UnitKind)=>['rover','tank','artillery'].includes(kind);
const infantry=(kind:UnitKind)=>['infantry','medic','engineer','heavy'].includes(kind);
export function canResearchUpgrade(s:ResearchState,kind:UpgradeKind):boolean{
 const spec=UPGRADES[kind];
 if(!spec||s.active||s.completed.includes(kind))return false;
 if(spec.requires&&!s.completed.includes(spec.requires))return false;
 if(spec.exclusive&&s.completed.some(k=>k!==kind&&UPGRADES[k]?.exclusive===spec.exclusive))return false;
 return true;
}
export function researchModifiers(s:ResearchState,kind:UnitKind){
 const done=(key:UpgradeKind)=>s.completed.includes(key);
 return {
  hp:groundVehicle(kind)?1+(done('armor1')?.1:0)+(done('armor2')?.1:0)+
     (kind==='tank'&&done('tankArmor')?.15:0):
     infantry(kind)&&done('infantryTraining')?1.15:1,
  damage:done('precision')?1.15:1,
  speed:groundVehicle(kind)?1+(done('engines')?.12:0)+
     (kind==='tank'&&done('tankMobility')?.15:0):1,
  range:kind==='tank'||kind==='artillery'?(done('rocketDevelopment')?1.20:1):1,
  sight:done('radar')?1.20:1
 };
}
export function validResearchState(value:unknown):value is ResearchState{
 if(!value||typeof value!=='object')return false;
 const s=value as ResearchState;
 if(!Array.isArray(s.completed)||s.completed.length>UPGRADE_KINDS.length||
    s.completed.some((k,i)=>!Object.hasOwn(UPGRADES,k)||s.completed.indexOf(k)!==i)||
    (s.active!==null&&!Object.hasOwn(UPGRADES,s.active))||
    !Number.isFinite(s.remaining)||s.remaining<0||s.remaining>90)return false;
 if(s.active!==null&&(s.remaining===0||s.completed.includes(s.active)))return false;
 if(s.completed.includes('tankArmor')&&s.completed.includes('tankMobility'))return false;
 if(s.completed.includes('armor2')&&!s.completed.includes('armor1'))return false;
 return true;
}
export const SILO_CHARGE_SECONDS=600;
export const STRATEGIC_WARNING_SECONDS=25;
export const STRATEGIC_BLAST_RADIUS=350;
export const INTERCEPTOR_COST=2500;
export const INTERCEPTOR_MAX_AMMO=3;
export const INTERCEPTOR_REARM_COST=650;
export const INTERCEPTOR_RANGE=920;
export interface StrategicMissile{
 id:number;owner:0|1;from:{x:number;y:number};to:{x:number;y:number};
 at:number;impactAt:number;intercepted?:boolean;
}
export type StrategicEventKind='launch'|'intercept'|'impact';
export interface StrategicEvent{
 id:number;owner:0|1;kind:StrategicEventKind;from:{x:number;y:number};
 to:{x:number;y:number};at:number;
}
export function strategicBlastDamage(distance:number,targetMaxHp:number,isBuilding:boolean):number{
 if(distance<0||distance>STRATEGIC_BLAST_RADIUS)return 0;
 const falloff=Math.pow(1-distance/STRATEGIC_BLAST_RADIUS,1.35);
 return (isBuilding?targetMaxHp*.60:1280)*falloff;
}
export function validStrategicMissile(data:unknown,size:number,time:number):data is StrategicMissile{
 if(!data||typeof data!=='object')return false;
 const m=data as StrategicMissile;
 return Number.isInteger(m.id)&&m.id>=0&&(m.owner===0||m.owner===1)&&
  [m.from,m.to].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
   p.x>=0&&p.y>=0&&p.x<=size&&p.y<=size)&&
  Number.isFinite(m.at)&&Number.isFinite(m.impactAt)&&
  m.at<=time+1e-6&&m.impactAt>=time-1e-6&&
  m.impactAt-m.at<=STRATEGIC_WARNING_SECONDS+.1;
}
