import type {FormalWorld,FormalCommand,FormalCity,Resources} from '../formal/model';
import {V85,AGE_EXPECTED,specCost,type AuditItem,type SpecBuilding,type SpecTech,type SpecUnit} from './specAudit';
import {developerWorld,putBuilding,type DeveloperConfig,developerOrder} from './scenarios';
import {MILESTONES,changeCityOwner} from '../formal/economy';
import {submitFormalOrder,advanceFormal} from '../formal/reducer';
import {route} from '../formal/routing';
import {TECH_CATALOG} from '../formal/techCatalog';
import {validateFormalWorld} from '../formal/schema';
export type TrialRequest={kind:AuditItem['kind']|'production';target:string;level:number;variant:string;config:DeveloperConfig;production?:{level:number;boost:number;tier:number}};
export type TrialInfo={key:string;name:string;sourceLine:number;request:TrialRequest;expectedAdmission:'allow'|'block';steps:string[];expectedResult:string;command:FormalCommand|null;expectedCost:Resources;expectedPopulationChange:number;expectedDurationMs:number|null};
export const variantsFor=(kind:AuditItem['kind'],target:string)=>{
 if(kind==='field')return [{id:'ready',name:'全部資格達成'},{id:'milestone',name:'未曾達10000'},{id:'city',name:'未完成 City 晉升'},{id:'housing',name:'當下住房不足10000'},{id:'population-fallen',name:'曾達標後人口下降，仍可升級'},{id:'poor',name:'庫存少1'}];
 if(kind==='system')return target==='city'?[{id:'ready',name:'City前置達成'},{id:'population',name:'人口差1'},{id:'building:townhall',name:'市政廳差1級'},{id:'poor',name:'庫存少1'}]:target==='colony'?[{id:'ready',name:'拓殖前置達成'},{id:'age',name:'尚未到城堡時代'},{id:'building:castle',name:'未建城堡'},{id:'population',name:'母城1999人'},{id:'poor',name:'庫存少1'}]:[{id:'ready',name:'2001穀需要2隊商隊'},{id:'building:market',name:'市場只1隊，應阻擋'},{id:'poor',name:'庫存少1'}];
 const d=kind==='building'?V85.buildings.find(d=>d.id===target):kind==='tech'?V85.techs.find(d=>d.id===target):kind==='unit'?V85.units.find(d=>d.id===target):null;
 const funding=kind==='tech'&&(d as SpecTech)?.scope.startsWith('modern');
 const list=[{id:'ready',name:kind==='tech'&&target.startsWith('blacksmith.')?'其他前置達成，依本文明上限判斷':'前置達成，應可啟動'},{id:'poor',name:funding?'零庫存，可建立待投入專案':'庫存少 1，應阻擋'}];
 if(kind==='age'){list.push({id:'population',name:'人口差 1'},{id:'building:center',name:'城市中心差 1 級'});return list;}
 if(d?.age)list.push({id:'age',name:'時代差一階'});
 if(kind==='building'){
  const b=d as SpecBuilding;for(const [key,lv] of Object.entries(b.buildings))if(lv>1||key!=='center')list.push({id:'building:'+key,name:'缺 '+(V85.buildings.find(b=>b.id===key)?.name??key)+' 前置'});
  if(['mill','lumbermill','masonry','mint'].includes(target))list.push({id:'fields',name:'資源田等級未達門檻'});
 }else if(kind==='tech'){
  const t=d as SpecTech;for(const key of Object.keys(t.buildings))list.push({id:'building:'+key,name:'缺 '+(V85.buildings.find(b=>b.id===key)?.name??key)+' 前置'});
  if(t.milestone)list.push({id:'milestone',name:'本城未曾達標'},{id:'population-fallen',name:'曾達標後人口降低，應可研發'});
  if(t.civilizationId)list.push({id:'foreign',name:'切換外文明，應阻擋'});
  if(t.scope!=='traditional')list.push({id:'modern',name:'缺完整現代資格'});
  for(const id of t.prerequisites??[])list.push({id:'tech:'+id,name:'缺明列前置 '+(V85.techs.find(t=>t.id===id)?.name??id)});
 }else if(kind==='unit'){
  const u=d as SpecUnit;list.push({id:'building:'+u.producer,name:'缺生產建築'});
  if(u.eliteTech)list.push({id:'tech:'+u.eliteTech,name:'尚未完成精銳科技'},{id:'milestone',name:'本城未曾達標'},{id:'population-fallen',name:'曾達標後人口降低，仍可生產'});
  if(u.civilizationId)list.push({id:'foreign',name:'外文明生產，應阻擋'});
 }
 return list;
};
function setBuilding(c:FormalCity,key:string,lv:number){key=key==='warehouse'?'warehouse.0':key==='bunker'?'bunker.0':key;if(key==='wall'){c.wallLevel=lv;delete c.buildings.wall;delete c.economy!.slots.wall;return;}if(lv>0){putBuilding(c,key,lv);}else{delete c.buildings[key];delete c.economy!.slots[key];if(key==='residence')c.housing=400;}}
export function createTrialWorld(req:TrialRequest,template?:FormalWorld):{world:FormalWorld;info:TrialInfo}{
 const w=template?structuredClone(template):developerWorld({...req.config,scenario:'new'}),c=w.cities[0],f=w.factions[0];f.civilizationId=req.config.civilizationId;w.speed=req.config.speed;
 if(!Number.isInteger(req.level)||req.level<0||req.level>15)throw new Error('測試等級無效。');
 putBuilding(c,'residence',15);for(let i=0;i<4;i++)putBuilding(c,'warehouse.'+i,15);c.stock={food:400000,wood:400000,stone:400000,gold:400000};c.population=1000;c.military!.units={};c.economy!.milestones=[];
 let name='',line=0,command:FormalCommand|null=null,age=0,requirements:Record<string,number>={},cost:Record<string,number>={},milestone=0,steps:string[]=[],result='',populationChange=0,durationMs:number|null=null;
 if(req.kind==='production'){
  const p=req.production!;if(!p||![p.level,p.boost,p.tier].every(Number.isInteger)||p.level<0||p.level>15||p.boost<0||p.boost>8||p.tier<0||p.tier>3)throw new Error('產量測試參數無效。');
  for(const field of c.fields!)field.level=p.level;
  if(p.boost)for(const key of ['mill','lumbermill','masonry','mint'])putBuilding(c,key,p.boost);
  for(const r of ['food','wood','stone','gold'])for(let i=1;i<=p.tier;i++)f.techIds.push('economy.'+r+'.'+i);
  c.stock={food:0,wood:0,stone:0,gold:0};name='6／5／4／3 田產量實際累積';line=405;steps=['先查看四種資源的公式與預期世界時產量。','按「+1 世界時」，核對庫存增加量（無駐軍、無統治初定、預留足夠容量）。','到城市頁升級資源田／增產建築，確認完工後的新產量。'];result='實際庫存按正常田產累積；小數保留在 remainder。';age=3;
 }else if(req.kind==='field'){
  const resource=req.target as keyof Resources,base=({food:{food:20,wood:70,stone:90,gold:70},wood:{food:60,wood:40,stone:100,gold:50},stone:{food:50,wood:80,stone:40,gold:80},gold:{food:60,wood:100,stone:80,gold:30}})[resource];if(!base||req.level<1||req.level>15)throw new Error('資源田測試無效。');
  const field=c.fields!.find(p=>p.resource===resource)!;field.level=req.level-1;c.cityPromotionCompleted=true;milestone=10000;line=396;name='高階資源田 '+resource+' Lv'+req.level;cost=specCost(base,1.67,req.level);const A={food:1450/3,wood:1780/3,stone:1660/3,gold:2350/3}[resource];durationMs=Math.round((A*1.6**(req.level-1)-1000/3)/3*1000);command={type:'field.upgrade',cityId:c.id,slot:field.slot};steps=['到城郊點選目標田，核對三項資格與成本。','實際升級，推進完成；記下每小時新產量。','曾達標後人口降低仍保留資格；未達標／未完成City／當下住房不足應擋高階新工程。'];result='資源田＋1級，未因人口下降回退；成本与工期按1.67/1.6曲線。';
 }else if(req.kind==='system'){
  if(req.target==='city'){name='City 正式晉升';line=2287;requirements={townhall:5};c.population=10000;cost={food:12000,wood:18000,stone:18000,gold:12000};durationMs=21600000;command={type:'city.promote',cityId:c.id};steps=['在城市行政頁開始 City 晉升。','可同時建造／研究／訓練；推進6世界時完成。','確認永久City資格與城郊美術，再重讀存檔。'];result='永久 City 資格開啟；未免費升田、升牆或改時代。';}
  else if(req.target==='colony'){name='v85 拓殖隊生產與建城';line=2413;age=2;requirements={castle:req.level};c.population=2000;c.military!.units={spearman:40,scout:20,ram:1};cost={food:6000,wood:8000,stone:12000,gold:4000};populationChange=-400;durationMs=Math.round(14400000*(1-.5*(req.level-1)/14));command={type:'settlement.prepare',cityId:c.id};steps=['在軍隊／拓殖頁實際生產一隊，確認扣400人與固定資源。','推進完成，確認是實際待命拓殖隊×1；再試重複生產及待命退款，應阻擋。','到地圖選合法空地，分別試19/20護衛；斥候與攻城器不能湊有效護衛。','出發不可取消；按下一完成事件確認新城400人、護衛轉籍、拓殖隊消耗。','另建新情境，在未完成整備前取消，核對全人口／80%退款。'];result='4h→2h產出特殊非戰鬥實體拓殖隊；獨立整備線，不吃軍糧。';}
  else if(req.target==='logistics'){name='商隊實際運輸';line=759;age=1;requirements={market:2};const destination=w.cities.slice(1).sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y))[0];changeCityOwner(w,destination,w.playerFactionId,'receive');destination.integrationWorkHours=0;putBuilding(destination,'warehouse.0',15);destination.stock={food:0,wood:0,stone:0,gold:0};const distance=route(w,c,destination).distance;cost={food:2001,wood:0,stone:0,gold:0};durationMs=Math.ceil(distance*60000);command={type:'logistics.dispatch',cityId:c.id,destinationCityId:destination.id,resources:cost as Resources};steps=['到商隊物流頁送2001穀，確認需要2队商隊並扣除真實庫存。','目的城在途預約2001容量，抵達前不能把它花掉。','推進抵達，確認目的城收到貨、車輛仍占用；再推進空車返程才釋放。'];result='每隊2000載量，60秒／合法路格；先預約容量，抵達入庫、返程釋放。';}
  else throw new Error('機制測試無效。');
 }else if(req.kind==='building'){
  const d=V85.buildings.find(d=>d.id===req.target);if(!d||req.level<1||req.level>d.maxLevel)throw new Error('建築測試無效。');name=d.name+' Lv'+req.level;line=d.line;age=d.age;requirements=d.buildings;cost=specCost(d.baseCost,d.growth,req.level);
  for(const [k,lv] of Object.entries(requirements))setBuilding(c,k,lv);
  const key=d.id==='warehouse'?'warehouse.4':d.id==='bunker'?'bunker.0':d.id;
  if(d.id==='residence')c.population=200;
  setBuilding(c,key,req.level-1);
  const resource=({mill:'food',lumbermill:'wood',masonry:'stone',mint:'gold'} as const)[d.id as 'mill'];if(resource)for(const field of c.fields!.filter(p=>p.resource===resource))field.level=req.variant==='fields'?req.level===1?4:req.level+3:req.level===1?5:req.level+4;
  durationMs=d.id==='center'?d.levels[req.level-1].durationMs:Math.round(d.levels[req.level-1].durationMs*.964**(Math.max(1,c.buildings.center)-1));command={type:'building.upgrade',cityId:c.id,key};steps=['在城市建設頁查看目標建築與鎖定原因。','按「執行本項正式操作」或在建設頁實際建造。','按「下一完成事件」，確認等級＋1、正確扣款與工期，重新保存讀回。'];result=d.id==='wall'?'城牆等級＋1，不占自由槽。':'等級＋1，成本／工期與 v85 相符。';
 }else if(req.kind==='tech'){
  const d=V85.techs.find(d=>d.id===req.target);if(!d)throw new Error('科技測試無效。');name=d.name;line=d.line;age=d.age;requirements=d.buildings;cost=d.cost;milestone=d.milestone;
  f.civilizationId=d.civilizationId??f.civilizationId;
  // This setup grants the engine's extra tier dependencies; it is disclosed, never treated as independently verified v85 text.
  f.techIds=[...(TECH_CATALOG[d.id]?.prerequisites??[])];
  if(d.scope!=='traditional'){f.modernQualification='full';f.researchCooperation=d.scope!=='research-cooperation';}
  durationMs=Math.round(d.baseDurationMs*(d.category==='elite'?1:1-.015*((d.buildings.academy??1)-1)));command={type:'research.start',cityId:c.id,techId:d.id};steps=['到科技頁確認時代、每個建築／本城永久人口前置。','實際按研發，確認只占勢力唯一科技佇列、單城扣款或 D1 投入階段。','資源投入齊後按「下一完成事件」，查看勢力已完成科技；再到另一城核對共通科技與本城資格。'];result=d.scope.startsWith('modern')?'先建立 funding 專案，投入四資源集滿後才 researching；完成只解鎖科技狀態，現代效果待 B9。':'研究完成加入勢力科技；資料吻合不代表戰鬥效果已驗證。';
 }else if(req.kind==='unit'){
  const d=V85.units.find(d=>d.id===req.target);if(!d)throw new Error('兵種測試無效。');name=d.name;line=d.line;age=d.age;requirements={[d.producer]:req.level};cost=d.cost;milestone=d.milestone;f.civilizationId=d.civilizationId??f.civilizationId;
  if(d.eliteTech)f.techIds=[d.eliteTech];if(d.baseId)c.military!.units[d.baseId]=10;
  populationChange=-d.population;durationMs=d.id==='scout'?90000:Math.round(d.baseDurationMs*(1-.5*(req.level-1)/14));command={type:'military.recruit',cityId:c.id,unitId:d.id,count:1};steps=['到軍隊頁記下原有普通兵（精銳情境保留10名）。','實際招募一名，確認扣人口／資源與訓練工期。','按「下一完成事件」核對新兵；舊普通兵應保持不變。','再招募後取消、解散存活新兵，核對100%人口與80%取消退款。'];result=d.baseId?'原有10名普通兵不變，新訓練一名為指定精銳兵；成本／人口／糧耗／行軍與載重不改。':'新增指定兵種一名；建築等級改訓練時間，不改基礎戰鬥數值。';
 }else{
  const d=AGE_EXPECTED.find(d=>d.targetAge===Number(req.target));if(!d)throw new Error('時代測試無效。');name=['','晉升封建','晉升城堡','晉升帝王'][d.targetAge];line=2342;age=d.targetAge-1;requirements={center:d.center};cost=d.cost;c.population=d.population;
  durationMs=d.durationMs;command={type:'age.start',cityId:c.id};steps=['在科技／時代頁查看人口、中心與庫存。','實際開始晉升，可同時建造或研發一般科技。','按「下一完成事件」，確認整個勢力時代提升，未免費得到建築／科技。'];result='按固定4／8／16世界時完成；與學院加速無關。';
 }
 for(const [k,lv] of Object.entries(requirements))setBuilding(c,k,lv);
 f.age=age as 0|1|2|3;c.economy!.milestones=MILESTONES.filter(n=>n<=milestone);if(milestone)c.population=milestone;
 const variant=req.variant,funding=req.kind==='tech'&&V85.techs.find(d=>d.id===req.target)!.scope.startsWith('modern'),blocked=!['ready','population-fallen'].includes(variant)&&!(funding&&variant==='poor')&&!(req.kind==='field'&&req.level<=10&&['milestone','city','housing'].includes(variant));
 if(variant==='age')f.age=Math.max(0,age-1) as 0|1|2|3;
 if(variant==='poor'){const r=Object.keys(cost).find(r=>cost[r]>0) as keyof Resources; if(r)c.stock[r]=funding?0:Math.min(c.stock[r],cost[r]-1);}
 if(variant.startsWith('building:')){const k=variant.slice(9),lv=Math.max(0,(requirements[k]??1)-1);if(k==='warehouse'){for(const existing of Object.keys(c.buildings).filter(k=>k.startsWith('warehouse.')))setBuilding(c,existing,lv);}else setBuilding(c,k,lv);}
 if(variant==='milestone')c.economy!.milestones=[];
 if(variant==='population-fallen')c.population=1000;
 if(variant==='city')c.cityPromotionCompleted=false;
 if(variant==='housing'){setBuilding(c,'residence',11);c.population=Math.min(c.population,c.housing);}
 // Fill only the remaining legal capacity after a warehouse prerequisite is intentionally reduced.
 const cap=800+Object.entries(c.buildings).filter(([k])=>k.startsWith('warehouse.')).reduce((n,[,lv])=>n+V85.warehouseCapacity[lv],0);for(const r of ['food','wood','stone','gold'] as const)c.stock[r]=Math.min(c.stock[r],cap);
 if(variant==='population')c.population--;
 if(variant==='foreign')f.civilizationId=f.civilizationId==='civ_zhongguo'?'civ_japan':'civ_zhongguo';
 if(variant==='modern')f.modernQualification='none';
 if(variant.startsWith('tech:')){f.techIds=f.techIds.filter(t=>t!==variant.slice(5));if(variant==='tech:research.cooperation')f.researchCooperation=false;}
 if(req.kind==='building'&&req.target==='residence')c.population=Math.min(c.population,c.housing);
 validateFormalWorld(w);
 const caps:Record<string,number[]>={civ_zhongguo:[2,3,3,2,2],civ_byzantium:[2,2,3,3,3],civ_frankia:[3,2,2,2,3],civ_britannia:[2,3,2,3,2],civ_japan:[3,2,3,2,2],civ_mongolia:[2,3,2,2,3]};const [,smith,tier]=req.target.split('.'),capBlocks=req.kind==='tech'&&req.target.startsWith('blacksmith.')&&Number(tier)>caps[f.civilizationId][['melee','ranged','infantry-armor','ranged-armor','cavalry-armor'].indexOf(smith)];
 const expectedAdmission=blocked||capBlocks?'block':'allow';return {world:w,info:{key:JSON.stringify([req.kind,req.target,req.level,variant,f.civilizationId,req.config.speed,req.config.seed]),name,sourceLine:line,request:{...req,config:{...req.config,civilizationId:f.civilizationId}},expectedAdmission,steps,expectedCost:(expectedAdmission==='block'||funding||req.kind==='production')?{food:0,wood:0,stone:0,gold:0}:cost as Resources,expectedPopulationChange:expectedAdmission==='block'?0:populationChange,expectedDurationMs:expectedAdmission==='block'?null:durationMs,expectedResult:blocked||capBlocks?'此操作應被拒絕，不扣資源／人口，不新增佇列；先補齊缺少的條件，再實際重試。':result,command}};
}
export function trialPreview(w:FormalWorld,info:TrialInfo){
 if(!info.command)return null;const before=w.cities[0];
 try{const transition=submitFormalOrder(w,developerOrder(w,info.command));const after=transition.world.cities[0],allowed=transition.ack?.status==='committed';const completion=transition.world.events.filter(e=>e.type!=='economy.settle').sort((a,b)=>a.at-b.at)[0];
  let completed:unknown=null;if(allowed&&completion){const done=advanceFormal(transition.world,completion.at).world;completed={at:done.time,city:done.cities[0],techIds:done.factions[0].techIds,age:done.factions[0].age};}
  const deltas={stock:Object.fromEntries(Object.keys(before.stock).map(r=>[r,after.stock[r as keyof Resources]-before.stock[r as keyof Resources]])),population:after.population-before.population};const running=transition.world.researchProjects.at(-1),job=after.economy?.construction.at(-1),training=after.military?.queue.at(-1),actualDuration=allowed?(['building.upgrade','field.upgrade'].includes(info.command.type)?job?.durationMs:info.command.type==='military.recruit'?training?.durationMs:info.command.type==='research.start'?running?.durationSnapshot.durationMs:info.command.type==='age.start'?transition.world.factions[0].ageQueue?.durationMs:info.command.type==='city.promote'?after.economy?.promotion?.durationMs:info.command.type==='settlement.prepare'?transition.world.settlements?.at(-1)?.prepDurationMs:info.command.type==='logistics.dispatch'?(transition.world.logistics?.at(-1)?.arrivalAt??0)-w.time:null):null;const comparisons=[{label:'四資源實際扣款',expected:info.expectedCost,actual:Object.fromEntries(Object.entries(deltas.stock).map(([k,v])=>[k,-v])),matches:Object.entries(info.expectedCost).every(([k,v])=>-deltas.stock[k]===v)},{label:'啟動人口變化',expected:info.expectedPopulationChange,actual:deltas.population,matches:info.expectedPopulationChange===deltas.population},{label:'世界工期 ms',expected:info.expectedDurationMs,actual:actualDuration,matches:info.expectedDurationMs===actualDuration}];
  return {comparisons,status:allowed=== (info.expectedAdmission==='allow')?'match':'different',expected:info.expectedAdmission==='allow'?'允許':'阻擋',actual:allowed?'允許':'阻擋',reason:transition.ack?.reason??'命令接受',delta:deltas,completion:completed,note:'引擎影子試算，不會保存；親自操作仍待確認。'};
 }catch(e){return {status:'different',expected:info.expectedAdmission,actual:'引擎錯誤',reason:String(e),note:'未取得有效結果，不視為通過。'};}
}
