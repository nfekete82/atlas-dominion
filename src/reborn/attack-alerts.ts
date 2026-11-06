import type {Point} from './config.js';

export const ATTACK_BLINK_SECONDS=5.5;
export const ATTACK_RADIO_COOLDOWN=14;
export const ATTACK_LOCATION_COOLDOWN=3.5;
export interface AttackMarker extends Point {at:number;id:number}
export function attackBlinkAlpha(now:number,at:number,reducedMotion=false):number {
 const age=now-at;
 if(age<0||age>=ATTACK_BLINK_SECONDS)return 0;
 const fade=Math.min(1,(ATTACK_BLINK_SECONDS-age)/1.2);
 return fade*(reducedMotion?.70:.22+.78*(.5+.5*Math.sin(age*14)));
}

/** Ephemeral player-only presentation events, never serialized with game saves. */
export class AttackAlerts {
 private markers:AttackMarker[]=[];
 private lastAnnouncement=-Infinity;
 private lastPerArea=new Map<string,number>();
 readonly maxMarkers=12;
 sequence=0;
 lastAlert:AttackMarker|null=null;

 /** Trigger only for actual damage to the player's living unit or structure. */
 record(point:Point,gameTime:number):boolean {
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(gameTime))return false;
  const area=`${Math.floor(point.x/220)}:${Math.floor(point.y/220)}`;
  const previous=this.lastPerArea.get(area)??-Infinity;
  if(gameTime-previous>=ATTACK_LOCATION_COOLDOWN){
   this.lastPerArea.set(area,gameTime);
   this.markers=this.markers.filter(marker=>gameTime-marker.at<ATTACK_BLINK_SECONDS&&
     `${Math.floor(marker.x/220)}:${Math.floor(marker.y/220)}`!==area);
   this.markers.push({x:point.x,y:point.y,at:gameTime,id:this.sequence+1});
   if(this.markers.length>this.maxMarkers)this.markers.shift();
  }
  if(gameTime-this.lastAnnouncement>=ATTACK_RADIO_COOLDOWN){
   this.lastAnnouncement=gameTime;
   this.sequence++;
   this.lastAlert={x:point.x,y:point.y,at:gameTime,id:this.sequence};
   return true;
  }
  return false;
 }
 visible(now:number):readonly AttackMarker[]{
  return this.markers.filter(m=>now>=m.at&&now-m.at<ATTACK_BLINK_SECONDS);
 }
 /** A new match naturally creates a new tracker. */
}
