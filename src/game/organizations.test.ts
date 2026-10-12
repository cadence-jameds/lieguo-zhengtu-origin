import {expect,it} from 'vitest';
import {newGame} from './legacyWorld';
import {command,diplomacyLeader,faction,relation} from './legacyEngine';
import {empireFor} from './organizations';
import {buildInfluence} from './influence';
import {updateLeaderboard} from './realmSystems';
import {decode,envelope,validate} from './legacyPersistence';

function twoLeagues(){
 const g=newGame('civ_zhongguo',9184,1,0),[founder,first,second,otherLeader,otherMember]=g.factions;
 founder.era=2;otherLeader.era=1;
 expect(command(g,{type:'empire',mode:'direct'},founder.id)).toContain('軍團');
 expect(command(g,{type:'league',action:'create'},founder.id)).toBe('');
 for(const f of [first,second])expect(command(g,{type:'league',action:'join',target:founder.id},f.id)).toBe('');
 for(const n of g.nodes.filter(n=>n.kind==='ruins').slice(0,5)){n.kind='village';n.owner=first.id;}
 expect(command(g,{type:'empire',mode:'federal'},founder.id)).toBe('');
 expect(command(g,{type:'league',action:'create'},otherLeader.id)).toBe('');
 expect(command(g,{type:'league',action:'join',target:otherLeader.id},otherMember.id)).toBe('');
 return {g,founder,first,second,otherLeader,otherMember};
}

it('an empire requires a founding league; several leagues retain their own cities and join one empire',()=>{
 const {g,founder,first,otherLeader,otherMember}=twoLeagues();
 const ownership=g.nodes.map(n=>n.owner);
 expect(command(g,{type:'empire',action:'join',target:founder.id},otherLeader.id)).toBe('');
 expect(empireFor(g,otherMember.id)).toBe(founder.id);
 expect(diplomacyLeader(g,otherMember.id)).toBe(founder.id);
 expect(relation(g,first.id,otherMember.id)).toBe('alliance');
 expect(command(g,{type:'diplomacy',target:otherMember.id,action:'war'},founder.id)).not.toBe('');
 expect(g.leaderboard?.empires.find(r=>r.id===founder.id)).toMatchObject({members:5,cities:10});
 expect(buildInfluence(g).cells.some(c=>c.x===g.nodes.find(n=>n.owner===otherLeader.id)!.x&&c.y===g.nodes.find(n=>n.owner===otherLeader.id)!.y&&c.owner===founder.id)).toBe(true);
 expect(g.nodes.map(n=>n.owner)).toEqual(ownership);
 const saved=decode(envelope(g));expect(empireFor(saved,otherMember.id)).toBe(founder.id);validate(saved);
});

it('leadership transfer keeps a league in its empire; dissolution preserves each league and its holdings',()=>{
 const {g,founder,otherLeader,otherMember}=twoLeagues();
 expect(command(g,{type:'empire',action:'join',target:founder.id},otherLeader.id)).toBe('');
 const ownership=g.nodes.map(n=>n.owner);
 expect(command(g,{type:'league',action:'disband'},founder.id)).toContain('先解散帝國');
 expect(command(g,{type:'league',action:'leave'},otherLeader.id)).toBe('');
 expect(otherMember.league).toBe(otherMember.id);
 expect(otherMember.empireId).toBe(founder.id);
 expect(otherLeader.league).toBeNull();
 expect(command(g,{type:'empire',action:'dissolve'},otherMember.id)).not.toBe('');
 expect(command(g,{type:'empire',action:'dissolve'},founder.id)).toBe('');
 expect(empireFor(g,otherMember.id)).toBeNull();
 expect(founder.league).toBe(founder.id);
 expect(otherMember.league).toBe(otherMember.id);
 expect(g.leaderboard?.empires).toHaveLength(0);
 expect(g.nodes.map(n=>n.owner)).toEqual(ownership);
 expect(command(g,{type:'league',action:'disband'},otherMember.id)).toBe('');
 expect(otherMember.league).toBeNull();validate(g);
});

it('a member league may leave an empire without dissolving the founding league',()=>{
 const {g,founder,otherLeader,otherMember}=twoLeagues();
 expect(command(g,{type:'empire',action:'join',target:founder.id},otherLeader.id)).toBe('');
 expect(command(g,{type:'empire',action:'leave'},otherLeader.id)).toBe('');
 expect(otherMember.league).toBe(otherLeader.id);
 expect(empireFor(g,otherMember.id)).toBeNull();
 expect(faction(g,founder.id).empire).toBe('federal');validate(g);
});

it('older imperial saves gain a founding league without losing cities',()=>{
 const g=newGame('civ_zhongguo',9185,1,0),founder=faction(g,g.player);
 founder.empire='direct';
 const ownership=g.nodes.map(n=>n.owner),restored=decode(envelope(g));
 expect(faction(restored,founder.id)).toMatchObject({league:founder.id,empireId:founder.id});
 expect(restored.nodes.map(n=>n.owner)).toEqual(ownership);
 restored.leaderboard=undefined;updateLeaderboard(restored);
 expect(restored.leaderboard).toMatchObject({empires:[expect.objectContaining({id:founder.id,members:1})]});
});
