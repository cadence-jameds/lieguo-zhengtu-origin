import {it,expect} from 'vitest';
import {visibleMapNode,mapNodeSize} from './mapRelations';
import type {Node} from './types';
it('overview hides wild sites while retaining cities, including selected targets and political mode',()=>{
 const city={kind:'capital'} as Node,resource={kind:'camp',npcResource:'wood'} as Node,camp={kind:'camp'} as Node;
 for(const z of [.12,.13,.2,.22]){expect(visibleMapNode(city,false,z)).toBe(true);for(const n of [resource,camp])expect(visibleMapNode(n,false,z)).toBe(false);}
 for(const z of [.23,.5,.75,1,2])for(const n of [resource,camp]){expect(visibleMapNode(n,false,z)).toBe(true);expect(visibleMapNode(n,true,z)).toBe(false);}
 expect(visibleMapNode({...camp,respawnAt:1},false,1)).toBe(false);
});
it('resource visible art stays smaller than the smallest capital artwork at all zooms',()=>{
 // Measured alpha bounds: largest resource width .977 / height .703;
 // smallest capital width .824 / height .628 across all six cultures and three eras.
 let previous=0;
 for(let z=.23;z<=2;z+=.01){const city=mapNodeSize(true,z),wild=mapNodeSize(false,z);expect(wild).toBeGreaterThanOrEqual(previous);previous=wild;expect(wild*3.4*.977).toBeLessThan(city*3.8*.824);expect(wild*4.53*.703).toBeLessThan(city*3.8*.628);}
});
