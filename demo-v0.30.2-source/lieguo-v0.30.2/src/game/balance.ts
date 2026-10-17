import {FIELD_BASE_OUTPUT,FIELD_LEVEL_FACTORS,FIELD_BUILD_SECONDS,FIELD_COST_GROWTH} from '../config/economy';
import type { Building, Stock } from './types';

export const BALANCE_VERSION = 21;
export const STARTING_STOCK: Stock = { food: 1000, wood: 1100, stone: 800, gold: 600 };
// All cities receive continuous level-zero income from their eighteen natural parcels.
export const BASE_PRODUCTION: Stock = { food: 0, wood: 0, stone: 0, gold: 0 };
export const RESOURCE_OUTPUT: Stock = FIELD_BASE_OUTPUT;
export const LEVEL_OUTPUT = FIELD_LEVEL_FACTORS;
export const BUILD_COST_GROWTH = FIELD_COST_GROWTH;
export const SOLDIER_UPKEEP = .6;
export const POPULATION_BASE_GROWTH = 60;
export const POPULATION_HALL_GROWTH = 15;
export const buildSeconds = (building: Building) =>
  ['farm','lumber','quarry','mine'].includes(building) ? FIELD_BUILD_SECONDS :
  building === 'castle' ? [900,1800,3600,7200,14400] :
  building === 'hall' ? [120,360,1080,3000,7200] :
  building === 'wall' ? [120,360,1200,3600,9000] :
  ['barracks','range','stable','workshop'].includes(building) ? [90,300,900,2700,6600] : [60,180,600,1800,4500];

export const HOUSING_PER_LEVEL = 500;

export const CELLAR_PROTECTION=[0,500,1000,1750,2500,3500];
export const CARAVAN_CAPACITY=500;
export const CARAVANS_PER_MARKET_LEVEL=5;
