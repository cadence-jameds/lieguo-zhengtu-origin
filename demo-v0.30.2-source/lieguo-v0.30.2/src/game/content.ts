import {FIELD_COSTS} from '../config/economy';
import {cultureId} from '../content/civilizations';
import { HOUR, MINUTE, type Building, type Stock, type Unit, type Research } from './types';
export const PROTECTION = 20 * HOUR;
export const HEGEMONY_HOLD = 288 * MINUTE;
export const resourceNames = { food: '食物', wood: '木材', stone: '石材', gold: '黃金' };
export const resourceIcons = { food: '穀', wood: '木', stone: '石', gold: '金' };
export const eras = ['黑暗時代', '封建時代', '城堡時代'];
export const stock = (food = 0, wood = 0, stone = 0, gold = 0): Stock => ({ food, wood, stone, gold });
export const buildings: Record<Building, { name: string; symbol: string; cost: Stock; description: string; era: number }> = {
  cellar: { name:'地庫',symbol:'窖',cost:stock(60,100,120,0),description:'每類資源保護量：500／1,000／1,750／2,500／3,500；防掠奪，不增加容量。',era:0 },
  castle: { name:'城堡',symbol:'堡',cost:stock(200,300,650,200),description:'本城文明衛隊的招募前置；升級加快衛隊訓練，不額外疊加城牆防禦。',era:2 },
  hall: { name: '城市中心', symbol: '府', cost: stock(100,140,120,40), description: '提高人口成長，開放時代研究。', era: 0 },
  farm: { name: '農田', symbol: '田', cost: FIELD_COSTS.farm, description: '城郊資源地；零級產出 18 食物／時，逐塊升級增加產量。', era: 0 },
  lumber: { name: '林地', symbol: '林', cost: FIELD_COSTS.lumber, description: '城郊資源地；零級產出 20 木材／時，逐塊升級增加產量。', era: 0 },
  quarry: { name: '石場', symbol: '石', cost: FIELD_COSTS.quarry, description: '城郊資源地；零級產出 15 石材／時，逐塊升級增加產量。', era: 0 },
  mine: { name: '金礦', symbol: '金', cost: FIELD_COSTS.mine, description: '城郊資源地；零級產出 12 黃金／時，逐塊升級增加產量。', era: 0 },
  house: { name: '民居', symbol: '戶', cost: stock(40,90,40,0), description: '每級增加 500 住房，人口會逐漸移入。', era: 0 },
  warehouse: { name: '倉庫', symbol: '倉', cost: stock(60,120,100,0), description: '每級增加 2,500 各類資源容量。資源保護由地庫提供。', era: 0 },
  barracks: { name: '兵營', symbol: '兵', cost: stock(70,120,80,0), description: '招募民兵與槍兵；等級提高會加速訓練。', era: 0 },
  range: { name: '靶場', symbol: '弓', cost: stock(90,180,100,50), description: '封建時代起招募弓兵。', era: 1 },
  stable: { name: '馬廄', symbol: '馬', cost: stock(120,180,100,80), description: '封建時代起招募騎兵。', era: 1 },
  workshop: { name: '攻城工坊', symbol: '械', cost: stock(160,260,200,120), description: '城堡時代二級工坊可製造攻城器。', era: 2 },
  academy: { name: '學院', symbol: '學', cost: stock(80,140,120,80), description: '支持時代升級；科技還需各自的建築與前置研究。', era: 0 },
  market: { name: '市場', symbol: '市', cost: stock(80,130,100,50), description: '開放運輸；首都與分城皆有市場即連接道路，沿路移動加快 50%。每級產出 15 黃金／時。', era: 0 },
  wall: { name: '城牆', symbol: '城', cost: stock(60,100,220,50), description: '黑暗木牆、封建石牆、城堡垛牆；每級提供 18% 守城優勢，攻城器可逐輪破壞。', era: 0 }
};
export const units: Record<Unit, { name: string; cost: Stock; power: number; defense: number; minutes: number; speed: number; building: Building; era: number; role: string }> = {
  militia: { name: '民兵', cost: stock(14,8,0,0), power: 12, defense: 12, minutes: 1/3, speed: 1, building: 'barracks', era: 0, role: '便宜的佔領與駐防主力。' },
  spear: { name: '槍兵', cost: stock(18,12,0,3), power: 16, defense: 21, minutes: 0.5, speed: 1, building: 'barracks', era: 0, role: '對騎兵形成槍陣；畏懼弓兵。' },
  archer: { name: '弓兵', cost: stock(18,22,0,7), power: 25, defense: 14, minutes: 2/3, speed: 1.1, building: 'range', era: 1, role: '壓制槍兵與民兵；畏懼騎兵突入。' },
  cavalry: { name: '騎兵', cost: stock(40,16,0,24), power: 43, defense: 29, minutes: 1.25, speed: 1.65, building: 'stable', era: 1, role: '快速突擊弓兵；畏懼槍陣。' },
  siege: { name: '攻城器', cost: stock(45,70,30,45), power: 25, defense: 12, minutes: 2, speed: .7, building: 'workshop', era: 2, role: '攻城每回合削弱城牆，需要部隊掩護。' },
  scout: { name: '斥候', cost: stock(20,10,0,5), power: 3, defense: 4, minutes: 5/12, speed: 2, building: 'hall', era: 0, role: '取得駐軍情報，報告會標明觀察時間。' },
  signature: { name: '文明衛隊', cost: stock(36,20,0,24), power: 46, defense: 35, minutes: 1.5, speed: 1.1, building: 'castle', era: 2, role: '城堡時代專屬精銳。' }
};
export const research: Record<Research, { name: string; cost: Stock; duration: number; description: string }> = {
  agriculture: {name:'輪作耕作',cost:stock(60,80,0,30),duration:3 * MINUTE,description:'需要農田 1；食物產量 +10%。'},
  carpentry: {name:'木工技術',cost:stock(50,100,0,30),duration:4 * MINUTE,description:'需要林地 1；木材產量 +10%。'},
  forging: {name:'基礎鍛造',cost:stock(100,80,60,100),duration:12 * MINUTE,description:'封建時代、兵營 1；部隊戰力 +5%。'},
  irrigation: {name:'灌溉水利',cost:stock(240,280,180,180),duration:45 * MINUTE,description:'城堡時代、農田 3、輪作耕作；再增加 15% 食物產量。'},
  feudal: { name: '封建制度', cost: stock(400,250,200,150), duration: 30 * MINUTE, description: '城市中心 2、人口 450、學院 1。開放弓兵、騎兵；木牆升為石牆。' },
  castle: { name: '城堡制度', cost: stock(900,650,650,500), duration: 90 * MINUTE, description: '封建時代、城市中心 3、人口 800、兵營 2。開放城堡、拓殖建城與攻城器；建有城堡的城市可招募文明衛隊。' },
  logistics: { name: '補給道路', cost: stock(180,220,100,160), duration: 30 * MINUTE, description: '封建時代、市場 1、木工技術。全國行軍時間縮短 15%；城堡時代將市場道路升為兩倍速度的鋪面道路。' },
  steel: { name: '鍛鋼', cost: stock(260,140,220,280), duration: 60 * MINUTE, description: '城堡時代、兵營 2、基礎鍛造。全國部隊戰力增加 12%。' }
};
export const bonuses: Record<string, string> = {
  civ_zhongguo: '人口成長 +15%，資源產量 +5%。', civ_byzantion: '城防效果 +20%，守軍戰力 +8%。', civ_frankia: '食物產量 +12%，騎兵戰力 +10%。', civ_britannia: '弓兵戰力 +12%，斥候行軍更快。', civ_japan: '步兵戰力 +10%，訓練時間 −10%。', civ_mongol: '全軍行軍時間 −15%，騎兵戰力 +8%。'
};

