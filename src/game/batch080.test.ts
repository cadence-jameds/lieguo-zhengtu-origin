import {it,expect,vi,afterEach} from 'vitest';
import {newGame,terrainAt} from './legacyWorld';
import {node,faction,command,advance,marchDuration} from './legacyEngine';
import {emptyTroops,type Game,type Building} from './legacyTypes';
import {stateHash} from './legacyPersistence';
import {townSceneArt} from './TownScene';
const setup=()=>{const g=newGame('civ_frankia',802,1,0);g.events=g.events.filter(e=>e.type==='pulse');g.sandbox=true;return g;};
const home=(g:Game)=>node(g,faction(g,g.player).capital);
function build(g:Game,b:Building){const n=home(g);expect(command(g,{type:'build',city:n.id,building:b})).toBe('');advance(g,n.build.at(-1)!.at);}
it('前置已排入就能排民居及兵營，仍依序施工且兵營未完工不能招募',()=>{
 const g=setup(),n=home(g);
 for(const b of ['farm','lumber','quarry'] as const)expect(command(g,{type:'build',city:n.id,building:b})).toBe('');
 expect(command(g,{type:'build',city:n.id,building:'house'})).not.toBe('');advance(g,30000);
 expect(command(g,{type:'build',city:n.id,building:'mine'})).toBe('');advance(g,60000);
 expect(n.buildings.mine).toBe(0);expect(command(g,{type:'build',city:n.id,building:'house'})).toBe('');advance(g,90000);
 expect(n.buildings.house).toBe(0);expect(command(g,{type:'build',city:n.id,building:'barracks'})).toBe('');
 expect(command(g,{type:'train',city:n.id,unit:'spear',count:1})).toContain('兵營');
 const until=n.build.at(-1)!.at;advance(g,until);expect(n.buildings.barracks).toBe(1);expect(n.buildings.house).toBe(1);
 expect(command(g,{type:'train',city:n.id,unit:'spear',count:1})).toBe('');
});
it('黑暗可修木牆；三時代背景各有對應防線',()=>{const g=setup(),n=home(g);for(const b of ['farm','lumber','quarry','mine','house'] as const)build(g,b);expect(command(g,{type:'build',city:n.id,building:'wall'})).toBe('');expect(faction(g,g.player).era).toBe(0);expect(townSceneArt(1,0)).toContain('dark-wood');expect(townSceneArt(1,1)).toContain('feudal-stone');expect(townSceneArt(1,2)).toContain('scene-stone');});
it('斥候只可偵察，其他任務在下令端拒絕且不修改世界',()=>{const g=setup(),n=home(g),target=g.nodes.find(n=>n.kind==='camp')!,t={...emptyTroops(),scout:1};for(const kind of ['raid','occupy','reinforce','transport','settle'] as const){const before=stateHash(g);expect(command(g,{type:'march',from:n.id,to:target.id,kind,troops:t})).toContain('斥候');expect(stateHash(g)).toBe(before);}expect(command(g,{type:'march',from:n.id,to:target.id,kind:'scout',troops:t})).toBe('');});
it('平地民兵每格 15 秒，無下限，存檔內既有 ETA 不變',()=>{const g=setup(),n=home(g);let x=n.x+1,y=n.y;while(terrainAt(x,y,g.seed)!=='grass'&&terrainAt(x,y,g.seed)!=='field')x++;const to={...n,x,y};const from={...n,x:x-1};expect(marchDuration(g,from,to,{...emptyTroops(),militia:1},'raid')).toBe(15000);});
afterEach(()=>vi.unstubAllGlobals());
