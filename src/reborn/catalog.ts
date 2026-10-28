import { RULES } from './config.js';

export type UnitKind='infantry'|'medic'|'engineer'|'heavy'|'rover'|'tank'|'artillery'|'scout'|'bomber';
export type BuildingKind='headquarters'|'barracks'|'factory'|'airfield'|'generator'|'turret';
export interface UnitSpec {
  name:string; group:'Infanterie'|'Fahrzeuge'|'Luftunterstützung'; cost:number; buildTime:number;
  hp:number; speed:number; sight:number; range:number; damage:number; cooldown:number; radius:number;
  producers:readonly BuildingKind[]; targetsAir?:boolean; flying:boolean; width:number; description:string;
}
const foot={...RULES.infantry,group:'Infanterie' as const,flying:false,width:38,producers:['barracks'] as readonly BuildingKind[]};
export const UNITS:Record<UnitKind,UnitSpec>={
 infantry:{...foot,name:'Infanteriesoldat',description:'Vielseitiger Schütze. Sichert Bastionen und hält die Front.'},
 medic:{...foot,name:'Sanitäter',cost:175,buildTime:8,hp:100,damage:4,range:110,cooldown:1.8,speed:105,description:'Versorgt eigene Infanterie im Umkreis von 70 M mit zusammen 12 LP/s. Langsame Selbstheilung nach einer Feuerpause.'},
 engineer:{...foot,producers:['headquarters'],name:'Ingenieur',cost:200,buildTime:7,hp:110,damage:4,range:110,cooldown:1.8,speed:105,description:'Errichtet Gebäude und repariert mehrere beschädigte Boden- und Luftfahrzeuge im Umkreis von 90 M mit insgesamt 18 LP/s. Repariert auch Anlagen und Baustellen per Rechtsklick.'},
 heavy:{...foot,name:'Schwere Infanterie',cost:250,buildTime:9,hp:420,speed:78,damage:120,range:220,cooldown:1.15,width:44,producers:['barracks'],description:'Überlegener Infanteriekämpfer mit 420 LP und schwerem automatischem Gewehr. Gegen Panzerung verringerter Schaden.'},
 rover:{name:'Humvee',group:'Fahrzeuge',cost:350,buildTime:11,hp:295,speed:235,sight:465,range:240,damage:13,cooldown:.68,radius:18,width:76,producers:['factory'],flying:false,description:'Schneller Humvee mit schwerem Dach-MG, animierten Geländereifen und vier Sitzplätzen. Eigene Infanterie per Rechtsklick einladen und am Ziel ausladen.'},
 tank:{name:'Kampfpanzer',group:'Fahrzeuge',cost:450,buildTime:15,hp:620,speed:86,sight:350,range:255,damage:66,cooldown:1.8,radius:22,width:90,producers:['factory'],flying:false,description:'Schwere Panzerung und eine durchschlagskräftige Kanone.'},
 artillery:{name:'Raketenwerfer',group:'Fahrzeuge',cost:600,buildTime:18,hp:340,speed:65,sight:RULES.turret.sight+80,range:RULES.turret.range+80,damage:120,cooldown:3.8,targetsAir:false,radius:20,width:94,producers:['factory'],flying:false,description:'Schwerer 6×6-Raketenwerfer mit sechs Werferrohren. 680 M Reichweite und 830 M Sicht: bekämpft Bodenziele außerhalb der Turmreichweite.'},
 scout:{name:'Transporthelikopter',group:'Luftunterstützung',cost:600,buildTime:14,hp:360,speed:200,sight:780,range:200,damage:18,cooldown:.6,radius:20,width:106,producers:['airfield'],flying:true,description:'Militärischer Transporthelikopter für zehn Infanteristen. Rechtsklick mit Soldaten zum Einsteigen; Ausladen über das Kommando.'},
 bomber:{name:'Bomber',group:'Luftunterstützung',cost:1000,buildTime:24,hp:700,speed:125,sight:410,range:260,damage:135,cooldown:3.2,targetsAir:false,radius:24,width:107,producers:['airfield'],flying:true,description:'Schweres Kampfflugzeug mit hoher Feuerkraft.'},
};
export interface BuildingSpec {name:string;cost:number;buildTime:number;hp:number;sight:number;radius:number;width:number;income:number;description:string}
export const BUILDINGS:Record<BuildingKind,BuildingSpec>={
 headquarters:{...RULES.headquarters,name:'Feldkommando',cost:0,buildTime:0,width:225,income:10,description:'Hauptquartier der Blauen Legion. Bildet Ingenieure aus. Errichte Kaserne, Fahrzeugfabrik und Flugfeld für weitere Einheiten.'},
 barracks:{name:'Kaserne',cost:200,buildTime:12,hp:800,sight:300,radius:53,width:158,income:0,description:'Bildet Infanteriesoldaten, Sanitäter und schwere Infanterie aus.'},
 factory:{name:'Fahrzeugfabrik',cost:350,buildTime:18,hp:1100,sight:310,radius:70,width:200,income:0,description:'Produziert Humvees, Kampfpanzer und Raketenwerfer.'},
 airfield:{name:'Flugfeld',cost:450,buildTime:22,hp:1200,sight:410,radius:116,width:320,income:0,description:'Großer Wüstenflugplatz mit Flugzeughangar, Kontrollturm, Rollfeld und Landebahn. Produziert Transporthelikopter und Bomber.'},
 generator:{name:'Energiekern',cost:150,buildTime:9,hp:500,sight:230,radius:38,width:112,income:10,description:'Versorgt die Basis und liefert zusätzliche 10 Credits alle 10 Sekunden.'},
 turret:{name:'Geschützturm',cost:175,buildTime:10,hp:650,sight:RULES.turret.sight,radius:30,width:72,income:0,description:`Automatische Fernverteidigung. ${RULES.turret.range} M Reichweite, ${RULES.turret.sight} M Sicht, ${RULES.turret.damage} Schaden.`},
};
export const unitSpec=(u:{kind?:UnitKind}):UnitSpec=>UNITS[u.kind??'infantry'];
export const buildingSpec=(b:{kind?:BuildingKind}):BuildingSpec=>BUILDINGS[b.kind??'headquarters'];
export const unitKinds=Object.keys(UNITS) as UnitKind[];
export const buildingKinds=Object.keys(BUILDINGS) as BuildingKind[];

export const canAttack=(u:{kind?:UnitKind},target:{kind?:UnitKind|BuildingKind;queue?:unknown}):boolean=>'queue' in target||unitSpec(u).targetsAir!==false||!unitSpec(target as {kind?:UnitKind}).flying;
export const weaponDamage=(u:{kind?:UnitKind},target:{kind?:UnitKind|BuildingKind;queue?:unknown}):number=>unitSpec(u).damage*(u.kind==='heavy'&&('queue' in target||unitSpec(target as {kind?:UnitKind}).group!=='Infanterie')?.45:u.kind==='rover'&&('queue' in target||unitSpec(target as {kind?:UnitKind}).group!=='Infanterie')?.35:1);
