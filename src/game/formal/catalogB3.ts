import type {Resources,FormalCity} from './model';
import {resourceKeys} from './model';
/** v85 > v84 formulas and table times. Center table already includes its previous-level accelerator. */
export const BUILDING_CATALOG = {
  "wall": {
    "baseCost": {"food":30,"wood":70,"stone":160,"gold":40},
    "growth": 1.38,
    "durationMs": [900000,1080000,1320000,1620000,1980000,2400000,3000000,3600000,4500000,5400000,6600000,8100000,9900000,12000000,16200000],
    "age": 0,
    "prerequisites": {"center":1},
    "maxLevel": 15
  },
  "center": {
    "baseCost": {
      "food": 30,
      "wood": 110,
      "stone": 65,
      "gold": 95
    },
    "growth": 1.44,
    "durationMs": [
      900000,
      1200000,
      1500000,
      1920000,
      2400000,
      3000000,
      3600000,
      4500000,
      5700000,
      7200000,
      9000000,
      10800000,
      13200000,
      16200000,
      21600000
    ],
    "age": 0,
    "prerequisites": {},
    "maxLevel": 15
  },
  "residence": {
    "baseCost": {
      "food": 25,
      "wood": 85,
      "stone": 75,
      "gold": 65
    },
    "growth": 1.41,
    "durationMs": [
      600000,
      720000,
      900000,
      1080000,
      1320000,
      1620000,
      1980000,
      2400000,
      3000000,
      3900000,
      5100000,
      6600000,
      8700000,
      11400000,
      16200000
    ],
    "age": 0,
    "prerequisites": {},
    "maxLevel": 15
  },
  "warehouse": {
    "baseCost": {
      "food": 40,
      "wood": 130,
      "stone": 160,
      "gold": 90
    },
    "growth": 1.28,
    "durationMs": [
      667000,
      873000,
      1113000,
      1391000,
      1714000,
      2088000,
      2522000,
      3026000,
      3610000,
      4287000,
      5073000,
      5985000,
      7042000,
      8269000,
      9692000
    ],
    "age": 0,
    "prerequisites": {},
    "maxLevel": 15
  },
  "bunker": {
    "baseCost": {
      "food": 10,
      "wood": 40,
      "stone": 50,
      "gold": 30
    },
    "growth": 1.28,
    "durationMs": [
      250000,
      390000,
      552000,
      741000,
      959000,
      1213000,
      1507000,
      1848000,
      2244000,
      2703000,
      3235000,
      3853000,
      4569000,
      5400000,
      6364000
    ],
    "age": 0,
    "prerequisites": {},
    "maxLevel": 15
  },
  "market": {
    "baseCost": {
      "food": 50,
      "wood": 120,
      "stone": 60,
      "gold": 70
    },
    "growth": 1.36,
    "durationMs": [
      900000,
      1080000,
      1320000,
      1620000,
      1980000,
      2400000,
      3000000,
      3600000,
      4500000,
      5400000,
      6600000,
      8100000,
      9900000,
      12000000,
      14400000
    ],
    "age": 1,
    "prerequisites": {
      "warehouse": 3
    },
    "maxLevel": 15
  },
  "townhall": {
    "baseCost": {
      "food": 75,
      "wood": 125,
      "stone": 145,
      "gold": 105
    },
    "growth": 1.4,
    "durationMs": [
      1200000,
      1500000,
      1800000,
      2400000,
      3000000,
      3600000,
      4500000,
      5400000,
      6600000,
      8100000,
      9900000,
      12000000,
      15000000,
      18600000,
      23400000
    ],
    "age": 1,
    "prerequisites": {
      "center": 5,
      "residence": 5
    },
    "maxLevel": 15
  },
  "monastery": {
    "baseCost": {
      "food": 80,
      "wood": 110,
      "stone": 140,
      "gold": 70
    },
    "growth": 1.38,
    "durationMs": [
      1200000,
      1500000,
      1800000,
      2280000,
      2880000,
      3600000,
      4500000,
      5400000,
      6600000,
      8100000,
      9900000,
      12000000,
      14400000,
      16500000,
      18000000
    ],
    "age": 2,
    "prerequisites": {
      "townhall": 5
    },
    "maxLevel": 15
  },
  "mill": {
    "baseCost": {
      "food": 100,
      "wood": 250,
      "stone": 250,
      "gold": 150
    },
    "growth": 1.67,
    "durationMs": [
      1200000,
      1800000,
      2400000,
      3600000,
      5400000,
      7800000,
      11100000,
      16200000
    ],
    "age": 1,
    "prerequisites": {},
    "maxLevel": 8
  },
  "lumbermill": {
    "baseCost": {
      "food": 200,
      "wood": 100,
      "stone": 300,
      "gold": 150
    },
    "growth": 1.67,
    "durationMs": [
      1200000,
      1800000,
      2400000,
      3600000,
      5400000,
      7800000,
      11100000,
      16200000
    ],
    "age": 1,
    "prerequisites": {},
    "maxLevel": 8
  },
  "masonry": {
    "baseCost": {
      "food": 200,
      "wood": 300,
      "stone": 100,
      "gold": 150
    },
    "growth": 1.67,
    "durationMs": [
      1200000,
      1800000,
      2400000,
      3600000,
      5400000,
      7800000,
      11100000,
      16200000
    ],
    "age": 1,
    "prerequisites": {},
    "maxLevel": 8
  },
  "mint": {
    "baseCost": {
      "food": 150,
      "wood": 250,
      "stone": 250,
      "gold": 100
    },
    "growth": 1.67,
    "durationMs": [
      1200000,
      1800000,
      2400000,
      3600000,
      5400000,
      7800000,
      11100000,
      16200000
    ],
    "age": 1,
    "prerequisites": {},
    "maxLevel": 8
  },
  "barracks": {
    "baseCost": {
      "food": 40,
      "wood": 90,
      "stone": 50,
      "gold": 20
    },
    "growth": 1.37,
    "durationMs": [
      600000,
      720000,
      900000,
      1200000,
      1500000,
      1800000,
      2400000,
      3000000,
      3600000,
      4500000,
      5700000,
      6900000,
      8700000,
      10800000,
      13500000
    ],
    "age": 0,
    "prerequisites": {
      "center": 2
    },
    "maxLevel": 15
  },
  "archery": {
    "baseCost": {
      "food": 50,
      "wood": 120,
      "stone": 65,
      "gold": 45
    },
    "growth": 1.37,
    "durationMs": [
      720000,
      900000,
      1200000,
      1500000,
      1800000,
      2100000,
      2700000,
      3300000,
      4200000,
      5400000,
      6600000,
      8400000,
      10500000,
      13200000,
      16500000
    ],
    "age": 1,
    "prerequisites": {
      "barracks": 3
    },
    "maxLevel": 15
  },
  "stable": {
    "baseCost": {
      "food": 100,
      "wood": 120,
      "stone": 60,
      "gold": 80
    },
    "growth": 1.37,
    "durationMs": [
      900000,
      1200000,
      1500000,
      1800000,
      2100000,
      2700000,
      3300000,
      4200000,
      5400000,
      6600000,
      8400000,
      10500000,
      13200000,
      16500000,
      20400000
    ],
    "age": 1,
    "prerequisites": {
      "barracks": 5
    },
    "maxLevel": 15
  },
  "blacksmith": {
    "baseCost": {
      "food": 40,
      "wood": 110,
      "stone": 120,
      "gold": 50
    },
    "growth": 1.39,
    "durationMs": [
      900000,
      1080000,
      1320000,
      1620000,
      1980000,
      2400000,
      3000000,
      3600000,
      4500000,
      5700000,
      7200000,
      9000000,
      11400000,
      14400000,
      18000000
    ],
    "age": 1,
    "prerequisites": {
      "barracks": 3
    },
    "maxLevel": 15
  },
  "academy": {
    "baseCost": {
      "food": 60,
      "wood": 130,
      "stone": 90,
      "gold": 170
    },
    "growth": 1.4,
    "durationMs": [
      1200000,
      1500000,
      1800000,
      2400000,
      3000000,
      3600000,
      4500000,
      5700000,
      7200000,
      9000000,
      11400000,
      14400000,
      18000000,
      22500000,
      27000000
    ],
    "age": 1,
    "prerequisites": {
      "blacksmith": 3
    },
    "maxLevel": 15
  },
  "workshop": {
    "baseCost": {
      "food": 60,
      "wood": 220,
      "stone": 180,
      "gold": 90
    },
    "growth": 1.39,
    "durationMs": [
      1500000,
      1800000,
      2280000,
      2880000,
      3600000,
      4500000,
      5700000,
      7200000,
      9000000,
      11400000,
      14400000,
      18000000,
      22500000,
      27900000,
      34200000
    ],
    "age": 2,
    "prerequisites": {
      "academy": 8,
      "center": 8
    },
    "maxLevel": 15
  },
  "castle": {
    "baseCost": {
      "food": 150,
      "wood": 180,
      "stone": 300,
      "gold": 170
    },
    "growth": 1.4,
    "durationMs": [
      2400000,
      3000000,
      3600000,
      4500000,
      5400000,
      6600000,
      8100000,
      9900000,
      12000000,
      14700000,
      18000000,
      21900000,
      26400000,
      31500000,
      36000000
    ],
    "age": 2,
    "prerequisites": {
      "townhall": 5,
      "center": 8
    },
    "maxLevel": 15
  },
  "embassy": {
    "baseCost": {
      "food": 40,
      "wood": 90,
      "stone": 55,
      "gold": 65
    },
    "growth": 1.34,
    "durationMs": [
      720000,
      900000,
      1080000,
      1320000,
      1620000,
      1980000,
      2400000,
      3000000,
      3600000,
      4500000,
      5400000,
      6600000,
      8100000,
      9900000,
      12000000
    ],
    "age": 1,
    "prerequisites": {
      "townhall": 1
    },
    "maxLevel": 15
  }
} as const;
export type BuildingKind = keyof typeof BUILDING_CATALOG;
export const FIELD_PRODUCTION=[9,21,39,63,93,138,210,294,420,609,840,1176,1575,2079,2667,3360] as const;
export const WAREHOUSE_CAPACITY=[0,1800,2550,3450,4650,6000,7500,9450,11700,14400,17700,25000,35000,50000,70000,100000] as const;
export const BUNKER_PROTECTION=[0,200,260,340,440,560,720,920,1200,1540,2000,2800,3800,5200,7200,10000] as const;
export const HOUSING=[0,250,350,500,700,1000,1400,2000,2800,4000,5600,8000,11200,15800,22000,30000] as const;
export const FIELD_BASE_COST:Record<keyof Resources,Resources>={food:{food:20,wood:70,stone:90,gold:70},wood:{food:60,wood:40,stone:100,gold:50},stone:{food:50,wood:80,stone:40,gold:80},gold:{food:60,wood:100,stone:80,gold:30}};
export const round5=(n:number)=>Math.round(n/5)*5;
export const scaleCost=(base:Resources,factor:number):Resources=>Object.fromEntries(resourceKeys.map(r=>[r,round5(base[r]*factor)])) as Resources;
export function fieldCost(resource:keyof Resources,level:number){if(!Number.isInteger(level)||level<1||level>15)throw new Error('Field level');return scaleCost(FIELD_BASE_COST[resource],1.67**(level-1));}
export const constructionMultiplier=(center:number)=>.964**(Math.max(1,center)-1);
export function fieldDuration(resource:keyof Resources,level:number,center:number){const a={food:1450/3,wood:1780/3,stone:1660/3,gold:2350/3}[resource];return Math.round((a*1.6**(level-1)-1000/3)/3*1000*constructionMultiplier(center));}
export function buildingKind(key:string):BuildingKind|undefined {const parts=key.split('.'),kind=parts[0] as BuildingKind;if(!Object.hasOwn(BUILDING_CATALOG,kind))return undefined;if(kind==='warehouse'||kind==='bunker'){if(parts.length!==2||!/^\d+$/.test(parts[1])||+parts[1]>14)return undefined;}else if(parts.length!==1)return undefined;return kind;}
/** wallLevel is the sole completed-wall authority, including future siege readers. */
export function buildingLevel(c:FormalCity,kind:string){if(kind==='wall')return c.wallLevel??0;return Math.max(0,...Object.entries(c.buildings).filter(([k])=>k===kind||k.startsWith(kind+'.')).map(([,v])=>v));}
export const CENTER_STORAGE=800;
export const CITY_WAREHOUSE_MULTIPLIER=1.10;
export const RESOURCE_BOOSTS={mill:'food',lumbermill:'wood',masonry:'stone',mint:'gold'} as const;
export const resourceBoostMultiplier=(level:number)=>1+level*.04;
export const RESOURCE_BOOST_REQUIREMENTS=[0,3,4,5,5,8,10,11,12] as const;
export const resourceBoostRequirement=(next:number)=>RESOURCE_BOOST_REQUIREMENTS[next];
export const ECONOMY_TECH_BONUSES=[.03,.05,.10] as const;
export const economyTechMultiplier=(techIds:readonly string[],resource:keyof Resources)=>1+ECONOMY_TECH_BONUSES.reduce<number>((sum,bonus,i)=>sum+(techIds.includes(`economy.${resource}.${i+1}`)?bonus:0),0);
export const monasteryMultiplier=(level:number)=>1+level*.02;
export const monasteryGoldPerHour=(population:number,level:number)=>Math.min(Math.max(0,population),30000)*level*(level+10)/4500;
export function warehouseBaseCapacity(c:FormalCity){return Object.entries(c.buildings).filter(([k])=>k.startsWith('warehouse.')).reduce((n,[,lv])=>n+WAREHOUSE_CAPACITY[lv],0);}
export function warehouseCapacity(c:FormalCity){return Math.floor(warehouseBaseCapacity(c)*(c.cityPromotionCompleted?CITY_WAREHOUSE_MULTIPLIER:1));}
export function storageCapacity(c:FormalCity){return c.developerResources?1000000000:CENTER_STORAGE+warehouseCapacity(c);}
export function protection(c:FormalCity){return Object.entries(c.buildings).filter(([k])=>k.startsWith('bunker.')).reduce((n,[,lv])=>n+BUNKER_PROTECTION[lv],0);}
export function raidable(c:FormalCity):Resources {const p=protection(c);return Object.fromEntries(resourceKeys.map(r=>[r,Math.max(0,c.stock[r]-p)])) as Resources;}
export function buildingCost(kind:BuildingKind,level:number){const d=BUILDING_CATALOG[kind];if(level<1||level>d.maxLevel)throw new Error('Building level');return scaleCost(d.baseCost,d.growth**(level-1));}
export function buildingDuration(kind:BuildingKind,level:number,center:number){const ms=BUILDING_CATALOG[kind].durationMs[level-1];return kind==='center'?ms:Math.round(ms*constructionMultiplier(center));}
