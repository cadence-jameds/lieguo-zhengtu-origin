import {z} from 'zod';
import {CIVILIZATIONS} from '../formal/generator';
import type {FormalWorld} from '../formal/model';
import {UNIT_CATALOG} from '../formal/unitCatalog';
import {effectiveSpeed} from '../formal/playtest';
import {tacticalRoundWorldMs} from '../formal/battles';
export const B5_LAB_SUFFIX='B5CombatLab-v1';
export const LAB_SCENARIOS={empty:'空城',ordinary:'普通守軍',mixed:'混編大軍',wall:'城牆測試',counter:'反偵察斥候'} as const;
export type LabScenario=keyof typeof LAB_SCENARIOS;
export const LAB_PRESETS:Record<LabScenario,Record<string,number>>={empty:{},ordinary:{militia:30,spearman:20,archer:10},mixed:{militia:500,spearman:500,archer:300,knight:100},wall:{militia:30,spearman:20,archer:10},counter:{scout:5,militia:30}};
const count=z.number().int().min(0).max(10000);
export const labUnitsSchema=z.record(count).refine(u=>Object.keys(u).every(id=>!!UNIT_CATALOG[id]),'未知正式兵種');
const stock=z.object({food:z.number().int().min(0).max(1000000),wood:z.number().int().min(0).max(1000000),stone:z.number().int().min(0).max(1000000),gold:z.number().int().min(0).max(1000000)}).strict();
export const labConfigSchema=z.object({seed:z.number().int().min(0).max(4294967295),civilizationId:z.enum(CIVILIZATIONS),targetCityId:z.string().regex(/^city:[A-Za-z0-9_.-]{1,100}$/).optional(),scenario:z.enum(['empty','ordinary','mixed','wall','counter']),wallLevel:z.number().int().min(0).max(15),playerWallLevel:z.number().int().min(0).max(15),speed:z.union([z.literal(50),z.literal(200)]),playerUnits:labUnitsSchema,enemyUnits:labUnitsSchema,enemyStock:stock}).strict();
export type LabConfig=z.infer<typeof labConfigSchema>;
export const defaultLabConfig=(seed:number,civilizationId:LabConfig['civilizationId']):LabConfig=>({seed,civilizationId,scenario:'ordinary',wallLevel:0,playerWallLevel:0,speed:50,playerUnits:{militia:1000,spearman:300,archer:300,knight:80,ram:40,catapult:30,baggage:30,scout:10},enemyUnits:{...LAB_PRESETS.ordinary},enemyStock:{food:10000,wood:10000,stone:10000,gold:10000}});

export function labTarget(w:FormalWorld,id?:string){const home=w.cities[0];return id?w.cities.find(c=>c.id===id):w.cities.filter(c=>c.ownerFactionId!==w.playerFactionId).sort((a,b)=>Math.hypot(a.x-home.x,a.y-home.y)-Math.hypot(b.x-home.x,b.y-home.y))[0];}

export function labActiveTarget(w:FormalWorld){const id=w.campaignId.match(/^campaign:b5lab-([0-9]{3})-/)?.[1];return id?w.cities.find(c=>c.id==='city:'+id):labTarget(w);}

export function labNextEvent(w:FormalWorld){return w.events.filter(e=>['army.arrive','army.return','combat.round'].includes(e.type)).sort((a,b)=>a.at-b.at)[0];}
export const labTiming=(w:FormalWorld)=>({speed:effectiveSpeed(w),tacticalSpeed:Math.min(effectiveSpeed(w),10),roundWorldMs:tacticalRoundWorldMs(effectiveSpeed(w)),roundRealMs:tacticalRoundWorldMs(effectiveSpeed(w))/effectiveSpeed(w)});
