import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {paintRouteStroke} from './mapRouteStyle';
import {drawPoliticalLabels,drawPoliticalOverlay} from './mapRelations';

it('uses 1.5 px of color + a 2.7 px casing at every zoom and on the same path',()=>{
 for(const zoom of [.18,.4,.75,1.6])for(const hostile of [false,true]){
  const ticks:{width:number;style:string;path?:Path2D}[]=[];
  const ctx={save:vi.fn(),restore:vi.fn(),setLineDash:vi.fn(),lineWidth:0,strokeStyle:'',stroke(path?:Path2D){ticks.push({width:this.lineWidth*zoom,style:this.strokeStyle,path});}};
  const p={} as Path2D;
  paintRouteStroke(ctx as unknown as CanvasRenderingContext2D,p,zoom,'#69cb7e',hostile);
  expect(ticks.map(x=>x.style)).toEqual(['#1a231ee0','#69cb7e']);
  expect(ticks[0].width).toBeCloseTo(2.7);expect(ticks[1].width).toBeCloseTo(1.5);
  expect(ticks.every(x=>x.path===p)).toBe(true);
  expect(ctx.setLineDash).toHaveBeenCalledExactlyOnceWith([(hostile?8:5)/zoom,5/zoom]);
  expect(ctx.restore).toHaveBeenCalledTimes(1);
 }
});

it('leaves the ground layer separate, keeps the old zoom rule and draws names above map entities',()=>{
 const ctx={save:vi.fn(),restore:vi.fn(),beginPath:vi.fn(),stroke:vi.fn(),strokeText:vi.fn(),fillText:vi.fn()};
 const influence={cells:[],edges:[],labels:[{name:'帝國',color:'#fff',x:20,y:15}]};
 const screen=(p:{x:number;y:number})=>p;
 drawPoliticalOverlay(ctx as unknown as CanvasRenderingContext2D,influence,screen);
 expect(ctx.fillText).not.toHaveBeenCalled();
 drawPoliticalLabels(ctx as unknown as CanvasRenderingContext2D,influence,screen,{width:400,height:300,zoom:.7});
 expect(ctx.fillText).not.toHaveBeenCalled();
 drawPoliticalLabels(ctx as unknown as CanvasRenderingContext2D,influence,screen,{width:400,height:300,zoom:.69});
 expect(ctx.fillText).toHaveBeenCalledExactlyOnceWith('帝國',20,15);
 const world=readFileSync(new URL('../FormalWorldMap.tsx',import.meta.url),'utf8');
 expect(world.indexOf('drawPoliticalOverlay(ctx')).toBeLessThan(world.indexOf('layers.sort'));
 expect(world.indexOf('drawPoliticalLabels(ctx')).toBeGreaterThan(world.lastIndexOf('paintBattleMarker(ctx'));
});
