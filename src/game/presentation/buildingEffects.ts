import {constructionMultiplier,HOUSING,WAREHOUSE_CAPACITY,BUNKER_PROTECTION,resourceBoostMultiplier,monasteryMultiplier,monasteryGoldPerHour} from '../formal/catalogB3';
import {producerMultiplier} from '../formal/unitCatalog';
import {wallDefenseMultiplier} from '../formal/combatModifiers';
import {academyMultiplier} from '../formal/research';
const percent=(multiplier:number)=>((1-multiplier)*100).toFixed(1)+'%';
export function buildingEffect(kind:string,now:number,next:number){
 if(kind==='center')return '施工時間縮短 '+percent(constructionMultiplier(now))+' → '+percent(constructionMultiplier(next));
 if(kind==='academy')return '研究時間縮短 '+percent(academyMultiplier(now))+' → '+percent(academyMultiplier(next))+'（精銳化研究除外）';
 if(kind==='wall')return '守軍防禦加成 '+Math.round((wallDefenseMultiplier(now)-1)*100)+'% → '+Math.round((wallDefenseMultiplier(next)-1)*100)+'%（固定設施，不占自由槽）';
 if(kind==='residence')return '單棟住房容量 '+HOUSING[now]+' → '+HOUSING[next]+' 人';
 if(kind==='warehouse')return '單棟基礎容量（每類） '+WAREHOUSE_CAPACITY[now]+' → '+WAREHOUSE_CAPACITY[next];
 if(kind==='bunker')return '單棟每類保護 '+BUNKER_PROTECTION[now]+' → '+BUNKER_PROTECTION[next];
 if(['mill','lumbermill','masonry','mint'].includes(kind))return '對應資源增產 '+Math.round((resourceBoostMultiplier(now)-1)*100)+'% → '+Math.round((resourceBoostMultiplier(next)-1)*100)+'%';
 if(kind==='monastery')return '人口成長係數 +'+Math.round((monasteryMultiplier(now)-1)*100)+'% → +'+Math.round((monasteryMultiplier(next)-1)*100)+'%；30,000 人信仰奉獻 '+Math.floor(monasteryGoldPerHour(30000,now))+' → '+Math.floor(monasteryGoldPerHour(30000,next))+' 金／世界時（統治初定 ×0.40）';
 if(['barracks','archery','stable','workshop','castle'].includes(kind))return '生產時間倍率 '+(100*producerMultiplier(now)).toFixed(1)+'% → '+(100*producerMultiplier(next)).toFixed(1)+'%';
 if(kind==='market')return '商隊總數 '+now+' → '+next;
 if(kind==='townhall')return '有效行政節點 '+(now>0?1:0)+' → 1（每城一座）';
 if(kind==='embassy')return '外交設施 Lv'+now+' → Lv'+next+'（依正式軍團與帝國資格）';
 if(kind==='blacksmith')return '攻防科技建築資格 Lv'+now+' → Lv'+next+'（依各科技前置）';
 return null;
}
