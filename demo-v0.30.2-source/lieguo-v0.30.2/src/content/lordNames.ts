import {cultureId} from './civilizations';
// Fictional character names, independent of political ownership. No simulation RNG is consumed.
const pools:Record<string,[string[],string[],string]>={
 civ_zhongguo:[['沈','陸','韓','蕭','顧','程','杜','秦'],['文遠','子衡','景行','承岳','懷川','明昭','仲達','元靖'],''],
 civ_byzantion:[['尼基塔','狄奧多羅','安德羅尼科','米海爾','阿歷克修','曼努埃爾','里奧','伊薩克'],['杜卡斯','科穆寧','拉斯卡里斯','福卡斯','阿吉羅斯','斯克勒羅斯','帕萊奧洛哥斯','卡塔卡隆'],'·'],
 civ_frankia:[['雨果','雷諾','蒂博','戈弗雷','路易','亨利','伯納德','羅伯特'],['蒙福爾','德雷','博蒙','拉羅什','瓦朗','布里昂','克萊蒙','莫雷'],'·'],
 civ_britannia:[['愛德蒙','奧斯溫','艾德瑞克','威廉','羅傑','阿爾弗雷德','休','沃爾特'],['艾許頓','溫特伯恩','哈特威爾','雷德福','布萊克伍德','艾許福','林德赫斯特','諾斯科特'],'·'],
 civ_japan:[['相馬','三浦','小笠原','赤松','結城','長尾','淺野','村上'],['晴信','義成','景定','宗久','直綱','政清','忠兼','秀久'],''],
 civ_mongol:[['巴圖','阿勒坦','巴彥','帖木兒','額爾敦','忽蘭','阿日斯蘭','額森'],['巴特爾','卓里格','孟克','額爾克','鐵木格','阿木爾','巴扎爾','朝魯'],'·'],
};
export function lordName(id:string,seed:number){const [first,last,join]=pools[cultureId(id)]??pools.civ_zhongguo;let mixed=seed>>>0;for(const c of cultureId(id))mixed=Math.imul(mixed^c.charCodeAt(0),16777619)>>>0;const ordinal=Number(id.split('~')[1]??0);const pick=(mixed+ordinal*17)%(first.length*last.length);return first[Math.floor(pick/last.length)]+join+last[pick%last.length];}
