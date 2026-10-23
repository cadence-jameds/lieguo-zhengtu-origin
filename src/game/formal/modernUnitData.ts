/** v94 §12.6.3 / §12.6.9. Production, population, upkeep and role inherit the source line. */
export type ModernUnitRow=readonly [source:string,name:string,hp:number,attack:number,melee:number,ranged:number,interval:number,seconds:number,carry:number,minutes:number,food:number,wood:number,stone:number,gold:number];
export const MODERN_UNIT_DATA:readonly ModernUnitRow[]=[
 ['militia','機械化突擊步兵',65,8,2,1,2,12,120,5,180,80,80,260],
 ['spearman','反裝甲步兵',60,7,1,1,2,12,100,6,180,80,180,280],
 ['archer','自動步槍兵',52,9,1,1,2,12,90,6,160,140,100,400],
 ['skirmisher','機槍支援兵',58,5,1,3,2.2,12,100,5,150,180,110,200],
 ['scout','機動偵察隊',0,0,0,0,0,5,0,1,100,120,180,300],
 ['light-cavalry','裝甲偵察車',130,14,3,3,1.8,6,350,10,240,120,320,520],
 ['knight','主力戰車',210,21,5,4,1.8,8,250,15,350,150,650,850],
 ['ram','工兵破障車',300,4,0,10,3,16,0,20,200,400,1200,1400],
 ['catapult','自走火炮',150,32,0,2,5,18,0,30,200,700,1400,2500],
 ['baggage','軍用補給卡車',0,0,0,0,0,14,5000,8,200,800,500,1300],
 ['guard.civ_zhongguo','近衛自動步槍隊',75,10,2,2,1.2,10,150,10,160,140,180,480],
 ['guard.civ_byzantium','帝國重裝甲衛隊',250,23,6,5,1.9,8,300,24,450,150,900,1200],
 ['guard.civ_frankia','近衛擲彈兵',105,14,3,2,1.8,10,180,12,250,200,150,400],
 ['guard.civ_britannia','皇家狙擊衛隊',70,18,1,1,1.55,10,150,14,210,280,210,700],
 ['guard.civ_japan','近衛突擊隊',90,15,4,2,1.65,10,170,14,300,160,220,600],
 ['guard.civ_mongolia','草原機動火力衛隊',135,12,2,3,1.55,5,400,14,320,180,400,700],
];
