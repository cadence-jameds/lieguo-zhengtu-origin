import {it,expect} from 'vitest';
import {cultureName,uniqueCultureName} from './cultureNames';
import {createFormalWorld,CIVILIZATIONS} from './generator';
it('new campaigns have unique cultural lord and city names while preserving seed geometry',()=>{
 for(const seed of [0,90217,4294967295]){const w=createFormalWorld({campaign:'names-'+seed,seed,name:'李承遠'});expect(new Set(w.factions.map(f=>f.name)).size).toBe(100);expect(new Set(w.cities.map(c=>c.name)).size).toBe(100);expect(w.factions[0].name).toBe('李承遠');const same=createFormalWorld({campaign:'names-copy-'+seed,seed,name:'李承遠'});expect(same.cities.map(c=>[c.name,c.x,c.y])).toEqual(w.cities.map(c=>[c.name,c.x,c.y]));}
});
it('every civilization supports 1000 city names and 200 lord names without numeric suffixes',()=>{
 for(const civ of CIVILIZATIONS){for(const [kind,count] of [['city',1000],['lord',200]] as const){const used=new Set<string>();for(let i=0;i<count;i++){const name=uniqueCultureName(civ,i,kind,used);expect(name).not.toMatch(/\d/);expect(name.length).toBeLessThanOrEqual(24);used.add(name);}expect(used.size).toBe(count);}const old=cultureName(civ,1);expect(uniqueCultureName(civ,1,'lord',[old])).not.toBe(old);}
});
