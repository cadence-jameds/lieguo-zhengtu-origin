import {HOUR} from './time';

// Pure locked project values must initialize before any command/schema import cycle.
export const WONDER_COST=Object.freeze({food:4000000,wood:7000000,stone:9000000,gold:4000000});
export const WONDER_DURATION=24*HOUR;
export const WONDER_MAX_DURABILITY=120000;
export const WONDER_FULL_REPAIR_COST=Object.freeze({food:1000000,wood:1750000,stone:2250000,gold:1000000});
export const WONDER_FULL_REPAIR_DURATION=12*HOUR;
export const BREAKTHROUGH_COST=Object.freeze({food:15000000,wood:15000000,stone:10000000,gold:20000000});
export const BREAKTHROUGH_DURATION=48*HOUR;