export const signatureStats:Record<string,{power:number;defense:number;speed:number;cost:Stock;role:string;family:'ranged'|'infantry'|'cavalry'}>={
 civ_zhongguo:{power:42,defense:29,speed:1.1,cost:stock(36,28,0,20),role:'密集弩箭克制輕步兵，近戰防禦較弱。',family:'ranged'},
 civ_byzantion:{power:55,defense:48,speed:1.2,cost:stock(52,16,0,36),role:'重甲騎兵擅長正面衝擊，受槍陣克制。',family:'cavalry'},
 civ_frankia:{power:48,defense:35,speed:1,cost:stock(38,20,0,22),role:'重步兵投斧突擊，適合攻擊輕步兵。',family:'infantry'},
 civ_britannia:{power:50,defense:22,speed:1,cost:stock(36,32,0,24),role:'長弓壓制步兵，需前排保護。',family:'ranged'},
 civ_japan:{power:49,defense:41,speed:1.1,cost:stock(40,16,0,24),role:'高防禦步兵，適合持續交戰。',family:'infantry'},
 civ_mongol:{power:44,defense:28,speed:1.8,cost:stock(44,20,0,28),role:'機動騎射，快速襲擾弓兵與補給。',family:'cavalry'}
};
export const unitStats=(u:Unit,civ:string)=>u==='signature'?{...units[u],...signatureStats[cultureId(civ)]}:units[u];

export const technologyIds = ['agriculture','carpentry','forging','logistics','irrigation','steel'] as const;
export const technologyRequirements:Record<typeof technologyIds[number],{era:number;building:Building;level:number;previous?:Research;symbol:string}>={
 agriculture:{era:0,building:'farm',level:1,symbol:'穀'},carpentry:{era:0,building:'lumber',level:1,symbol:'木'},
 forging:{era:1,building:'barracks',level:1,symbol:'鍛'},logistics:{era:1,building:'market',level:1,previous:'carpentry',symbol:'路'},
 irrigation:{era:2,building:'farm',level:3,previous:'agriculture',symbol:'渠'},steel:{era:2,building:'barracks',level:2,previous:'forging',symbol:'鋼'}
};
