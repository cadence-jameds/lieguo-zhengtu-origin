import {expect,it,vi} from 'vitest';
import type {WorldRead} from '../presentationModel';
import {initialPolitics} from '../formal/politics';
import {factionId} from '../formal/ids';
import {CivilianCache,paintCivilians} from './civilianOverlay';
import {project} from './mapGeometry';

const playerFactionId=factionId('player'),enemy=factionId('enemy'),friend=factionId('friend'),neutral=factionId('neutral');
const path=[{x:0,y:0},{x:1,y:0},{x:2,y:0}];
function render(owner=enemy,zoom=.55,merchant=true,offScreen=false){
 const politics=initialPolitics();
 politics.relations=[{a:playerFactionId,b:enemy,state:'war'},{a:playerFactionId,b:friend,state:'friendly'}] as typeof politics.relations;
 const w={playerFactionId,politics,logistics:merchant?[{sourceFactionId:owner,path,shipmentId:'shipment:x',phase:'outbound',dispatchedAt:0,arrivalAt:90000}]:[],settlements:merchant?[]:[{ownerFactionId:owner,path,projectId:'project:x',phase:'travelling',distance:2,arrivalAt:90000}]} as unknown as WorldRead;
 const strokes:{style:string;width:number}[]=[];
 const ctx={save:vi.fn(),restore:vi.fn(),translate:vi.fn(),scale:vi.fn(),setLineDash:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),closePath:vi.fn(),rect:vi.fn(),rotate:vi.fn(),arc:vi.fn(),fill:vi.fn(),fillRect:vi.fn(),fillText:vi.fn(),lineWidth:1,strokeStyle:'#aaa',stroke(){strokes.push({style:this.strokeStyle,width:this.lineWidth});}};
 const cache=new CivilianCache(),cam={x:0,y:0,z:zoom};
 const screen=(p:typeof path[number])=>{const q=project(p);return {x:offScreen?-1000:q.x*zoom+160,y:q.y*zoom+100};};
 const result=paintCivilians(ctx as unknown as CanvasRenderingContext2D,w,45000,cam,320,200,screen,cache);
 return {ctx,result,strokes};
}
it('keeps a thin coral line over the common dark casing and the original cart silhouette to visible war logistics at 55%',()=>{
 const {ctx,result,strokes}=render();
 expect(result).toMatchObject({markers:1,animated:true,cacheSize:1,misses:1});
 expect(strokes.slice(0,2)).toEqual([{style:'#1a231ee0',width:2.7/.55},{style:'#ffab8c',width:1.5/.55}]);
 expect(strokes).toHaveLength(3); // casing, color, and marker
 expect(ctx.setLineDash).toHaveBeenCalledWith([8/.55,5/.55]);
 expect(ctx.arc.mock.calls[0][2]).toBe(7);
 expect(ctx.fillRect).toHaveBeenCalledExactlyOnceWith(-3,-3.5,6,4);
 expect(ctx.fillText).not.toHaveBeenCalled();
 expect(ctx.restore.mock.calls.length).toBe(ctx.save.mock.calls.length);
});
it('respects existing display culling and keeps a compact mark at distant zoom',()=>{
 expect(render(enemy,.55,true,true).result.markers).toBe(0);
 const {ctx,strokes}=render(enemy,.18);
 expect(ctx.arc.mock.calls[0][2]).toBe(4);
 expect(ctx.fillRect).not.toHaveBeenCalled();
 expect(strokes[0].width*.18).toBeCloseTo(2.7);
 expect(strokes[1].width*.18).toBeCloseTo(1.5);
 expect(strokes).toHaveLength(3);
});
it('uses the existing caravan glyph for all near merchants and appropriate colored paths',()=>{
 for(const [owner,merchant,style] of [[enemy,false,'#f0786d'],[playerFactionId,true,'#e6c46b'],[friend,true,'#69cb7e'],[neutral,true,'#bec1b7']] as const){
  const {ctx,strokes}=render(owner,.55,merchant);
  expect(strokes.slice(0,2)).toEqual([{style:'#1a231ee0',width:2.7/.55},{style,width:1.5/.55}]);
  expect(ctx.setLineDash).toHaveBeenCalledWith([5/.55,5/.55]);
  expect(ctx.fillRect).toHaveBeenCalledTimes(merchant?1:0);
  expect(ctx.fillText).not.toHaveBeenCalled();
  expect(ctx.closePath).toHaveBeenCalledTimes(merchant?0:1);
 }
});
it('uses the same cached native canvas path for both route strokes',()=>{
 class TestPath {moveTo(){} lineTo(){}}
 vi.stubGlobal('Path2D',TestPath);
 try{const {ctx,result}=render();expect(result.markers).toBe(1);expect(ctx.lineTo).not.toHaveBeenCalled();}
 finally{vi.unstubAllGlobals();}
});
