import type {FormalWorld} from './formal/model';
import type {CityId} from './formal/ids';
import {citySnapshot} from './formal/economy';
import {worldPaused} from './formal/extinction';
import type {PreviewContext} from './constructionPreviewProtocol';
/** Outside render only. Local lazy settlement uses Formal cross-city administration/upkeep;
 * only its resulting city values cross the worker boundary. No receipts/events/world clone. */
export function constructionPreviewContext(w:FormalWorld,id:CityId):PreviewContext{
 if(w.economyVersion!==95)throw new Error('舊版經濟尚待正式遷移，無法提供最新預估。');
 const original=w.cities.find(c=>c.id===id);if(!original?.economy)throw new Error('城市資料不完整，無法提供最新預估。');
 const settled=citySnapshot(w,id)!;
 const {id:cityId,ownerFactionId,name,x,y,population,housing,stock,buildings,economy,fields,wallLevel,cityPromotionCompleted,developerResources}=settled;
 return {version:1,time:w.time,paused:worldPaused(w),issuerId:w.playerFactionId,age:w.factions.find(f=>f.id===ownerFactionId)?.age??0,
  city:{id:cityId,ownerFactionId,name,x,y,population,housing,stock,buildings,economy,fields,wallLevel,cityPromotionCompleted,developerResources},
  crafts:Object.fromEntries((w.extinction?.craftsmen??[]).filter(c=>c.cityId===id).map(c=>[c.id,c.ownerFactionId===w.playerFactionId&&!c.eventId&&!c.carrierArmyId&&!c.constructionCommandId]))};
}
