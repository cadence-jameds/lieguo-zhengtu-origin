import type {FormalWorld} from './model';
import {nativeMetadata} from './versions';
import {initialCombat} from './combatModel';
import {populateWild} from './wildLifecycle';
/** Only checksum-verified Formal B4 saves may reach this deterministic domain extension. */
export function migrateCombatB5(w:FormalWorld){if(w.fixture||w.metadata.schemaVersion!==2)return w;const next=structuredClone(w);next.metadata={...nativeMetadata(),terrainVersion:2};next.combat=initialCombat();for(const s of next.worldLayer!.wildSites)populateWild(next,s);return next;}
