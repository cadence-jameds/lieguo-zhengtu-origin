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
 const ctx={save:vi.fn(),restore:vi.fn(),translate:vi.fn(),scale:vi.fn(),setLineDash:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),arc:vi.fn(),fill:vi.fn(),fillRect:vi.fn(),fillText:vi.fn(),lineWidth:1,strokeStyle:'#aaa',stroke(){strokes.push({style:this.strokeStyle,width:this.lineWidth});}};
 const cache=new CivilianCache(),cam={x:0,y:0,z:zoom};
 const screen=(p:typeof path[number])=>{const q=project(p);return {x:offScreen?-1000:q.x*zoom+160,y:q.y*zoom+100};};
 const result=paintCivilians(ctx as unknown as CanvasRenderingContext2D,w,45000,cam,320,200,screen,cache);
 return {ctx,result,strokes};
}
it('adds a dark casing, coral dashed route and cart silhouette to visible war logistics at 55%',()=>{
 const {ctx,result,strokes}=render();
 expect(result).toMatchObject({markers:1,animated:true,cacheSize:1,misses:1});
 expect(strokes.slice(0,2)).toEqual([{style:'#321b1b',width:4.5/.55},{style:'#ffab8c',width:2.25/.55}]);
 expect(ctx.setLineDash).toHaveBeenCalledWith([8/.55,5/.55]);
 expect(ctx.arc.mock.calls[0][2]).toBe(7);
 expect(ctx.fillRect).toHaveBeenCalledTimes(1);
 expect(ctx.fillText).not.toHaveBeenCalled();
 expect(ctx.save).toHaveBeenCalledTimes(2);
 expect(ctx.restore).toHaveBeenCalledTimes(2);
});
it('respects existing display culling and keeps a compact mark at distant zoom',()=>{
 expect(render(enemy,.55,true,true).result.markers).toBe(0);
 const {ctx,strokes}=render(enemy,.18);
 expect(ctx.arc.mock.calls[0][2]).toBe(4);
 expect(ctx.fillRect).not.toHaveBeenCalled();
 expect(strokes[1].width*.18).toBeCloseTo(2.25);
});
it('does not restyle other civilian routes, including enemy settlers and own merchants',()=>{
 for(const [owner,merchant,style] of [[enemy,false,'#f0786d88'],[playerFactionId,true,'#e6c46b88'],[friend,true,'#69cb7e88'],[neutral,true,'#bec1b788']] as const){
  const {ctx,strokes}=render(owner,.55,merchant);
  expect(strokes[0]).toEqual({style,width:1.5/.55});
  expect(ctx.setLineDash).toHaveBeenCalledWith([5/.55,5/.55]);
  expect(ctx.fillRect).not.toHaveBeenCalled();
  expect(ctx.fillText.mock.calls.length).toBe(owner===playerFactionId?1:0);
 }
});
it('uses the same cached native canvas path for both strokes',()=>{
 class TestPath {moveTo(){} lineTo(){}}
 vi.stubGlobal('Path2D',TestPath);
 try{const {ctx,result}=render();expect(result.markers).toBe(1);expect(ctx.lineTo).not.toHaveBeenCalled();}
 finally{vi.unstubAllGlobals();}
});
