import { RULES, distance, type Point } from './config.js';
import { Renderer } from './renderer.js';
import { buildingSpec, unitSpec } from './catalog.js';

export class Input {
  private keys=new Set<string>();private pointer:Point|null=null;
  private commandHeld=new Map<string,number>();
  private down:Point|null=null;private miniDragging=false;private dragging=false;
  onSelection=()=>{};onPause=()=>{};onHelp=()=>{};onSave=()=>{};onLoad=()=>{};
  onMenu=()=>{};
  onOrder=(_attack:boolean)=>{};
  notify=(_message:string)=>{};
  constructor(readonly renderer:Renderer){
    const canvas=renderer.canvas,mini=renderer.miniCanvas;
    const local=(e:PointerEvent|MouseEvent):Point=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',e=>{
      canvas.focus();this.pointer=local(e);
      if(e.button===2){this.order(renderer.world(this.pointer),e.shiftKey);return;}
      if(e.button===0){this.down=local(e);this.dragging=false;canvas.setPointerCapture(e.pointerId);}
    });
    canvas.addEventListener('pointermove',e=>{
      this.pointer=local(e);renderer.pointer=renderer.world(this.pointer);if(this.down&&distance(this.down,this.pointer)>6)this.dragging=true;
      if(this.down&&this.dragging)renderer.box={from:this.down,to:this.pointer};
    });
    canvas.addEventListener('pointerup',e=>{
      if(e.button!==0||!this.down)return;const p=local(e);
      if(this.dragging){
        const a=renderer.world(this.down),b=renderer.world(p);if(!e.shiftKey)renderer.selected.clear();renderer.selectedBase=null;
        for(const u of renderer.game.units)if(u.owner===0&&u.x>=Math.min(a.x,b.x)&&u.x<=Math.max(a.x,b.x)&&u.y>=Math.min(a.y,b.y)&&u.y<=Math.max(a.y,b.y))renderer.selected.add(u.id);
      }else if(renderer.attackMode){this.order(renderer.world(p),e.shiftKey);renderer.attackMode=false;canvas.classList.remove('attack');}
      else this.select(renderer.world(p),e.shiftKey);
      renderer.box=null;this.down=null;this.dragging=false;this.onSelection();
    });
    canvas.addEventListener('pointercancel',()=>{this.down=null;renderer.box=null;this.dragging=false;});
    canvas.addEventListener('pointerleave',()=>{this.pointer=null;});
    canvas.addEventListener('dblclick',e=>{
      const p=renderer.world(local(e));if(!renderer.game.units.some(u=>u.owner===0&&distance(u,p)<40/renderer.camera.zoom))return;
      renderer.selectedBase=null;for(const u of renderer.game.units){const s=renderer.screen(u);if(u.owner===0&&s.x>0&&s.y>0&&s.x<renderer.width&&s.y<renderer.height)renderer.selected.add(u.id);}this.onSelection();
    });
    canvas.addEventListener('wheel',e=>{e.preventDefault();renderer.zoom(e.deltaY,local(e));},{passive:false});
    const miniMove=(e:PointerEvent)=>{const r=mini.getBoundingClientRect();renderer.camera.x=(e.clientX-r.left)/r.width*RULES.worldSize;renderer.camera.y=(e.clientY-r.top)/r.height*RULES.worldSize;renderer.boundCamera();};
    mini.addEventListener('pointerdown',e=>{if(e.button!==0)return;this.miniDragging=true;mini.setPointerCapture(e.pointerId);miniMove(e);});
    mini.addEventListener('pointermove',e=>{if(this.miniDragging)miniMove(e);});
    mini.addEventListener('pointerup',()=>{this.miniDragging=false;});mini.addEventListener('pointercancel',()=>{this.miniDragging=false;});
    window.addEventListener('keydown',e=>{
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||document.querySelector('dialog[open]'))return;
      const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright','f5','f9'].includes(key))e.preventDefault();
      if(e.repeat)return;
      if(key===' '){this.onPause();return;}
      if(key==='s'&&renderer.selected.size){renderer.game.stop([...renderer.selected]);this.notify('Einheiten halten die Position.');this.keys.add(key);this.commandHeld.set(key,performance.now());return;}
      if(key==='a'&&renderer.selected.size){renderer.attackMode=true;canvas.classList.add('attack');this.onSelection();this.keys.add(key);this.commandHeld.set(key,performance.now());return;}
      if(key==='escape'){if(!renderer.selected.size&&renderer.selectedBase===null&&!renderer.attackMode){this.onMenu();return;}renderer.selected.clear();renderer.selectedBase=null;renderer.attackMode=false;canvas.classList.remove('attack');this.onSelection();}
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
    const unit=g.units.filter(u=>u.owner===0&&distance({x:u.x,y:u.y-(unitSpec(u).flying?55:18)},p)<Math.max(32/r.camera.zoom,unitSpec(u).width*.5)).sort((a,b)=>distance(a,p)-distance(b,p))[0];
    if(!append)r.selected.clear();r.selectedBase=null;
    if(unit){if(append&&r.selected.has(unit.id))r.selected.delete(unit.id);else r.selected.add(unit.id);}
    else {const b=g.bases.find(b=>{const spec=buildingSpec(b);return b.owner===0&&b.hp>0&&p.x>b.x-spec.width/2&&p.x<b.x+spec.width/2&&p.y>b.y-spec.width*.85&&p.y<b.y+spec.radius*.5;});if(b)r.selectedBase=b.id;}
  }
  order(p:Point,append=false):void {
    const r=this.renderer,g=r.game;
    if(r.selectedBase!==null){const b=g.bases.find(b=>b.id===r.selectedBase&&b.owner===0&&b.hp>0);if(b){b.rally=g.world.nearest(p,g.obstacles());this.notify('Sammelpunkt gesetzt.');}return;}
    if(!r.selected.size)return;
    const enemy=[...g.units,...g.bases].find(e=>e.owner!==0&&e.hp>0&&g.canSee(0,e)&&distance(e,p)<('queue' in e?100:40)/r.camera.zoom);
    const kind=enemy?'attack':r.attackMode?'attackMove':'move';
    const count=g.command([...r.selected],{...p,kind,target:enemy?.id},append);
    if(count){r.marker={point:p,life:.8,attack:kind!=='move'};this.onOrder(kind!=='move');}
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
    if(this.pointer&&!this.down){if(this.pointer.x<edge)dx--;if(this.pointer.x>r.width-edge)dx++;if(this.pointer.y<edge)dy--;if(this.pointer.y>r.height-edge)dy++;}
    r.camera.x+=dx*speed;r.camera.y+=dy*speed;r.boundCamera();
  }
}
