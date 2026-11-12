import {expect,it} from 'vitest';
import {overlaps,shieldPlacement} from './protectionPlacement';
it.each([320,390,1440])('keeps a %spx overlay inside usable bounds and away from actual controls',width=>{
 const bounds={left:10,top:160,right:width-10,bottom:700},button={left:width-110,top:650,right:width-10,bottom:700},gear={left:width-54,top:400,right:width-10,bottom:444};
 const p=shieldPlacement(bounds,84,28,[{left:width-94,top:672}],[button,gear]),box={...p,right:p.left+84,bottom:p.top+28};expect(p.left).toBeGreaterThanOrEqual(bounds.left);expect(box.right).toBeLessThanOrEqual(bounds.right);expect(p.top).toBeGreaterThanOrEqual(bounds.top);expect(box.bottom).toBeLessThanOrEqual(bounds.bottom);expect(overlaps(box,button)).toBe(false);expect(overlaps(box,gear)).toBe(false);
});
it('preserves the requested scene anchor when unobstructed and moves when a floating control occupies it',()=>{
 const bounds={left:10,top:160,right:380,bottom:778},preferred={left:116,top:346};expect(shieldPlacement(bounds,84,28,[preferred],[])).toEqual(preferred);
 const obstacle={...preferred,right:200,bottom:374},p=shieldPlacement(bounds,84,28,[preferred],[obstacle]);expect(p).not.toEqual(preferred);expect(overlaps({...p,right:p.left+84,bottom:p.top+28},obstacle)).toBe(false);
});

it('finds a narrow interior space when the perimeter is occupied, without covering resource controls',()=>{
 const bounds={left:0,top:0,right:320,bottom:400},obstacles=[{left:0,top:0,right:20,bottom:400},{left:300,top:0,right:320,bottom:400},{left:0,top:0,right:320,bottom:100},{left:0,top:300,right:320,bottom:400}];
 const p=shieldPlacement(bounds,84,28,[{left:0,top:0}],obstacles),box={...p,right:p.left+84,bottom:p.top+28};
 expect(p.left).toBeGreaterThanOrEqual(24);expect(p.top).toBeGreaterThanOrEqual(104);expect(obstacles.some(b=>overlaps(box,b))).toBe(false);
});
