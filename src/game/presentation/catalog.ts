import {BLACKSMITH_CAPS} from '../formal/techCatalog';
import {TECH_CATALOG} from '../formal/techCatalog';
import {UNIT_CATALOG} from '../formal/unitCatalog';
export const CIV_PRESENTATION:Record<string,{position:string;guardRole:string;military:string;names:string[]}>= {
 civ_zhongguo:{position:'發展經濟、研究科技、連弩支援',guardRole:'徒步連弩手能連續射出密集箭雨，從後方支援前線；需要近戰部隊保護。',military:'均衡的近戰、遠程與步兵護具科技',names:['李承遠','趙景行','陳仲謙','王守誠','劉玄策','林文昭']},
 civ_byzantium:{position:'築起防線、反制敵軍、披甲騎兵',guardRole:'身披重甲的騎兵，以耐久力穩住戰線，適合迎戰敵軍的近戰部隊。',military:'重視步兵與遠程部隊的防護研究',names:['亞歷克修斯','君士坦丁','尼基弗魯斯','米海爾','狄奧多羅斯','約安尼斯']},
 civ_frankia:{position:'重騎突破、主動近戰進攻',guardRole:'手持重斧的徒步衛隊，投出斧刃打擊近處敵軍，為重騎兵提供近戰支援。',military:'重視近戰武器與騎兵防護研究',names:['查理','路易','雨果','羅伯特','菲利普','亨利']},
 civ_britannia:{position:'長弓箭雨、保持距離作戰',guardRole:'長弓手以集中射擊展現遠程火力，擅長在前線後方輸出，但需要保護。',military:'重視遠程武器與弓手防護研究',names:['愛德華','亞瑟','威廉','理查','埃德蒙','哈羅德']},
 civ_japan:{position:'步兵主力、武士進攻',guardRole:'持刀武士以猛烈攻勢衝擊前線，適合以步兵為主力的軍隊。',military:'重視近戰武器與步兵防護研究',names:['源義景','藤原信綱','武田晴信','上杉景政','北條時成','織田信義']},
 civ_mongolia:{position:'騎射機動、支援遠方城邦',guardRole:'騎手在馬背上張弓，兼具遠程射擊與機動能力，能快速轉移位置。',military:'重視近戰武器與騎兵防護研究',names:['巴圖','鐵木倫','阿勒坦','忽圖','蘇赫','額爾登']}
};
export const civilizationDetails=(id:string)=>({ ...CIV_PRESENTATION[id],guard:UNIT_CATALOG['guard.'+id],technologies:Object.values(TECH_CATALOG).filter(t=>t.civilizationId===id),caps:BLACKSMITH_CAPS[id],military:CIV_PRESENTATION[id].military });
export {cultureName,uniqueCultureName} from '../formal/cultureNames';
export const CIV_STORIES:Record<string,string>={
 civ_zhongguo:'以繁盛的田野與精巧的工藝壯大城邦，再用科技帶領軍隊前進。中國適合先打穩經濟，再以連弩的密集箭雨支援前線；考工制度能減少符合條件的研究花費。',
 civ_byzantium:'讓堅城成為軍隊的後盾，以長槍與戰矛迎接敵軍，再由披甲騎兵穩住戰線。拜占庭適合喜歡穩健發展、準備反制部隊的領主，城防與護具是長久經營的優勢。',
 civ_frankia:'馬蹄聲是進攻的號角。法蘭克擅長集中重騎兵突破前線，搭配近戰部隊擴大優勢；想主動出擊、以騎兵為主力，可以從這個文明開始。',
 civ_britannia:'長弓手站在前線後方，將箭雨送往遠處。不列顛適合喜歡遠程火力的領主，以步兵保護弓手，再用長弓與攻城器械逐步壓迫對手。',
 civ_japan:'以紀律整備步兵，讓武士的刀鋒成為城邦的支柱。日本偏重步兵進攻與快速動員，適合用步兵建立主力，再搭配遠程部隊形成完整戰線。',
 civ_mongolia:'沿著草原與河谷前進，以騎射部隊掌握機動。蒙古適合重視速度與遠征補給的領主；騎兵移動與補給科技讓遠方的城邦也能成為發展目標。'
};
