import {upgradeMountains} from './mountainRules';
import {initializeWildSites} from './wildSpawns';
import {importantMessage} from './messages';
import {reportCategory,type ReportTab} from './progress';
import {RELEASE} from './release';
import {normalizeOrganizations} from './organizations';
import {repairWaterCities,terrainAt} from './legacyWorld';
import {travelRoute} from './travel';
import {detectDefeat} from './legacyEngine';
import { normalizeCityNames } from './cityNames';
import { upgradeBatch } from './progress';
import { plotAccepts,repeatableBuilding } from './city';
import Dexie, { type Table } from 'dexie';
import { z } from 'zod';
import { CONTENT, SCHEMA, MINUTE, resources, unitIds, buildingIds, type Game, type Report } from './legacyTypes';
import { cultureId,civilizations } from '../content/civilizations';
const nonnegative = z.number().finite().min(0).max(1e14);
const integer = nonnegative.int();
const stockSchema = z.object(Object.fromEntries(resources.map(k=>[k,nonnegative])) as Record<typeof resources[number],typeof nonnegative>);
const troopSchema = z.object(Object.fromEntries(unitIds.map(k=>[k,integer.max(1e7)])) as Record<typeof unitIds[number],typeof integer>);
const levels = z.object(Object.fromEntries(buildingIds.map(k=>[k,z.number().int().min(0).max(5).default(0)])) as Record<typeof buildingIds[number],z.ZodDefault<z.ZodNumber>>);
const civ = z.string().max(80).refine(id=>civilizations.some(c=>c.id===cultureId(id))&&/^[a-z_]+(?:~[0-9]+)?$/.test(id),'未知領主或文明');
const job = z.object({started:integer.optional(),id:integer,item:z.string().max(30),quantity:integer.min(1).max(500),at:integer,owner:civ,plot:integer.max(34).optional(),action:z.enum(['build','demolish']).optional()});
const point = z.object({x:z.number().int().min(0).max(255),y:z.number().int().min(0).max(255)});
const defaults=z.object({enabled:z.boolean(),policy:z.enum(['balanced','food','industry','military','research']),budget:integer.max(10000),reserve:integer.max(10000)});
const ranking=z.object({id:civ,cities:integer,population:integer,power:nonnegative,members:integer});
const route=z.object({id:integer,owner:civ,from:z.string().max(60),to:z.string().max(60),mode:z.enum(['once','route','refill']),amount:stockSchema,reserve:stockSchema,target:stockSchema,enabled:z.boolean(),status:z.string().max(200)});
const intelSchema=z.object({generation:integer.optional(),era:integer.max(2).optional(),scouted:z.boolean().optional(),stock:stockSchema.optional(),tech:z.array(z.string()).max(8).optional(),stability:nonnegative.max(100).optional(),supplied:z.boolean().optional(),realAt:integer.optional(),at:integer,troops:troopSchema,wall:integer.max(5),owner:civ.nullable()});
const battlePartySchema=z.object({lord:z.string().max(80),league:z.string().max(80).optional(),leagueColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),empire:z.string().max(80).optional(),empireColor:z.string().regex(/^hsl\([\d.]+ 82% var\(--empire-name-lightness,76%\)\)$/).optional()});
const gameSchema = z.object({
  offlineLimit:z.union([z.literal(-1),z.literal(0),z.literal(3600000),z.literal(21600000),z.literal(86400000)]).optional(),offlineSince:integer.optional(),defeat:z.object({at:integer,city:z.string().optional(),winner:civ.nullable(),ended:z.boolean()}).optional(),restorations:integer.optional(),routes:z.array(route).max(200).optional(),favoriteTiles:z.array(point).max(5).optional(),leaderboard:z.object({at:integer,lords:z.array(ranking).max(72),leagues:z.array(ranking).max(72),empires:z.array(ranking).max(72)}).optional(),
  terrainVersion:z.literal(1).optional(),mountainRevision:z.literal(1).optional(),mountainClearings:z.array(z.object({x:integer.max(255),y:integer.max(255)})).max(10000).optional(),wildVersion:z.union([z.literal(1),z.literal(2)]).optional(),balanceVersion:integer.optional(),schema:z.literal(SCHEMA),campaign:z.string().min(1).max(120),acceptedCommands:z.array(z.string().max(100)).max(256),content:z.literal(CONTENT),seed:integer.max(4294967295),player:civ,speed:z.union([z.literal(1),z.literal(3),z.literal(6),z.literal(10),z.literal(50),z.literal(100),z.literal(12),z.literal(120)]),
  time:integer,savedAt:integer,revision:integer,next:integer.min(1),rng:integer.max(4294967295),
  nodes:z.array(point.extend({id:z.string().max(60),name:z.string().max(60),customName:z.boolean().optional(),policyOverride:z.boolean().optional(),kind:z.enum(['capital','village','camp','iron','horses','ruins']),retiring:z.boolean().optional(),npcResource:z.enum(resources).optional(),npcLevel:integer.min(1).max(10).optional(),respawnAt:integer.optional(),generation:integer.optional(),owner:civ.nullable(),stock:stockSchema,population:nonnegative,integration:nonnegative.max(100),stability:nonnegative.max(100),buildings:levels,troops:troopSchema,build:z.array(job).max(3),train:z.array(job).max(3),policy:z.enum(['balanced','food','industry','military','research']),plots:z.array(z.object({id:integer.max(34),level:integer.max(5).optional(),kind:z.enum(['center','resource','urban','wall']),building:z.enum(buildingIds).nullable()} )).length(35),governor:z.object({enabled:z.boolean(),budget:integer.max(10000),reserve:integer.max(10000),spent:stockSchema,period:integer,blocked:z.string().max(200),autoNew:z.boolean()})})).min(96).max(4096),
  factions:z.array(z.object({leagueName:z.string().max(24).optional(),empireName:z.string().max(24).optional(),governorDefaults:defaults.optional(),personality:integer.max(5).optional(),grudges:z.record(integer).optional(),gratitude:z.record(integer).optional(),protectionUntil:integer.optional(),objectives:z.array(integer.max(3)).max(4).optional(),lastAid:integer.optional(),civilization:z.string().refine(v=>civilizations.some(c=>c.id===v)).optional(),name:z.string().max(80).optional(),league:civ.nullable().optional(),empireId:civ.nullable().optional(),empire:z.enum(['direct','vassal','federal']).nullable().optional(),id:civ,capital:z.string().max(60),era:integer.max(2),tech:z.array(z.enum(['feudal','castle','logistics','steel','agriculture','carpentry','forging','irrigation'])).max(8),eraUpgrade:job.nullable().optional(),research:job.nullable(),intel:z.record(intelSchema),vassal:civ.nullable(),regent:z.boolean(),intent:z.string().max(120),exile:z.object({at:integer,refuge:z.string(),population:nonnegative,troops:troopSchema,stock:stockSchema}).nullable()})).min(6).max(72),
  events:z.array(z.object({id:integer,at:integer,type:z.enum(['pulse','ai','build','train','research','arrive','round','retreat','redirect']),ref:z.union([z.string().max(60),integer])})).max(10000),
  marches:z.array(z.object({transportLoad:nonnegative.optional(),tradeRoute:integer.optional(),stationed:z.boolean().optional(),supplyCity:z.string().max(60).optional(),targetGeneration:integer.optional(),id:integer,owner:civ,from:z.string().max(60),to:z.string().max(60),kind:z.enum(['scout','raid','occupy','reinforce','transport','settle']),troops:troopSchema,cargo:stockSchema,started:integer,at:integer,status:z.enum(['outbound','returning','battle']),path:z.array(point).min(1).max(1024),retreatAt:integer.optional(),redirect:z.object({to:z.string(),at:integer}).optional(),supply:nonnegative.max(180),settlers:integer.max(400).optional()})).max(1000),
  battles:z.array(z.object({id:integer,march:integer,target:z.string().max(60),round:integer.min(1).max(6),at:integer,started:integer.optional()})).max(200),
  reportUnread:integer.optional(),reportAlerts:integer.optional(),battleStatistics:z.record(z.object({wins:integer,losses:integer,casualties:integer,conquests:integer})).optional(),
  reports:z.array(z.object({battleSides:z.object({attacker:battlePartySchema,defender:battlePartySchema}).optional(),scoutIntel:intelSchema.optional(),important:z.boolean().optional(),groupHour:integer.optional(),realAt:integer.optional(),entries:z.array(z.object({text:z.string().max(2000),count:integer.min(1),city:z.string().max(200).optional(),at:integer.optional(),realAt:integer.optional(),category:z.enum(['city','trade']).optional()})).max(300).optional(),art:z.string().regex(/^art\/[a-z0-9-]+\.(png|webp)$/).optional(),read:z.boolean().optional(),id:integer,at:integer,owner:civ,title:z.string().max(200),text:z.string().max(2000),node:z.string().max(60).optional(),location:point.optional(),kind:z.enum(['system','scout','battle','economy','diplomacy']),before:troopSchema.optional(),after:troopSchema.optional(),enemyBefore:troopSchema.optional(),enemyAfter:troopSchema.optional(),loot:stockSchema.optional()})),
  protectionUntil:integer,treaties:z.array(z.object({a:civ,b:civ,kind:z.enum(['war','truce','alliance']),until:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)})).max(5000),
  log:z.array(z.object({at:integer,type:z.string().max(30),owner:civ})).max(200),
  hegemony:z.object({owner:civ,since:integer}).nullable(),result:z.object({kind:z.enum(['conquest','hegemony','defeat']),winner:civ.nullable(),text:z.string().max(2000)}).nullable(),sandbox:z.boolean()
});
export function migrateV3(_value:unknown):Game{throw new Error('舊版戰役不適用城內／城郊大改版，請開始新戰役。');}
export const migrateV4=migrateV3;
export function validate(value: unknown): Game {
  const g=gameSchema.parse(value) as Game;
  upgradeMountains(g);
  if(g.favoriteTiles&&new Set(g.favoriteTiles.map(p=>`${p.x},${p.y}`)).size!==g.favoriteTiles.length)throw new Error('收藏地塊座標重複。');
  // Older builds declared a draw at 48 hours. Resume those campaigns normally.
  if(g.result?.kind==='defeat'&&g.result.winner===null&&g.result.text.startsWith('48 小時戰役結束')){
    g.result=null;
    if(!g.events.some(e=>e.type==='pulse'))g.events.push({id:g.next++,at:g.time+MINUTE,type:'pulse',ref:''});
    for(const [i,f] of g.factions.entries())if(f.id!==g.player&&!g.events.some(e=>e.type==='ai'&&e.ref===f.id))g.events.push({id:g.next++,at:g.time+(10+i)*MINUTE,type:'ai',ref:f.id});
  }
  for(const f of g.factions){if(f.research&&['feudal','castle'].includes(f.research.item)){if(f.eraUpgrade)throw new Error('時代晉升佇列重複。');f.eraUpgrade=f.research;f.research=null;}}
  normalizeCityNames(g);normalizeOrganizations(g);repairWaterCities(g);
  const ids=new Set(g.nodes.map(n=>n.id)), fs=new Set(g.factions.map(f=>f.id));
  if(ids.size!==g.nodes.length||fs.size!==g.factions.length||!fs.has(g.player))throw new Error('存檔包含重複城市或文明。');
  for(const n of g.nodes){
    if(new Set(n.plots.map(p=>p.id)).size!==35)throw new Error('城市地塊重複。');
    if(n.plots.some(p=>p.kind!==(p.id===0?'center':p.id===16?'wall':p.id>=17?'resource':'urban')))throw new Error('城市區域配置錯誤。');
    const fields=n.plots.filter(p=>p.kind==='resource');if(fields.length!==18||fields.some(p=>p.id<17||p.id>34||p.level===undefined)||n.plots.some(p=>p.id>=17&&p.kind!=='resource')||['farm','lumber','quarry','mine'].some(b=>!fields.some(p=>p.building===b)))throw new Error('城郊資源地配置不完整。');
    if(n.owner&&!fs.has(n.owner))throw new Error('領主不存在');
    const placed=n.plots.filter(p=>p.building).map(p=>p.building);if(new Set(placed.filter(b=>!repeatableBuilding(b!))).size!==placed.filter(b=>!repeatableBuilding(b!)).length||n.plots.some(p=>p.building&&!plotAccepts(p,p.building)))throw new Error('建築地塊不相容。');
    for(const b of buildingIds)if(n.buildings[b]>0&&!placed.includes(b))throw new Error('建築缺少地塊。');
    for(const j of n.build)if((j.started!==undefined&&j.started>j.at)||!fs.has(j.owner)||!buildingIds.includes(j.item as typeof buildingIds[number])||!n.plots.some(p=>p.id===j.plot&&plotAccepts(p,j.item as typeof buildingIds[number]))||j.at<g.time||!g.events.some(e=>e.id===j.id&&e.type==='build'&&e.at===j.at&&e.ref===n.id))throw new Error('建造佇列損毀。');
    for(const j of n.train)if(!fs.has(j.owner)||!unitIds.includes(j.item as typeof unitIds[number])||j.at<g.time||!g.events.some(e=>e.id===j.id&&e.type==='train'&&e.at===j.at&&e.ref===n.id))throw new Error('訓練佇列損毀。');
  }
  for(const f of g.factions){
    if((f.league&&!fs.has(f.league))||(f.vassal&&!fs.has(f.vassal))||!ids.has(f.capital)||Object.keys(f.intel).some(k=>!ids.has(k))||f.vassal===f.id)throw new Error('文明資料損毀。');
    if((f.empire&&(f.league!==f.id||f.empireId!==f.id))||(f.empireId&&(f.league!==f.id||!g.factions.some(e=>e.id===f.empireId&&!!e.empire))))throw new Error('帝國與軍團關係損毀。');
    if(Object.values(f.intel).some(i=>i.owner&&!fs.has(i.owner)))throw new Error('情報領主不存在');
    if(f.eraUpgrade&&(f.eraUpgrade.owner!==f.id||!['feudal','castle'].includes(f.eraUpgrade.item)||!g.events.some(e=>e.id===f.eraUpgrade?.id&&e.type==='research'&&e.at===f.eraUpgrade.at&&g.nodes.find(n=>n.id===e.ref)?.owner===f.id)))throw new Error('時代晉升佇列損毀。');
    if(f.research&&(!fs.has(f.research.owner)||!['feudal','castle','logistics','steel','agriculture','carpentry','forging','irrigation'].includes(f.research.item)||!g.events.some(e=>e.id===f.research?.id&&e.type==='research')))throw new Error('研究佇列損毀。');
  }
  if(g.reports.some(r=>!fs.has(r.owner))||g.treaties.some(t=>!fs.has(t.a)||!fs.has(t.b))||g.log.some(l=>!fs.has(l.owner))||(g.hegemony&&!fs.has(g.hegemony.owner))||(g.result?.winner&&!fs.has(g.result.winner)))throw new Error('世界紀事或外交領主不存在');
  const eventIds=new Set<number>();
  for(const e of g.events){
    if(e.at<g.time||eventIds.has(e.id)||e.id>=g.next)throw new Error('排程資料損毀。');
    eventIds.add(e.id);
    if(['build','train','research'].includes(e.type)&&!ids.has(String(e.ref)))throw new Error('事件城市不存在。');
    if(e.type==='ai'&&!fs.has(String(e.ref)))throw new Error('事件文明不存在。');
  }
  const marchIds=new Set(g.marches.map(m=>m.id));
  if(marchIds.size!==g.marches.length)throw new Error('軍隊重複。');
  for(const m of g.marches)if(!fs.has(m.owner)||!ids.has(m.from)||!ids.has(m.to)||m.started>g.time||(!m.stationed&&m.at<g.time)||(!g.result&&m.status!=='battle'&&!g.events.some(e=>e.type==='arrive'&&e.ref===m.id&&e.at===m.at)))throw new Error('行軍排程損毀。');
  for(const b of g.battles)if(!marchIds.has(b.march)||!ids.has(b.target)||!g.events.some(e=>e.type==='round'&&e.ref===b.id&&e.at===b.at))throw new Error('戰役排程損毀。');
  upgradeBatch(g);
  initializeWildSites(g);
  // Existing orders keep their arrival deadline, but their displayed route
  // must no longer run through a newly introduced mountain.
  if(g.terrainVersion)for(const march of g.marches)if(march.path.slice(1,-1).some(p=>terrainAt(p.x,p.y,g.seed,g.terrainVersion)==='mountain')){
    march.path=travelRoute(g,march.path[0],march.path[march.path.length-1]).path;
  }
  g.reports=g.reports.filter(r=>!r.title.startsWith('水域城址修正'));
  detectDefeat(g);
  return g;
}
function stable(value: unknown): string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  const o=value as Record<string,unknown>;
  return '{'+Object.keys(o).filter(k=>o[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+stable(o[k])).join(',')+'}';
}
export function checksum(value: unknown) { let h=2166136261; for(const c of stable(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0'); }
export function stateHash(g: Game) { const {savedAt:_wall,revision:_rev,campaign:_campaign,acceptedCommands:_commands,reports:_reports,...world}=g;return checksum(world); }
// v0.27 starts a new campaign. The old database is intentionally left untouched.
type Snapshot=Omit<Game,'reports'>;
type Envelope={appVersion?:string;format:'guozhan-realm-save';schema:6;content:string;checksum:string;snapshot:Snapshot;reports?:Report[];reportChecksum?:string};
type Row={id:number;at:number;label:string;gameTime:number;reportCursor:number;data:Envelope};
type StoredReport={key:string;campaign:string;id:number;owner:string;category:ReportTab;at:number;report:Partial<Report>};
class Database extends Dexie {
  saves!:Table<Row,number>;backups!:Table<Row,number>;BattleReports!:Table<StoredReport,string>;
  constructor(){super('guozhan-river-valley-v027');this.version(1).stores({saves:'id',backups:'++id,at',BattleReports:'key,campaign,[campaign+id],[campaign+owner+id],[campaign+owner+category+id]'});}
}
let db=new Database();
let hotHashes=new Map<string,string>();
export async function clearSavedGames(){db.close();await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase('guozhan-river-valley-v027');const timer=setTimeout(()=>reject(new Error('清除存檔逾時；請關閉其他列國征途分頁後再試。')),12000);request.onsuccess=()=>{clearTimeout(timer);resolve();};request.onerror=()=>{clearTimeout(timer);reject(request.error??new Error('無法清除存檔。'));};});db=new Database();hotHashes.clear();}
const worldSnapshot=(g:Game):Snapshot=>{const {reports:_reports,...world}=g;return world;};
export const envelope=(g:Game):Envelope=>{const snapshot=worldSnapshot(g);return{appVersion:RELEASE.version,format:'guozhan-realm-save',schema:6,content:CONTENT,checksum:checksum(snapshot),snapshot};};
export function decode(value:unknown):Game{
 const e=z.object({format:z.literal('guozhan-realm-save'),schema:z.number().int(),content:z.string(),checksum:z.string(),snapshot:z.unknown(),reports:z.unknown().optional(),reportChecksum:z.string().optional()}).parse(value);
 if(checksum(e.snapshot)!==e.checksum)throw new Error('存檔檢查碼不符，未覆寫目前進度。');
 if(e.reports!==undefined&&(!Array.isArray(e.reports)||checksum(e.reports)!==e.reportChecksum))throw new Error('完整備份的戰報檢查碼不符。');
 if(e.schema!==SCHEMA||e.content!==CONTENT)throw new Error('本版存檔格式已更新，請開始新遊戲。舊檔案不會被修改。');
 // Complete backups carry their separately exported reports. Quick backups start with none.
 return validate({...e.snapshot as object,reports:Array.isArray(e.reports)?e.reports:[]});
}
export const exportSave=(g:Game)=>JSON.stringify(envelope(g));
const rowValid=(row:Row|undefined)=>row?.data?.format==='guozhan-realm-save'&&row.data.content===CONTENT&&checksum(row.data.snapshot)===row.data.checksum;
export async function exportStoredSave(mode:'quick'|'full'='quick'){
 const {row,reports}=await db.transaction('r',db.saves,db.backups,db.BattleReports,async()=>{
  const current=await db.saves.get(1),backups=await db.backups.orderBy('at').reverse().toArray();
  const row=[current,...backups].find(candidate=>rowValid(candidate));if(!row)throw new Error('找不到可匯出的有效存檔；目前資料未變更。');
  if(mode==='quick')return{row,reports:[] as Report[]};
  const rows=await db.BattleReports.where('[campaign+id]').between([row.data.snapshot.campaign,Dexie.minKey],[row.data.snapshot.campaign,row.reportCursor],true,false).toArray();
  return{row,reports:rows.filter(r=>r.at<=row.gameTime).map(r=>inflate(r.report))};
 });
 return mode==='quick'?JSON.stringify(row.data):JSON.stringify({...row.data,reports,reportChecksum:checksum(reports)});
}
export function importSave(text:string){if(new TextEncoder().encode(text).length>100*1024*1024)throw new Error('存檔超過 100 MiB。');return decode(JSON.parse(text));}
const reportKey=(campaign:string,id:number)=>campaign+':'+id;
// Battle prose is derived from these fixed phrases. The private-use markers
// keep each archived result readable after decoding without repeating prose.
const battlePhrases=['守方戰報。',' 攻擊 ','。地形：','；城牆 ',' 級；攻方補給 ','；鍛鋼 ','；士氣：攻 ','（補給／城市穩定）。攻方損失 ',' 套編制裝備，守方損失 ',' 套，已隨傷亡扣除。尚存部隊依戰果駐防或返城。',' 被掠奪物資如下。',' 戰利品隨部隊返城後入庫；超過倉庫容量的部分無法保存。','斷糧，戰力 −35%','已採用 +12%','未採用'];
const escapeMarker='\ue0ff',battleMarker=0xe000;
const encodeBattleText=(text:string)=>{
 let value=text.replace(/[\ue000-\ue0ff]/g,ch=>escapeMarker+ch);
 battlePhrases.forEach((phrase,i)=>{value=value.replaceAll(phrase,String.fromCharCode(battleMarker+i));});
 return value;
};
const decodeBattleText=(text:string)=>{let result='';for(let i=0;i<text.length;i++){const char=text[i],code=char.charCodeAt(0);if(char===escapeMarker){result+=text[++i]??'';}else result+=code>=battleMarker&&code<battleMarker+battlePhrases.length?battlePhrases[code-battleMarker]:char;}return result;};
const pack=(campaign:string,r:Report):StoredReport=>{
 const report:Partial<Report>={...r};
 // Static artwork is reconstructed from the destination when reading; fixed
 // troop/resource key names are represented by ordered numbers in IndexedDB.
 if(r.kind==='battle'&&r.art&&!r.art.includes('defeat'))delete report.art;
 if(r.kind==='battle')report.text=encodeBattleText(r.text);
 for(const field of ['before','after','enemyBefore','enemyAfter'] as const)if(report[field]) (report as Record<string,unknown>)[field]=unitIds.map(u=>report[field]![u]);
 if(report.loot)(report as Record<string,unknown>).loot=resources.map(u=>report.loot![u]);
 return{key:reportKey(campaign,r.id),campaign,id:r.id,owner:r.owner,category:reportCategory(r),at:r.at,report};
};
const inflate=(r:Partial<Report>):Report=>{
 const report={...r};for(const field of ['before','after','enemyBefore','enemyAfter'] as const){const raw=report[field] as unknown;if(Array.isArray(raw))(report as Record<string,unknown>)[field]=Object.fromEntries(unitIds.map((u,i)=>[u,raw[i]]));}
 if(report.kind==='battle'&&report.text)report.text=decodeBattleText(report.text);
 const loot=report.loot as unknown;if(Array.isArray(loot))(report as Record<string,unknown>).loot=Object.fromEntries(resources.map((u,i)=>[u,loot[i]]));
 return report as Report;
};
export type ReportPage={rows:Report[];count:number;unread:number;counts:Record<ReportTab,number>};
export async function readReportPage(campaign:string,owner:string,filter:ReportTab,page:number,cursor:number,gameTime:number):Promise<ReportPage>{
 const upper=Math.max(0,cursor-1),base:[string,string]=[campaign,owner];
 const all=db.BattleReports.where('[campaign+owner+id]').between([...base,Dexie.minKey],[...base,upper]);
 const counts={} as Record<ReportTab,number>;
 for(const category of ['all','battle','diplomacy','chronicle'] as ReportTab[]){counts[category]=category==='all'?await all.count():await db.BattleReports.where('[campaign+owner+category+id]').between([...base,category,Dexie.minKey],[...base,category,upper]).count();}
 const query=filter==='all'?all:db.BattleReports.where('[campaign+owner+category+id]').between([...base,filter,Dexie.minKey],[...base,filter,upper]);
 const selected=await query.reverse().offset(Math.max(0,page)*50).limit(50).toArray();
 // at is additionally checked for restored checkpoints in case a same-campaign
 // branch reused IDs before the cleanup transaction completed.
 const rows=selected.filter(x=>x.at<=gameTime).map(x=>inflate(x.report));
 return{rows,count:counts[filter],unread:0,counts};
}
export async function updateReports(g:Game,action:'read'|'clear',ids:number[]|null,category:ReportTab='all'){
 const campaign=g.campaign,owner=g.player;let unread=0,alerts=0,changed=0;
 await db.transaction('rw',db.BattleReports,async()=>{
  const rows=ids?await db.BattleReports.bulkGet(ids.map(id=>reportKey(campaign,id))):await (category==='all'?db.BattleReports.where('[campaign+owner+id]').between([campaign,owner,Dexie.minKey],[campaign,owner,g.next-1]):db.BattleReports.where('[campaign+owner+category+id]').between([campaign,owner,category,Dexie.minKey],[campaign,owner,category,g.next-1])).toArray();
  const valid=rows.filter((r):r is StoredReport=>!!r&&r.owner===owner&&r.at<=g.time&&r.id<g.next);
  for(const row of valid){if(row.report.read!==false)continue;unread++;if(importantMessage(row.report as Report)||['battle','scout','diplomacy'].includes(row.report.kind!)||/敵軍|來襲|警報/.test(row.report.title??''))alerts++;}
  changed=action==='clear'?valid.length:unread;
  if(action==='clear')await db.BattleReports.bulkDelete(valid.map(r=>r.key));else await db.BattleReports.bulkPut(valid.map(r=>({...r,report:{...r.report,read:true}})));
 });
 g.reportUnread=Math.max(0,(g.reportUnread??0)-unread);g.reportAlerts=Math.max(0,(g.reportAlerts??0)-alerts);
 const deleted=new Set(ids??[]);g.reports=action==='clear'?g.reports.filter(r=>ids? !deleted.has(r.id):!(r.owner===owner&&(category==='all'||reportCategory(r)===category))):g.reports.map(r=>r.owner===owner&&(ids?deleted.has(r.id):category==='all'||reportCategory(r)===category)?{...r,read:true}:r);
 return changed;
}
export async function discardFutureReports(g:Game){await db.transaction('rw',db.BattleReports,db.backups,async()=>{const rows=await db.BattleReports.where('campaign').equals(g.campaign).toArray();await db.BattleReports.bulkDelete(rows.filter(r=>r.id>=g.next||r.at>g.time).map(r=>r.key));const backups=await db.backups.orderBy('at').toArray();await db.backups.bulkDelete(backups.filter(r=>r.data.snapshot.campaign===g.campaign&&(r.gameTime>g.time||r.reportCursor>g.next)).map(r=>r.id));});hotHashes.clear();}
export async function replaceReportHistory(g:Game){await db.transaction('rw',db.BattleReports,db.backups,async()=>{const rows=await db.BattleReports.where('campaign').equals(g.campaign).toArray();await db.BattleReports.bulkDelete(rows.map(r=>r.key));const backups=await db.backups.orderBy('at').toArray();await db.backups.bulkDelete(backups.filter(r=>r.data.snapshot.campaign===g.campaign).map(r=>r.id));});hotHashes.clear();}
export async function save(g:Game,force=false,label='自動回復點'){
 const nextRevision=g.revision+1,snapshot={...g,revision:nextRevision};const row:Row={id:1,at:Date.now(),label,gameTime:g.time,reportCursor:g.next,data:envelope(snapshot)};
 const hashes=g.reports.map(r=>[reportKey(g.campaign,r.id),checksum(r)] as const);
 const changed=g.reports.filter((_,i)=>hotHashes.get(hashes[i][0])!==hashes[i][1]);
 await db.transaction('rw',db.saves,db.backups,db.BattleReports,async()=>{
  let last=await db.backups.orderBy('at').last();
  if(last&&last.data.snapshot.campaign!==g.campaign){await db.backups.clear();await db.BattleReports.clear();last=undefined;}
  // Upsert the short hot window; IndexedDB keeps all older player reports.
  if(changed.length)await db.BattleReports.bulkPut(changed.map(r=>pack(g.campaign,r)));
  if(force||!last||row.at-last.at>=60_000){await db.backups.add({at:row.at,label,gameTime:g.time,reportCursor:g.next,data:row.data} as Row);const rows=await db.backups.orderBy('at').toArray();if(rows.length>2)await db.backups.bulkDelete(rows.slice(0,rows.length-2).map(r=>r.id));}
  await db.saves.put(row);
 });
 g.revision=nextRevision;
 // Only current-hour summaries and immediate battle mutations need to stay live.
 g.reports=g.reports.filter(r=>Math.floor(r.at/3600000)===Math.floor(g.time/3600000));
 const active=new Set(g.reports.map(r=>reportKey(g.campaign,r.id)));hotHashes=new Map(hashes.filter(([key])=>active.has(key)));
}
export async function loadSave():Promise<{game:Game|null;recovered:boolean}>{
 const row=await db.saves.get(1);if(!row)return{game:null,recovered:false};
 try{return{game:decode(row.data),recovered:false};}catch{for(const b of await db.backups.orderBy('at').reverse().toArray()){try{return{game:decode(b.data),recovered:true};}catch{/* try next */}}throw new Error('目前存檔與回復點均無法讀取。資料已保留，請開始新遊戲。');}
}
export async function backupList(){return(await db.backups.orderBy('at').reverse().toArray()).map(r=>({id:r.id,at:r.at,label:r.label,time:r.gameTime,reportCursor:r.reportCursor}));}
export async function restore(id:number){const b=await db.backups.get(id);if(!b)throw new Error('找不到回復點。');return decode(b.data);}
