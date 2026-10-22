import { RULES } from './config.js';

export type UnitKind='infantry'|'engineer'|'heavy'|'rover'|'tank'|'artillery'|'scout'|'gunship'|'bomber';
export type BuildingKind='headquarters'|'barracks'|'factory'|'airfield'|'generator'|'turret';
export interface UnitSpec {
  name:string; group:'Infanterie'|'Fahrzeuge'|'Luftunterstützung'; cost:number; buildTime:number;
  hp:number; speed:number; sight:number; range:number; damage:number; cooldown:number; radius:number;
  producers:readonly BuildingKind[]; flying:boolean; width:number; description:string;
}
const foot={...RULES.infantry,group:'Infanterie' as const,flying:false,width:38,producers:['headquarters','barracks'] as readonly BuildingKind[]};
export const UNITS:Record<UnitKind,UnitSpec>={
 infantry:{...foot,name:'Infanteriesoldat',description:'Vielseitiger Schütze. Sichert Bastionen und hält die Front.'},
 engineer:{...foot,name:'Pionier',cost:150,buildTime:7,hp:110,damage:9,speed:105,description:'Repariert nahe eigene Gebäude, solange er nicht kämpft.'},
 heavy:{...foot,name:'Schwere Infanterie',cost:250,buildTime:9,hp:190,speed:78,damage:34,range:200,cooldown:1.3,width:44,producers:['barracks'],description:'Gepanzerter Trupp mit schwerer Energiewaffe.'},
 rover:{name:'Spähwagen',group:'Fahrzeuge',cost:300,buildTime:10,hp:220,speed:165,sight:390,range:195,damage:19,cooldown:.55,radius:16,width:65,producers:['factory'],flying:false,description:'Schnelles Fahrzeug für Aufklärung und Flankenangriffe.'},
 tank:{name:'Kampfpanzer',group:'Fahrzeuge',cost:450,buildTime:15,hp:620,speed:86,sight:350,range:255,damage:66,cooldown:1.8,radius:22,width:90,producers:['factory'],flying:false,description:'Schwere Panzerung und eine durchschlagskräftige Kanone.'},
 artillery:{name:'Artillerie',group:'Fahrzeuge',cost:600,buildTime:18,hp:340,speed:65,sight:390,range:440,damage:95,cooldown:3,radius:20,width:94,producers:['factory'],flying:false,description:'Langsame Feuerunterstützung mit großer Waffenreichweite.'},
 scout:{name:'Spähheli',group:'Luftunterstützung',cost:600,buildTime:14,hp:160,speed:220,sight:520,range:175,damage:12,cooldown:.4,radius:16,width:79,producers:['airfield'],flying:true,description:'Überfliegt Felsen und deckt große Bereiche auf. Kann keine Bastionen sichern.'},
 gunship:{name:'Kampfheli',group:'Luftunterstützung',cost:750,buildTime:18,hp:380,speed:170,sight:440,range:280,damage:38,cooldown:.8,radius:20,width:92,producers:['airfield'],flying:true,description:'Bewegliche Luftunterstützung gegen Boden- und Luftziele.'},
 bomber:{name:'Bomber',group:'Luftunterstützung',cost:1000,buildTime:24,hp:700,speed:125,sight:410,range:260,damage:135,cooldown:3.2,radius:24,width:107,producers:['airfield'],flying:true,description:'Schweres Kampfflugzeug mit hoher Feuerkraft.'},
};
export interface BuildingSpec {name:string;cost:number;buildTime:number;hp:number;sight:number;radius:number;width:number;income:number;description:string}
export const BUILDINGS:Record<BuildingKind,BuildingSpec>={
 headquarters:{...RULES.headquarters,name:'Feldkommando',cost:0,buildTime:0,width:225,income:10,description:'Hauptquartier der Blauen Legion. Produziert Infanterie und ermöglicht den Basisbau.'},
 barracks:{name:'Kaserne',cost:200,buildTime:12,hp:800,sight:300,radius:53,width:158,income:0,description:'Bildet Infanterie, Pioniere und schwere Schützen aus.'},
 factory:{name:'Fahrzeugfabrik',cost:350,buildTime:18,hp:1100,sight:310,radius:70,width:200,income:0,description:'Produziert Spähwagen, Kampfpanzer und Artillerie.'},
 airfield:{name:'Flugfeld',cost:450,buildTime:22,hp:900,sight:370,radius:74,width:210,income:0,description:'Produziert Spähhelikopter, Kampfhelikopter und Bomber.'},
 generator:{name:'Energiekern',cost:150,buildTime:9,hp:500,sight:230,radius:38,width:112,income:10,description:'Versorgt die Basis und liefert zusätzliche 10 Credits alle 10 Sekunden.'},
 turret:{name:'Geschützturm',cost:175,buildTime:10,hp:650,sight:340,radius:30,width:98,income:0,description:'Automatische Verteidigung. 300 Meter Reichweite, 24 Schaden.'},
};
export const unitSpec=(u:{kind?:UnitKind}):UnitSpec=>UNITS[u.kind??'infantry'];
export const buildingSpec=(b:{kind?:BuildingKind}):BuildingSpec=>BUILDINGS[b.kind??'headquarters'];
export const unitKinds=Object.keys(UNITS) as UnitKind[];
export const buildingKinds=Object.keys(BUILDINGS) as BuildingKind[];
