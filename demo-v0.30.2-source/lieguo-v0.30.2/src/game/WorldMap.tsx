import {showMapCaption} from './mapDisplay';
import {sessionTerrain,mapImage,terrainOverview} from './mapSession';
import {flatProject,flatInverse,mapProject,mapInverse,traceTile,mapGlyphSize} from './mapProjection';
import {tileReason} from './settlement';
import {fieldCounts,fieldsAt} from './resourceFields';
import {buildInfluence,influenceKey} from './influence';
import {MapFloatPanel} from './MapFloatPanel';
import {terrainChunks,CHUNK_ORIGIN_X,CHUNK_WIDTH,CHUNK_HEIGHT} from './terrainCache';
import { roadNetwork } from './travel';
import {knownOwner} from './intelligence';
import { useEffect, useRef, useState } from 'react';
import { mapColors, mapRelation, mapMarkerSize, visibleMapNode, mapNodeSize, isMapCity } from './mapRelations';
import { faction, node, protectedFaction } from './engine';
import { siteArtIndex, siteLevel } from './npc';
import { eraAtlas,eraBounds } from './assets';
import { cultureId,civilizations } from '../content/civilizations';
import { SIZE,terrainAt } from './world';
import {drawWorldScenery,pumpScenery,resetSceneryRequests} from './worldScenery';
import {sceneryNodeKey} from './sceneryPlacement';
import type { Game, Point, Node } from './types';
type Props={game:Game;selected:string;focus:string;focusTick:number;favoriteFocus:{point:Point;tick:number}|null;favorites:Point[];onFavorite:(action:'add'|'remove',at:Point)=>void;onFavoriteFocus:(point:Point)=>void;onSelect:(id:string)=>void;onTile:(p:Point)=>void;selectedTile:Point|null};
const inverse=flatInverse;
export default function WorldMap({game,selected,focus,focusTick,favoriteFocus,favorites,onFavorite,onFavoriteFocus,onSelect,onTile,selectedTile}:Props){
  const ref=useRef<HTMLCanvasElement>(null), latest=useRef({game,selected,onSelect,onTile,selectedTile});
  latest.current={game,selected,onSelect,onTile,selectedTile};
  const camera=useRef({x:0,y:0,z:.75}), redraw=useRef(()=>{});
  const [toolsOpen,setToolsOpen]=useState(false),[xyOpen,setXyOpen]=useState(false),[favoritesOpen,setFavoritesOpen]=useState(false),[x,setX]=useState("128"),[y,setY]=useState("128"),[xyError,setXyError]=useState(""),[territory,setTerritory]=useState(false);
  const gridRef=useRef(true),territoryRef=useRef(territory),flash=useRef<{point:Point;until:number}|null>(null);territoryRef.current=territory;
  const [labels,setLabels]=useState(()=>{try{return localStorage.getItem('guozhan-map-labels-v0302')==='shown';}catch{return false;}});
  const labelsRef=useRef(labels);labelsRef.current=labels;
  useEffect(()=>{try{localStorage.setItem('guozhan-map-labels-v0302',labels?'shown':'hidden');}catch{/* Display preference only. */}},[labels]);
  useEffect(()=>{
    const canvas=ref.current!,ctx=canvas.getContext('2d')!,background=document.createElement('canvas'),bg=background.getContext('2d')!;
    const terrainCache=sessionTerrain(latest.current.game);let lastZoom=camera.current.z,zoomChanged=-Infinity,gesturing=false;
    let w=0,h=0,dpr=1,key='',raf=0,last=0,drag:{x:number;y:number;cx:number;cy:number;distance:number}|null=null;
    const image=(path:string)=>mapImage(import.meta.env.BASE_URL+path);
    const atlases=[0,1,2].map(era=>image(eraAtlas(era)));
    const resourceAtlas=image('art/world-resources.webp'),dome=image('art/protection-dome.webp'),waterArt=image('art/world-water-029.webp'),groundArt=image('art/world-terrain-023.webp'),forestArt=image('art/world-trees-0299.webp'),mountainArt=image('art/world-mountains-0299.webp'),detailArt=image('art/world-details-0299.webp'),bankArt=image('art/world-riverbanks-0301.webp');
    const assets=[waterArt,groundArt,forestArt,mountainArt,detailArt,bankArt];
    const loaded=()=>{if(bankArt.complete&&bankArt.naturalWidth)terrainCache.setBankTexture(bankArt);if(waterArt.complete&&waterArt.naturalWidth)terrainCache.setWaterTexture(waterArt);if(groundArt.complete&&groundArt.naturalWidth)terrainCache.setGroundTexture(groundArt);terrainCache.revision++;redraw.current();};
    assets.forEach(a=>a.addEventListener('load',loaded));loaded();
    const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const project=(p:Point)=>mapProject(p,latest.current.game.seed,latest.current.game.terrainVersion);
    const screen=(p:Point)=>{const q=project(p),c=camera.current;return{x:(q.x-c.x)*c.z+w/2,y:(q.y-c.y)*c.z+h/2};};
    const diamond=(context:CanvasRenderingContext2D,x:number,y:number,hw:number,hh:number)=>{context.beginPath();context.moveTo(x,y-hh);context.lineTo(x+hw,y);context.lineTo(x,y+hh);context.lineTo(x-hw,y);context.closePath();};
    const drawBackground=()=>{
      const c=camera.current,g=latest.current.game;
      const next=[w,h,c.x,c.y,c.z,g.seed,g.terrainVersion,gridRef.current,network.key,sceneryNodeKey(g.nodes),territoryRef.current,gesturing,terrainCache.revision].join(':');if(key===next)return;key=next;terrainCache.beginFrame();resetSceneryRequests();
      bg.setTransform(dpr,0,0,dpr,0,0);bg.imageSmoothingEnabled=true;bg.fillStyle=territoryRef.current?'#b5b5a0':'#29392d';bg.fillRect(0,0,w,h);
      bg.save();bg.beginPath();
      [{x:-50.5,y:-50.5},{x:305.5,y:-50.5},{x:305.5,y:305.5},{x:-50.5,y:305.5}].forEach((p,i)=>{const q=screen(p);if(i)bg.lineTo(q.x,q.y);else bg.moveTo(q.x,q.y);});bg.closePath();bg.clip();
      bg.globalAlpha=territoryRef.current?.70:1;
      bg.drawImage(terrainOverview(g),(-7120-c.x)*c.z+w/2,(-1010-c.y)*c.z+h/2,14240*c.z,7120*c.z);
      const foliageLayers:{image:HTMLCanvasElement;x:number;y:number}[]=[];
      for(const chunk of terrainChunks(c.x,c.y,c.z,w,h)){
        const base=flatProject(chunk),p={x:(base.x-c.x)*c.z+w/2,y:(base.y-c.y)*c.z+h/2},cached=terrainCache.request(chunk.x,chunk.y,g.seed,c.z,dpr,gesturing,g.terrainVersion);
        if(cached){const x=p.x-CHUNK_ORIGIN_X*c.z,y=p.y-64*c.z;bg.drawImage(cached.image,x,y,CHUNK_WIDTH*c.z,CHUNK_HEIGHT*c.z);if(cached.foliage)foliageLayers.push({image:cached.foliage,x,y});}


      }
      for(const layer of foliageLayers)bg.drawImage(layer.image,layer.x,layer.y,CHUNK_WIDTH*c.z,CHUNK_HEIGHT*c.z);
      bg.restore();bg.globalAlpha=1;
      bg.strokeStyle='#dfc18035';bg.lineWidth=1;bg.beginPath();Array.from({length:1025},(_,i)=>{const edge=Math.min(3,Math.floor(i/256)),k=i-edge*256;return edge===0?{x:k-.5,y:-.5}:edge===1?{x:255.5,y:k-.5}:edge===2?{x:255.5-k,y:255.5}:{x:-.5,y:255.5-k};}).forEach((p,i)=>{const q=screen(p);if(i)bg.lineTo(q.x,q.y);else bg.moveTo(q.x,q.y);});bg.stroke();
      bg.globalAlpha=territoryRef.current?.45:1;
      if(forestArt.complete&&forestArt.naturalWidth&&mountainArt.complete&&mountainArt.naturalWidth&&detailArt.complete&&detailArt.naturalWidth)
        drawWorldScenery(bg,{seed:g.seed,version:g.terrainVersion??0,nodes:g.nodes,camera:c,width:w,height:h,forest:forestArt,mountain:mountainArt,details:detailArt,progressive:true,dpr,gesturing});
      bg.globalAlpha=1;
      // Roads sit above all terrain art, below settlements, armies and labels.
      for(const {path,speed} of network.lines){
        bg.beginPath();path.forEach((p,i)=>{const q=screen(p);if(i)bg.lineTo(q.x,q.y);else bg.moveTo(q.x,q.y);});
        bg.strokeStyle='#4d503dbc';bg.lineWidth=Math.max(2,c.z*(speed===2?6:5));bg.stroke();
        bg.strokeStyle=speed===2?'#e0d3aacd':'#cbb079c9';bg.lineWidth=Math.max(1,c.z*(speed===2?3.4:2.5));bg.stroke();
      }


    };
    const visible=(n:Node)=>visibleMapNode(n,false);
    let territoryKey='',influence=buildInfluence(latest.current.game);let hover:{x:number;y:number}|null=null,drawKey='',world:Game|null=null,visibleNodes:Node[]=[],network=roadNetwork(latest.current.game);
    const syncWorld=()=>{if(world!==latest.current.game){world=latest.current.game;visibleNodes=world.nodes.filter(visible).sort((a,b)=>(a.x+a.y)-(b.x+b.y));network=roadNetwork(world);const ik=influenceKey(world);if(ik!==territoryKey){territoryKey=ik;influence=buildInfluence(world);}}};
    const pick=(clientX:number,clientY:number)=>{
      const rect=canvas.getBoundingClientRect(),px=clientX-rect.left,py=clientY-rect.top,c=camera.current;
      const world=mapInverse(c.x+(px-w/2)/c.z,c.y+(py-h/2)/c.z,latest.current.game.seed,latest.current.game.terrainVersion),tile={x:Math.round(world.x),y:Math.round(world.y)};
      const target=visibleNodes.filter(n=>visibleMapNode(n,territoryRef.current,c.z)).map(n=>({n,p:screen(n)})).filter(({n,p})=>{const size=mapNodeSize(isMapCity(n),c.z);return Math.abs(p.x-px)<size*1.8&&py>p.y-size*2.8&&py<p.y+size*.8;}).sort((a,b)=>Math.abs(a.p.x-px)+Math.abs(a.p.y-py)-Math.abs(b.p.x-px)-Math.abs(b.p.y-py))[0]?.n;
      return {target,tile:target?{x:target.x,y:target.y}:tile,blocked:!target&&visibleNodes.some(n=>n.x===tile.x&&n.y===tile.y&&!visibleMapNode(n,territoryRef.current,c.z))};
    };
    const paths=new Map<number,{key:string;path:Path2D;minX:number;maxX:number;minY:number;maxY:number}>();
    const marchPath=(m:Game['marches'][number])=>{const key=[latest.current.game.seed,latest.current.game.terrainVersion,m.started,m.at,m.from,m.to,m.path.length].join(':');const old=paths.get(m.id);if(old?.key===key)return old;const path=new Path2D();let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const [i,p] of m.path.entries()){const q=project(p);if(i)path.lineTo(q.x,q.y);else path.moveTo(q.x,q.y);minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);}const value={key,path,minX,maxX,minY,maxY};paths.set(m.id,value);return value;};
    const draw=(time:number)=>{
      raf=requestAnimationFrame(draw);if(time-last<(reduce?100:30))return;last=time;syncWorld();
      const snapshot=latest.current,gc=camera.current;if(gc.z!==lastZoom){lastZoom=gc.z;zoomChanged=time;}gesturing=time-zoomChanged<140;
      const selectedNode=snapshot.selectedTile?undefined:visibleNodes.find(n=>n.id===snapshot.selected&&visibleMapNode(n,territoryRef.current,gc.z)),selectedPoint=selectedNode?screen(selectedNode):null;
      const selectionPulse=!reduce&&selectedPoint&&selectedPoint.x>-70&&selectedPoint.x<w+70&&selectedPoint.y>-60&&selectedPoint.y<h+60?Math.floor(time/140):0;
      const nextDraw=[terrainCache.revision,snapshot.game.revision,snapshot.game.time,snapshot.selected,snapshot.selectedTile?.x,snapshot.selectedTile?.y,gc.x,gc.y,gc.z,gesturing,w,h,hover?.x,hover?.y,gridRef.current,labelsRef.current,territoryRef.current,flash.current&&time<flash.current.until?time:0,selectionPulse,!!drag,...atlases.map(a=>a.complete),dome.complete,resourceAtlas.complete,snapshot.game.battles.length?Math.floor(time/100):0].join(':');if(nextDraw===drawKey)return;drawKey=nextDraw;drawBackground();
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.drawImage(background,0,0,w,h);
      const {game:g,selected:s,selectedTile:tile}=latest.current,c=camera.current;
      if(territoryRef.current){ctx.save();for(const cell of influence.cells){const p=screen(cell);if(p.x<-50||p.x>w+50||p.y<-30||p.y>h+30)continue;if(terrainAt(cell.x,cell.y,g.seed,g.terrainVersion)==='water')continue;traceTile(ctx,cell,screen);ctx.globalAlpha=.36;ctx.fillStyle=cell.color;ctx.fill();}ctx.globalAlpha=1;
      const corners=[inverse(c.x-w/2/c.z,c.y-h/2/c.z),inverse(c.x+w/2/c.z,c.y-h/2/c.z),inverse(c.x-w/2/c.z,c.y+h/2/c.z+48),inverse(c.x+w/2/c.z,c.y+h/2/c.z+48)];
      const lx=Math.max(-.5,Math.floor(Math.min(...corners.map(p=>p.x)))-.5),hx=Math.min(SIZE-.5,Math.ceil(Math.max(...corners.map(p=>p.x)))+.5),ly=Math.max(-.5,Math.floor(Math.min(...corners.map(p=>p.y)))-.5),hy=Math.min(SIZE-.5,Math.ceil(Math.max(...corners.map(p=>p.y)))+.5);
      ctx.beginPath();ctx.strokeStyle=c.z<.25?'#253b3445':'#253b3460';ctx.lineWidth=.65;
      const stride=c.z<.22?4:c.z<.4?2:1;
      for(let x=lx;x<=hx;x+=stride)for(let y=ly;y<=hy;y+=stride){const p=screen({x,y});if(y===ly)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}
      for(let y=ly;y<=hy;y+=stride)for(let x=lx;x<=hx;x+=stride){const p=screen({x,y});if(x===lx)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.stroke();
      ctx.lineWidth=1.5;ctx.strokeStyle='#273a32';ctx.beginPath();for(const [x,y,x2,y2] of influence.edges){const a=screen({x,y}),b=screen({x:x2,y:y2});if(a.x<-40||a.x>w+40||a.y<-40||a.y>h+40)continue;ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}ctx.stroke();ctx.restore();}
      if(flash.current&&time<flash.current.until){const p=screen(flash.current.point),pulse=reduce?0:Math.sin(time/190)*3;ctx.save();ctx.shadowColor='#fff0a0';ctx.shadowBlur=18;diamond(ctx,p.x,p.y,Math.max(28,33*c.z)+pulse,Math.max(15,19*c.z)+pulse);ctx.lineWidth=4;ctx.strokeStyle='#fff0a0';ctx.stroke();ctx.restore();}
      if(hover&&!drag){const t=pick(hover.x,hover.y).tile;if(t.x>=0&&t.y>=0&&t.x<SIZE&&t.y<SIZE){traceTile(ctx,t,screen);ctx.strokeStyle='#ffffffb0';ctx.lineWidth=1;ctx.setLineDash([3,2]);ctx.stroke();ctx.setLineDash([]);}}
      if(tile){traceTile(ctx,tile,screen);ctx.fillStyle=g.defeat?(tileReason(g,tile)?'#e14e4e99':'#47b67e99'):'#f7d37955';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#ffffff';ctx.stroke();}
      for(const m of g.marches.filter(m=>m.kind==='settle'&&m.status==='outbound')){traceTile(ctx,node(g,m.to),screen);ctx.strokeStyle='#ffffff';ctx.setLineDash([3,3]);ctx.stroke();ctx.setLineDash([]);}

      const glyphs:{x:number;y:number;size:number;text:string;color:string;priority:number;city:boolean}[]=[];
      for(const n of visibleNodes){
        if(!visibleMapNode(n,territoryRef.current,c.z))continue;
        const p=screen(n);if(p.x<-70||p.x>w+70||p.y<-60||p.y>h+60)continue;
        const owner=knownOwner(g,n);const accent=mapColors[mapRelation(g,n)],size=mapNodeSize(isMapCity(n),c.z);
        const city=['capital','village'].includes(n.kind),era=owner?faction(g,owner).era:0,atlas=atlases[era];
        const marker=mapMarkerSize(c.z);diamond(ctx,p.x,p.y,city?marker.width:size*1.2,city?marker.height:size*.55);ctx.globalAlpha=city?.36:.25;ctx.fillStyle=accent;ctx.strokeStyle=accent;ctx.lineWidth=city?2.5:1.5;ctx.fill();ctx.globalAlpha=1;ctx.stroke();
        if(n.id===s&&!tile){
          const pulse=reduce?.7:(Math.sin(time/330)+1)/2;
          ctx.save();ctx.globalAlpha=.4+.6*pulse;ctx.shadowColor='#fff0a0';ctx.shadowBlur=4+18*pulse;
          diamond(ctx,p.x,p.y,(city?marker.width:size*1.2)+3,(city?marker.height:size*.55)+2);
          ctx.strokeStyle='#fff0a0';ctx.lineWidth=2+2*pulse;ctx.stroke();ctx.restore();
        }
        if(city&&atlas.complete&&atlas.naturalWidth){const b=eraBounds(owner?14+Math.max(0,civilizations.findIndex(c=>c.id===cultureId(owner))):0,era);ctx.drawImage(atlas,b.x,b.y,b.w,b.h,p.x-size*1.9,p.y-size*3,size*3.8,size*3.8);}
        if(!city&&resourceAtlas.complete&&resourceAtlas.naturalWidth){const i=siteArtIndex(n),cellW=resourceAtlas.naturalWidth/4,cellH=resourceAtlas.naturalHeight/2;ctx.drawImage(resourceAtlas,(i%4)*cellW,Math.floor(i/4)*cellH,cellW,cellH,p.x-size*1.7,p.y-size*3.1,size*3.4,size*4.53);}
        if(city&&n.owner&&protectedFaction(g,n.owner)&&dome.complete&&dome.naturalWidth){ctx.globalAlpha=.55;ctx.drawImage(dome,p.x-size*2.5,p.y-size*4.15,size*5,size*5);ctx.globalAlpha=1;}
        ctx.fillStyle=accent;ctx.font='bold '+Math.max(12,size)+'px serif';ctx.textAlign='center';ctx.textBaseline='middle';
        if(labelsRef.current)glyphs.push({text:n.npcResource?({wood:'木',food:'糧',stone:'石',gold:'金'}[n.npcResource]):city?(civilizations.find(c=>c.id===cultureId(owner))?.name[0]??'城'):n.kind==='camp'?'寇':n.kind==='iron'?'鐵':n.kind==='horses'?'馬':'',x:p.x,y:p.y-size*.65,size:mapGlyphSize(city,c.z),city,color:accent,priority:n.id===s?3:n.owner===g.player?2:city?1:0});
        if(showMapCaption(city,labelsRef.current,c.z,n.id===s,!!drag)){
          ctx.font='600 12px system-ui';const label='Lv.'+siteLevel(n),tw=ctx.measureText(label).width;
          ctx.fillStyle='#16251ded';ctx.fillRect(p.x-tw/2-5,p.y+size*.4+3,tw+10,20);
          ctx.fillStyle=n.owner===g.player?'#e9dcad':'#e0e3d2';ctx.fillText(label,p.x,p.y+size*.4+13);
        }
      }
      for(const id of paths.keys())if(!g.marches.some(m=>m.id===id))paths.delete(id);
      for(const m of g.marches){
        // Arrived reinforcements are stationed at a city; they are not a clash or an ongoing route.
        if(m.stationed)continue;
        const cached=marchPath(m);if(cached.maxX<c.x-w/2/c.z-15||cached.minX>c.x+w/2/c.z+15||cached.maxY<c.y-h/2/c.z-15||cached.minY>c.y+h/2/c.z+15)continue;
        // All factions' world movements are visible; troop intelligence stays separate.
        const ratio=m.status==='battle'?1:Math.max(0,Math.min(1,(g.time-m.started)/(m.at-m.started))),idx=ratio*(m.path.length-1),a=m.path[Math.floor(idx)],b=m.path[Math.min(m.path.length-1,Math.floor(idx)+1)],pos=screen({x:a.x+(b.x-a.x)*(idx%1),y:a.y+(b.y-a.y)*(idx%1)});
        ctx.strokeStyle=m.owner===g.player?'#efdaa1aa':'#f1856888';ctx.save();ctx.translate(w/2-c.x*c.z,h/2-c.y*c.z);ctx.scale(c.z,c.z);ctx.lineWidth=1.5/c.z;ctx.setLineDash([5/c.z,5/c.z]);ctx.stroke(cached.path);ctx.restore();
        ctx.fillStyle=m.status==='battle'?'#ff7f51':m.kind==='transport'?'#e6c46b':m.owner===g.player?'#f4e5b5':'#f09379';
        ctx.beginPath();ctx.moveTo(pos.x,pos.y-7);ctx.lineTo(pos.x+6,pos.y+5);ctx.lineTo(pos.x-6,pos.y+5);ctx.closePath();ctx.fill();
        if(m.status==='battle'){ctx.strokeStyle='#ffb783';ctx.beginPath();ctx.arc(pos.x,pos.y,10+(reduce?0:Math.sin(time/220)*3),0,Math.PI*2);ctx.stroke();}
      }
      // Draw civilization glyphs after buildings and marching effects, with collision priority.
      if(labelsRef.current){const placed:typeof glyphs=[];ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
       for(const glyph of glyphs.sort((a,b)=>b.priority-a.priority)){
        if(!glyph.text||placed.some(p=>Math.abs(p.x-glyph.x)<(p.size+glyph.size)/2&&Math.abs(p.y-glyph.y)<(p.size+glyph.size)/2))continue;
        placed.push(glyph);ctx.font=`bold ${glyph.size}px serif`;ctx.lineWidth=3;ctx.strokeStyle='#162218';ctx.shadowColor='#10180f';ctx.shadowBlur=3;ctx.shadowOffsetY=1;ctx.strokeText(glyph.text,glyph.x,glyph.y);ctx.fillStyle=glyph.color;ctx.fillText(glyph.text,glyph.x,glyph.y);
       }ctx.restore();
      }
      if(territoryRef.current&&c.z<.7){
        ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 14px serif';
        for(const label of influence.labels){
          const p=screen(label);if(p.x<0||p.x>w||p.y<0||p.y>h)continue;
          ctx.lineWidth=3;ctx.strokeStyle='#132018';ctx.strokeText(label.name,p.x,p.y-12);
          ctx.fillStyle=label.textColor;ctx.fillText(label.name,p.x,p.y-12);
        }
        ctx.restore();
      }
      // A clash icon is painted last so town names and civilization glyphs cannot hide combat.
      const clashes=new Set<string>();
      for(const battle of g.battles){
        if(clashes.has(battle.target))continue;clashes.add(battle.target);
        const target=g.nodes.find(n=>n.id===battle.target);if(!target)continue;const p=screen(target);if(p.x< -40||p.x>w+40||p.y< -40||p.y>h+40)continue;
        const marker=mapNodeSize(isMapCity(target),c.z),scale=Math.max(.45,Math.min(.9,c.z*.85)),swing=reduce?0:Math.sin(time/145)*.23;
        ctx.save();ctx.translate(p.x,p.y-Math.max(19,marker*2.5+11*scale));ctx.scale(scale,scale);
        ctx.fillStyle='#15251fe8';ctx.strokeStyle='#e2be73';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.fill();ctx.stroke();
        for(const side of [-1,1]){ctx.save();ctx.rotate(side*(.7+swing));ctx.strokeStyle='#edf0e2';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,6);ctx.lineTo(0,-12);ctx.stroke();ctx.fillStyle='#edf0e2';ctx.beginPath();ctx.moveTo(-2,-10);ctx.lineTo(0,-15);ctx.lineTo(2,-10);ctx.closePath();ctx.fill();ctx.strokeStyle='#f4c675';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-5,6);ctx.lineTo(5,6);ctx.moveTo(0,6);ctx.lineTo(0,11);ctx.stroke();ctx.restore();}
        if(!reduce){const spark=(Math.sin(time/145)+1)/2;ctx.globalAlpha=.4+.6*spark;ctx.strokeStyle='#fff2af';ctx.lineWidth=1.4;for(let i=0;i<4;i++){const angle=i*Math.PI/2+Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(angle)*4,Math.sin(angle)*4);ctx.lineTo(Math.cos(angle)*(7+spark*3),Math.sin(angle)*(7+spark*3));ctx.stroke();}}
        ctx.restore();
      }
      const groundWork=terrainCache.pump(2,4),sceneryWork=pumpScenery(4);if(groundWork||sceneryWork){key='';drawKey='';}
    };
    const resize=()=>{const rect=canvas.getBoundingClientRect();w=rect.width;h=rect.height;dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=background.width=Math.round(w*dpr);canvas.height=background.height=Math.round(h*dpr);key='';};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    const limit=()=>{const c=camera.current;const p=inverse(c.x,c.y);const q=project({x:Math.max(-50,Math.min(305,p.x)),y:Math.max(-50,Math.min(305,p.y))});c.x=q.x;c.y=q.y;};
    const pointers=new Map<number,{x:number;y:number}>();
    let pinched=false;
    const pair=()=>{const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};};
    const down=(e:PointerEvent)=>{if(e.pointerType==='mouse'&&e.button!==0)return;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>1){pinched=true;drag=null;}else{pinched=false;drag={x:e.clientX,y:e.clientY,cx:camera.current.x,cy:camera.current.y,distance:0};}};
    const move=(e:PointerEvent)=>{
      if(!pointers.has(e.pointerId)){if(e.pointerType==='mouse')hover={x:e.clientX,y:e.clientY};return;}
      hover=null;const before=pointers.size>=2?pair():null;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(before){const after=pair(),c=camera.current,rect=canvas.getBoundingClientRect(),z=Math.max(.12,Math.min(2,c.z*after.d/before.d));c.x+=(before.x-rect.left-w/2)/c.z-(after.x-rect.left-w/2)/z;c.y+=(before.y-rect.top-h/2)/c.z-(after.y-rect.top-h/2)/z;c.z=z;limit();return;}
      if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.distance=Math.max(drag.distance,Math.hypot(dx,dy));camera.current.x=drag.cx-dx/camera.current.z;camera.current.y=drag.cy-dy/camera.current.z;limit();
    };
    const finish=(e:PointerEvent,cancelled=false)=>{
      if(!pointers.has(e.pointerId))return;
      if(!cancelled&&!pinched&&drag&&drag.distance<6){
        const {target,tile,blocked}=pick(e.clientX,e.clientY);if(target){flash.current=null;latest.current.onSelect(target.id);}else if(!blocked&&tile.x>=0&&tile.y>=0&&tile.x<SIZE&&tile.y<SIZE)latest.current.onTile(tile);
      }
      pointers.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);drag=null;
      if(pointers.size===1){const [p]=pointers.values();drag={x:p.x,y:p.y,cx:camera.current.x,cy:camera.current.y,distance:6};}if(!pointers.size)pinched=false;
    };
    const up=(e:PointerEvent)=>finish(e);
    const leave=()=>{hover=null;};
    canvas.addEventListener('pointerleave',leave);
    const cancel=(e:PointerEvent)=>finish(e,true);
    const wheel=(e:WheelEvent)=>{e.preventDefault();const c=camera.current,rect=canvas.getBoundingClientRect(),px=e.clientX-rect.left-w/2,py=e.clientY-rect.top-h/2,z=Math.max(.12,Math.min(2,c.z*Math.exp(-e.deltaY*.001)));c.x+=px/c.z-px/z;c.y+=py/c.z-py/z;c.z=z;};
    const keyboard=(e:KeyboardEvent)=>{const c=camera.current,step=80/c.z;if(e.key==='Enter'){const p=mapInverse(c.x,c.y,latest.current.game.seed,latest.current.game.terrainVersion),tile={x:Math.round(p.x),y:Math.round(p.y)},target=latest.current.game.nodes.find(n=>visibleMapNode(n,territoryRef.current,c.z)&&n.x===tile.x&&n.y===tile.y);if(target){flash.current=null;latest.current.onSelect(target.id);}else if(!latest.current.game.nodes.some(n=>n.x===tile.x&&n.y===tile.y&&!visibleMapNode(n,territoryRef.current,c.z))&&tile.x>=0&&tile.y>=0&&tile.x<SIZE&&tile.y<SIZE)latest.current.onTile(tile);}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','=','Enter'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')c.x-=step;if(e.key==='ArrowRight')c.x+=step;if(e.key==='ArrowUp')c.y-=step;if(e.key==='ArrowDown')c.y+=step;if(e.key==='+'||e.key==='=')c.z=Math.min(2,c.z*1.2);if(e.key==='-')c.z=Math.max(.12,c.z/1.2);limit();};
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',keyboard);
    redraw.current=()=>{key='';drawKey='';};raf=requestAnimationFrame(draw);
    return()=>{assets.forEach(a=>a.removeEventListener('load',loaded));canvas.removeEventListener('pointerleave',leave);cancelAnimationFrame(raf);observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',keyboard);};
  },[game.campaign,game.seed,game.terrainVersion,(game.mountainClearings??[]).map(p=>p.x+','+p.y).join(';')]);
  useEffect(()=>{const target=game.nodes.find(n=>n.id===focus)??node(game,faction(game,game.player).capital);const p=mapProject(target,game.seed,game.terrainVersion);camera.current.x=p.x;camera.current.y=p.y;flash.current=null;redraw.current();},[focus,focusTick,game.seed,game.player,game.campaign]);
  useEffect(()=>{if(!favoriteFocus)return;const p=mapProject(favoriteFocus.point,game.seed,game.terrainVersion);camera.current.x=p.x;camera.current.y=p.y;flash.current={point:favoriteFocus.point,until:performance.now()+2500};redraw.current();},[favoriteFocus?.tick]);
  const change=(z:number)=>{camera.current.z=Math.max(.12,Math.min(2,z));};
  const go=()=>{const point={x:Number(x),y:Number(y)};if(!x||!y||![point.x,point.y].every(v=>Number.isSafeInteger(v)&&v>=0&&v<SIZE)){setXyError('座標須為 0～255 的整數');return;}const p=mapProject(point,game.seed,game.terrainVersion);camera.current.x=p.x;camera.current.y=p.y;flash.current={point,until:performance.now()+2500};setXyError('');setXyOpen(false);};
  const xyForm=<form className="map-float-xy" onSubmit={e=>{e.preventDefault();go();}}><label>X<input aria-label="X 座標" inputMode="numeric" type="number" min={0} max={255} value={x} onChange={e=>setX(e.target.value)}/></label><label>Y<input aria-label="Y 座標" inputMode="numeric" type="number" min={0} max={255} value={y} onChange={e=>setY(e.target.value)}/></label><button type="submit">前往</button>{xyError&&<small role="alert">{xyError}</small>}</form>;
  return <div className="world-map"><canvas ref={ref} tabIndex={0} aria-label="河谷等距棋盤地圖。點選據點查看詳情，點選空白陸地建城。單指拖曳、雙指縮放；電腦可用滾輪、方向鍵與加減鍵，Enter 選擇畫面中央地塊。"/>
    <div className="map-tools map-tools-v8"><button aria-label="放大地圖" onClick={()=>change(camera.current.z*1.3)}>＋</button><button aria-label="縮小地圖" onClick={()=>change(camera.current.z/1.3)}>−</button><button className="map-tool-toggle" aria-label={toolsOpen?'收起地圖工具':'展開地圖工具'} aria-controls="map-extra-tools" aria-expanded={toolsOpen} onClick={()=>setToolsOpen(!toolsOpen)}>⋯</button><div id="map-extra-tools" className={"map-extra-tools "+(toolsOpen?"expanded":"")}><button onClick={()=>{const p=mapProject(node(game,faction(game,game.player).capital),game.seed,game.terrainVersion);camera.current.x=p.x;camera.current.y=p.y;change(.75);}}>首都</button><button onClick={()=>{const p=mapProject({x:128,y:128},game.seed,game.terrainVersion);camera.current.x=p.x;camera.current.y=p.y;change(.13);}}>全區</button><button onClick={()=>{setFavoritesOpen(false);setXyError('');setXyOpen(true);}}>XY<br/>定位</button><button aria-pressed={territory} onClick={()=>setTerritory(!territory)}>{territory?<>關閉<br/>版圖</>:<>帝國<br/>版圖</>}</button><button aria-pressed={labels} onClick={()=>setLabels(!labels)}>{labels?<>隱藏<br/>標示</>:<>顯示<br/>標示</>}</button><button aria-label={`我的最愛 ${favorites.length}/5`} onClick={()=>{setXyOpen(false);setFavoritesOpen(true);}}>★ 最愛<br/>{favorites.length}/5</button></div></div>
    <span className="map-help map-inline-help">{game.defeat?'點選陸地復國・紅色不可選':'點據點查看　點空地建城　△ 行軍中'}</span>{xyOpen&&<MapFloatPanel title="XY 定位" storageKey="xy" onClose={()=>setXyOpen(false)}>{xyForm}</MapFloatPanel>}
    {favoritesOpen&&<MapFloatPanel title={`★ 我的最愛 ${favorites.length}/5`} storageKey="favorites" onClose={()=>setFavoritesOpen(false)}>{favorites.length?<div className="map-favorite-list"><div className="map-favorite-labels" aria-label="糧／木／石／金"><span>糧</span><span>木</span><span>石</span><span>金</span></div>{favorites.map(p=>{const counts=fieldCounts(fieldsAt(game,p)),label=`糧${counts.farm}／木${counts.lumber}／石${counts.quarry}／金${counts.mine}（${p.x}, ${p.y}）`;return <div className="map-favorite-row" key={p.x+','+p.y}><button type="button" className="map-favorite-go" aria-label={label} onClick={()=>{onFavoriteFocus(p);setFavoritesOpen(false);}}><span>{counts.farm}</span><span>{counts.lumber}</span><span>{counts.quarry}</span><span>{counts.mine}</span><span className="map-favorite-coordinate">({p.x}, {p.y})</span></button><button type="button" className="map-favorite-remove" aria-label={'移除 '+label} onClick={()=>onFavorite('remove',p)}>刪除</button></div>;})}</div>:<p className="map-favorite-empty">尚未收藏地塊</p>}</MapFloatPanel>}

  </div>;
}
