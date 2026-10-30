import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {unitArt} from './artMap';
import registry from './artAssets.json';

it('maps only the player-approved Chinese elite successor and preserves Japanese and all other mappings',()=>{
 const before=JSON.parse(readFileSync('docs/art-unification/elite-final-20261030/before/artAssets.json','utf8'));
 const expected=structuredClone(before);expected.units['elite.guard.civ_zhongguo']='art/unified/units/elite.guard.civ_zhongguo.approved-3798a7f.webp';
 expect(registry).toEqual(expected);
 expect(unitArt('elite.guard.civ_zhongguo').path).toBe(expected.units['elite.guard.civ_zhongguo']);
 const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
 expect(sha('public/'+unitArt('elite.guard.civ_zhongguo').path)).toBe('e12b39f6ba3ca10f10028611a892b890c46ac1c173b96a8cb5a0ea39abaf50db');
 expect(sha('docs/art-unification/elite-review-20261029/china-B-kneeling-20261029/china-B-kneeling-512.png')).toBe('80709f92bade96fe285617b56a138ec8604c07d80ad6653b6ac499251b70a30b');
 expect(unitArt('guard.civ_zhongguo').path).toBe('art/catalog-guards.webp');
 expect(unitArt('elite.guard.civ_japan').path).toBe(before.units['elite.guard.civ_japan']);
});
