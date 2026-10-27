import { RULES, clamp, distance, type Point } from './config.js';
import { Renderer } from './renderer.js';
import { buildingSpec, unitSpec } from './catalog.js';
import { unitSelectionPoint } from './unit-presentation.js';
import type {PlayerOrder,RadioAction} from './unit-radio.js';

export class Input {
  private keys=new Set<string>();private pointer:Point|null=null;
  private commandHeld=new Map<string,number>();
  private down:Point|null=null;private miniDragging=false;private dragging=false;
  onSelection=()=>{};onPause=()=>{};onHelp=()=>{};onSave=()=>{};onLoad=()=>{};
  onMenu=()=>{};
  onOrder=(_order:PlayerOrder)=>{};
  notify=(_message:string)=>{};
  constructor(readonly renderer:Renderer){
    const canvas=renderer.canvas,mini=renderer.miniCanvas;
    const local=(e:PointerEvent|MouseEvent):Point=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*renderer.width/r.width,y:(e.clientY-r.top)*renderer.height/r.height};};
    const clipped=(p:Point):Point=>({x:clamp(p.x,0,renderer.width),y:clamp(p.y,0,renderer.height)});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',e=>{
      canvas.focus();this.pointer=local(e);
      if(e.button===2){
        // Alt/Option + right-click forces a retreat even directly over an enemy.
        if(e.altKey&&renderer.selected.size){
          renderer.placement=null;renderer.commandMode=null;renderer.attackMode=false;
          canvas.classList.remove('building','attack');
          this.order(renderer.world(this.pointer),e.shiftKey,true);return;
        }
        if(renderer.placement||renderer.commandMode){renderer.placement=null;renderer.commandMode=null;renderer.canvas.classList.remove('building');this.onSelection();return;}
        this.order(renderer.world(this.pointer),e.shiftKey);return;
      }
      if(e.button===0){this.down=local(e);this.dragging=false;canvas.setPointerCapture(e.pointerId);}
    });
    canvas.addEventListener('pointermove',e=>{
      this.pointer=local(e);renderer.pointer=renderer.world(this.pointer);if(this.down&&distance(this.down,this.pointer)>6)this.dragging=true;
      if(this.down&&this.dragging)renderer.box={from:this.down,to:clipped(this.pointer)};
    });
    canvas.addEventListener('pointerup',e=>{
      if(e.button!==0||!this.down)return;const p=local(e);
      // Pointer capture can finish over the sidebar. Only rectangle selection
      // may extend there, and its endpoint stays at the visible canvas boundary.
      if(!this.dragging&&document.elementFromPoint(e.clientX,e.clientY)!==canvas){renderer.box=null;this.down=null;this.dragging=false;this.pointer=null;renderer.pointer=null;return;}
      if(this.dragging&&(renderer.placement||renderer.commandMode||renderer.attackMode)&&document.elementFromPoint(e.clientX,e.clientY)!==canvas){renderer.box=null;this.down=null;this.dragging=false;this.pointer=null;renderer.pointer=null;return;}
      if(renderer.placement){
        const point=renderer.world(p),error=renderer.game.buildError(0,renderer.placement,point);
        const site=error?null:renderer.game.build(0,renderer.placement,point,[...renderer.selected]);
        if(site){this.acknowledge('build',[...renderer.selected].filter(id=>renderer.game.units.some(u=>u.id===id&&u.kind==='engineer'&&u.orders.some(o=>o.kind==='build'&&o.target===site.id))));renderer.placement=null;canvas.classList.remove('building');this.notify('Baustelle beauftragt. Bauarbeiter sind unterwegs.');}
        else this.notify(error??'Ein lebender Bauarbeiter muss die Baustelle erreichen können.');
      }else if(renderer.commandMode){this.order(renderer.world(p),e.shiftKey);renderer.commandMode=null;}
      else if(this.dragging){
        const a=renderer.world(this.down),b=renderer.world(clipped(p));if(!e.shiftKey)renderer.selected.clear();renderer.selectedBase=null;
        for(const u of renderer.game.units){const p=unitSpec(u).flying?unitSelectionPoint(u):u;if(u.owner===0&&!u.carrier&&p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)&&p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y))renderer.selected.add(u.id);}
      }else if(renderer.attackMode){this.order(renderer.world(p),e.shiftKey);renderer.attackMode=false;canvas.classList.remove('attack');}
      else this.select(renderer.world(p),e.shiftKey);
      renderer.box=null;this.down=null;this.dragging=false;this.onSelection();
    });
    canvas.addEventListener('pointercancel',()=>{this.down=null;renderer.box=null;this.dragging=false;this.pointer=null;renderer.pointer=null;});
    canvas.addEventListener('pointerleave',()=>{this.pointer=null;renderer.pointer=null;});
    canvas.addEventListener('dblclick',e=>{
      const p=renderer.world(local(e));if(!renderer.game.units.some(u=>u.owner===0&&!u.carrier&&distance(unitSpec(u).flying?unitSelectionPoint(u):u,p)<40/renderer.camera.zoom))return;
      renderer.selectedBase=null;for(const u of renderer.game.units){const s=renderer.screen(unitSpec(u).flying?unitSelectionPoint(u):u);if(u.owner===0&&!u.carrier&&s.x>0&&s.y>0&&s.x<renderer.width&&s.y<renderer.height)renderer.selected.add(u.id);}this.onSelection();
    });
    canvas.addEventListener('wheel',e=>{e.preventDefault();renderer.zoom(e.deltaY,local(e));},{passive:false});
    const miniMove=(e:PointerEvent)=>{const r=mini.getBoundingClientRect();renderer.camera.x=(e.clientX-r.left)/r.width*renderer.game.world.size;renderer.camera.y=(e.clientY-r.top)/r.height*renderer.game.world.size;renderer.boundCamera();};
    mini.addEventListener('pointerdown',e=>{if(e.button!==0)return;this.miniDragging=true;mini.setPointerCapture(e.pointerId);miniMove(e);});
    mini.addEventListener('pointermove',e=>{if(this.miniDragging)miniMove(e);});
    mini.addEventListener('pointerup',()=>{this.miniDragging=false;});mini.addEventListener('pointercancel',()=>{this.miniDragging=false;});
    window.addEventListener('keydown',e=>{
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||document.querySelector('dialog[open]'))return;
      const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright','f5','f9'].includes(key))e.preventDefault();
      if(e.repeat)return;
      if(key===' '){this.onPause();return;}
      if(key==='s'&&renderer.selected.size){this.stop();this.notify('Einheiten halten die Position.');this.keys.add(key);this.commandHeld.set(key,performance.now());return;}
      if(key==='a'&&renderer.selected.size){renderer.attackMode=true;renderer.commandMode=null;canvas.classList.add('attack');this.onSelection();this.keys.add(key);this.commandHeld.set(key,performance.now());return;}
      if(key==='m'&&renderer.selected.size){
        renderer.attackMode=false;renderer.commandMode='move';canvas.classList.remove('attack');
        this.notify('Rückzug / Bewegen: Ziel mit Linksklick wählen (ignoriert Angriffsziele).');
        this.onSelection();return;
      }
      if(key==='escape'){e.preventDefault();if(renderer.placement||renderer.commandMode){renderer.placement=null;renderer.commandMode=null;canvas.classList.remove('building');this.onSelection();return;}if(!renderer.selected.size&&renderer.selectedBase===null&&!renderer.attackMode){this.onMenu();return;}renderer.selected.clear();renderer.selectedBase=null;renderer.attackMode=false;canvas.classList.remove('attack');this.onSelection();}
      if(key==='h'||key==='home')renderer.home();
      if(key==='t'){renderer.overlay=!renderer.overlay;this.onSelection();}
      if(key==='?'||key==='f1'){e.preventDefault();this.onHelp();}
      if(key==='f5')this.onSave();if(key==='f9')this.onLoad();
      this.keys.add(key);
    });
    window.addEventListener('keyup',e=>{this.keys.delete(e.key.toLowerCase());this.commandHeld.delete(e.key.toLowerCase());});
    window.addEventListener('blur',()=>{this.keys.clear();this.commandHeld.clear();this.pointer=null;});
  }
  select(p:Point,append=false):void {
    const r=this.renderer,g=r.game;
    const unit=g.units.filter(u=>u.owner===0&&!u.carrier&&distance(unitSelectionPoint(u),p)<Math.max(32/r.camera.zoom,unitSpec(u).width*.5)).sort((a,b)=>distance(unitSelectionPoint(a),p)-distance(unitSelectionPoint(b),p))[0];
    if(!append)r.selected.clear();r.selectedBase=null;
    if(unit){if(append&&r.selected.has(unit.id))r.selected.delete(unit.id);else r.selected.add(unit.id);}
    else {const b=g.bases.find(b=>{const spec=buildingSpec(b);return b.owner===0&&b.hp>0&&p.x>b.x-spec.width/2&&p.x<b.x+spec.width/2&&p.y>b.y-spec.width*.85&&p.y<b.y+spec.radius*.5;});r.selected.clear();if(b)r.selectedBase=b.id;}
  }
  private acknowledge(kind:RadioAction,ids:number[]):void{
    const u=this.renderer.game.units.find(u=>ids.includes(u.id)&&u.owner===0&&u.hp>0&&!u.carrier);if(u)this.onOrder({kind,unit:u.kind,unitId:u.id});
  }
  stop(hold=false):void{
    const ids=[...this.renderer.selected].filter(id=>this.renderer.game.units.some(u=>u.id===id&&u.owner===0&&u.hp>0&&!u.carrier));
    this.renderer.game.stop(ids,hold);if(ids.length)this.acknowledge(hold?'hold':'stop',ids);
  }
  order(p:Point,append=false,forceMove=false):void {
    const r=this.renderer,g=r.game;
    if(r.selectedBase!==null){const b=g.bases.find(b=>b.id===r.selectedBase&&b.owner===0&&b.hp>0);if(b){b.rally=g.world.nearest(p,g.obstacles());this.notify('Sammelpunkt gesetzt.');}return;}
    if(!r.selected.size)return;
    const friendlyUnit=g.units.filter(u=>u.owner===0&&!u.carrier&&u.hp>0&&distance(unitSelectionPoint(u),p)<Math.max(30/r.camera.zoom,unitSpec(u).width*.5)).sort((a,b)=>distance(unitSelectionPoint(a),p)-distance(unitSelectionPoint(b),p))[0];
    const friendlyBase=g.bases.find(b=>b.owner===0&&b.hp>0&&p.x>b.x-buildingSpec(b).width/2&&p.x<b.x+buildingSpec(b).width/2&&p.y>b.y-buildingSpec(b).width*.85&&p.y<b.y+b.radius*.5);
    const carriers=g.units.filter(u=>r.selected.has(u.id)&&(u.kind==='scout'||u.kind==='rover')&&u.owner===0&&!u.carrier);
    if(r.commandMode==='unload'){
      const accepted:number[]=[];for(const u of carriers)if(g.transports.unload(u.id,p))accepted.push(u.id);if(accepted.length){this.acknowledge('unload',accepted);this.notify('Transportfahrzeug fährt oder fliegt zum Ausladeort.');}else this.notify('Kein sicherer Landeplatz oder keine Passagiere.');this.onSelection();return;
    }
    if(!forceMove&&!r.attackMode&&r.commandMode!=='move'&&((friendlyUnit?.kind==='scout'||friendlyUnit?.kind==='rover')||(friendlyUnit&&carriers.length))){
      let count=0;const accepted:number[]=[];
      if(friendlyUnit.kind==='scout'||friendlyUnit.kind==='rover'){count=g.transports.board(friendlyUnit.id,[...r.selected]);if(count)accepted.push(friendlyUnit.id);}
      else for(const h of carriers){const ids=g.units.filter(u=>u.owner===0&&!u.carrier&&unitSpec(u).group==='Infanterie'&&distance(u,friendlyUnit)<100).map(u=>u.id),n=g.transports.board(h.id,ids);count+=n;if(n)accepted.push(h.id);}
      if(count){this.notify(`${count} Infanteristen steigen in den Transporter ein.`);this.acknowledge('load',accepted);this.onSelection();return;}
    }
    if(r.commandMode==='load'){this.notify('Eigene Infanterie als Abholgruppe wählen.');this.onSelection();return;}
    if(!forceMove&&r.commandMode!=='move'&&!r.attackMode){
      let count=0;const accepted:{id:number;kind:RadioAction}[]=[];
      for(const id of r.selected){const u=g.units.find(u=>u.id===id);if(!u)continue;
        if(u.kind==='medic'&&friendlyUnit){const n=g.command([id],{x:friendlyUnit.x,y:friendlyUnit.y,kind:'heal',target:friendlyUnit.id},append);count+=n;if(n)accepted.push({id,kind:'heal'});}
        if(u.kind==='engineer'&&friendlyBase){const kind=friendlyBase.buildRemaining>0?'build':'repair',n=g.command([id],{x:friendlyBase.x,y:friendlyBase.y,kind,target:friendlyBase.id},append);count+=n;if(n)accepted.push({id,kind});}
      }
      if(count){this.acknowledge(accepted[0].kind,[accepted[0].id]);this.onSelection();return;}
      if(r.commandMode==='heal'||r.commandMode==='repair'){this.notify('Passendes verletztes eigenes Ziel wählen.');this.onSelection();return;}
    }
    const strictMove=forceMove||r.commandMode==='move';
    const enemy=strictMove?undefined:[...g.units,...g.bases].find(e=>!('carrier' in e&&e.carrier)&&e.owner!==0&&e.hp>0&&g.canSee(0,e)&&distance('orders' in e&&unitSpec(e).flying?unitSelectionPoint(e):e,p)<('queue' in e?100:40)/r.camera.zoom);
    const kind=strictMove?'move':enemy?'attack':r.attackMode?'attackMove':'move';
    const destination=enemy?p:r.bastionAt(p)?.point??p;
    const before=new Map(g.units.filter(u=>r.selected.has(u.id)).map(u=>[u.id,u.orders.at(-1)]));
    const count=g.command([...r.selected],{...destination,kind,target:enemy?.id},append);
    if(count){r.marker={point:destination,life:.8,attack:kind!=='move'};this.acknowledge(kind==='move'?'move':'attack',g.units.filter(u=>r.selected.has(u.id)&&u.orders.at(-1)!==before.get(u.id)).map(u=>u.id));}
    else this.notify('Dieses Ziel ist nicht erreichbar.');
    r.attackMode=false;r.canvas.classList.remove('attack');this.onSelection();
  }
  update(dt:number):void {
    if(document.querySelector('dialog[open]'))return;
    const r=this.renderer,speed=650*dt/r.camera.zoom,edge=14;let dx=0,dy=0;
    const held=(key:string)=>this.keys.has(key)&&(!this.commandHeld.has(key)||performance.now()-this.commandHeld.get(key)!>180);
    if(this.keys.has('arrowleft')||held('a'))dx--;
    if(this.keys.has('arrowright')||this.keys.has('d'))dx++;
    if(this.keys.has('arrowup')||this.keys.has('w'))dy--;
    if(this.keys.has('arrowdown')||held('s'))dy++;
    if(held('a')&&this.commandHeld.has('a')&&r.attackMode){r.attackMode=false;r.canvas.classList.remove('attack');this.onSelection();}
    if(this.pointer&&!this.down&&this.pointer.x>=0&&this.pointer.x<=r.width&&this.pointer.y>=0&&this.pointer.y<=r.height){if(this.pointer.x<edge)dx--;if(this.pointer.x>r.width-edge)dx++;if(this.pointer.y<edge)dy--;if(this.pointer.y>r.height-edge)dy++;}
    r.camera.x+=dx*speed;r.camera.y+=dy*speed;r.boundCamera();
  }
}
