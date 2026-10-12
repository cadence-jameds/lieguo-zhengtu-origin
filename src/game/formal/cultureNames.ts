/** Presentation names are deterministic; IDs and map RNG remain independent. */
const pools:Record<string,{lords:string[];families:string[];places:string[];ends:string[]}>= {
 civ_zhongguo:{lords:'承遠 景行 仲謙 守誠 玄策 文昭 明軒 子謙 景瑞 伯安 志衡 仲岳 元朗 崇文 彥章 逸川 世安 弘毅 清和 嘉祐 道寧 思齊 允武 望舒'.split(' '),families:'李 趙 陳 王 劉 林 楊 張 周 吳 徐 孫 朱 馬 胡 郭 何 高 梁 鄭 謝 韓 唐 沈'.split(' '),places:'青雲 長寧 白河 龍泉 雲嶺 北辰 松風 景陽 臨江 豐原 安平 崇德 清溪 東陵 望岳 瑞安 金陵 玉川 玄武 明州 武陵 永昌 鳳林 滄浪'.split(' '),ends:'城 州 郡 關 亭 原 谷 陵 港 鎮'.split(' ')},
 civ_byzantium:{lords:'亞歷克修斯 君士坦丁 尼基弗魯斯 米海爾 狄奧多羅斯 約安尼斯 巴西爾 曼努埃爾 安德羅尼科斯 伊薩克 利奧 羅曼努斯 斯特凡 德米特里 阿納斯塔修斯 尼古拉斯'.split(' '),families:'科穆寧 杜卡斯 拉斯卡里斯 巴列奧略 福卡斯 斯克萊羅斯 卡塔庫齊諾 安傑洛斯 阿爾吉羅斯 博塔尼亞蒂斯 庫爾庫阿斯 塔羅尼特斯 馬尼亞克斯 達拉塞諾斯 塞勒達里斯 梅利塞諾斯'.split(' '),places:'金角 紫冠 聖索菲亞 博斯普魯斯 尼西亞 阿德里安 愛琴 特拉比松 狄奧多西 波菲里亞 卡帕多奇亞 塞薩洛尼基 科林斯 安納托利亞 安提阿 拉文納'.split(' '),ends:'堡 城 港 關 山城 海灣 新城 省城'.split(' ')},
 civ_frankia:{lords:'查理 路易 雨果 羅伯特 菲利普 亨利 阿爾諾 伯納德 吉爾伯特 傑拉爾 雷蒙 德尼 埃蒂安 皮埃爾 羅蘭 阿蘭'.split(' '),families:'蒙特勒 克萊蒙 瓦盧瓦 奧爾良 布列塔尼 阿基坦 諾曼第 普瓦圖 洛林 安茹 波旁 香檳 勃艮第 圖盧茲 阿爾托瓦 皮卡第'.split(' '),places:'白石 聖馬丁 蒙特河 勃艮第 洛林 香檳 奧爾良 布列塔尼 紅楓 金橡 聖德尼 普羅旺斯 阿爾勒 里昂 索姆河 塞納'.split(' '),ends:'堡 城 莊 河港 關 新城 橋 岬'.split(' ')},
 civ_britannia:{lords:'愛德華 亞瑟 威廉 理查 埃德蒙 哈羅德 奧斯瓦德 阿爾弗雷德 托馬斯 羅傑 沃爾特 傑弗里 納撒尼爾 史蒂芬 羅伯特 西蒙'.split(' '),families:'蘭開斯特 約克 伍德沃德 阿什頓 貝克特 哈靈頓 溫徹斯特 梅里克 格雷斯頓 布萊克伍德 斯特林 菲茨羅伊 霍桑 彭布羅克 拉德克利夫 格洛斯特'.split(' '),places:'橡林 白崖 銀溪 石橋 雪松 北郡 綠丘 長弓 東岸 玫瑰 約克 溫徹 西福 泰晤士 柳灣 霧谷'.split(' '),ends:'堡 郡 城 港 莊 林鎮 山城 河口'.split(' ')},
 civ_japan:{lords:'義景 信綱 晴信 景政 時成 信義 政宗 隆景 義忠 信盛 忠勝 元親 秀忠 宗茂 景勝 義弘'.split(' '),families:'源 藤原 武田 上杉 北條 織田 毛利 島津 伊達 德川 長宗我部 真田 大友 淺井 尼子 今川'.split(' '),places:'櫻川 松原 青葉 月見 霞野 白鶴 風早 玉名 秋月 黑川 雲見 靜岡 楓谷 日向 鳴海 長濱'.split(' '),ends:'城 里 關 港 原 谷 岡 島'.split(' ')},
 civ_mongolia:{lords:'巴圖 鐵木倫 阿勒坦 忽圖 蘇赫 額爾登 拔都 博爾術 木華黎 速不臺 合撒兒 札木合 也速格 貝勒古台 汗巴特 布日格德'.split(' '),families:'巴雅爾 巴特爾 那日松 達賴 蒙克 烏日根 博爾濟吉特 額爾德尼 敖登 朝魯 賽罕 哈達 蘇日格 巴音 阿古拉 塔拉'.split(' '),places:'青狼 金帳 白馬 斡難 克魯倫 鄂爾渾 草原 蒼鷹 月泉 塔拉 阿爾泰 薩彥 巴音 杭愛 古爾班 天山'.split(' '),ends:'營 城 河灣 山口 牧地 草甸 新營 湖畔'.split(' ')}
};
export function cultureName(civ:string,roll:number,kind:'lord'|'city'='lord'){
 const p=pools[civ];if(!p)throw Error('Unknown culture');const r=Math.abs(Math.trunc(roll));
 if(kind==='city'){const a=p.places[r%p.places.length],b=p.ends[Math.floor(r/p.places.length)%p.ends.length];const cycle=Math.floor(r/(p.places.length*p.ends.length));return cycle?a+p.places[cycle%p.places.length]+b:a+b;}
 const given=p.lords[r%p.lords.length],family=p.families[Math.floor(r/p.lords.length)%p.families.length];return civ==='civ_zhongguo'||civ==='civ_japan'?family+given:given+'・'+family;
}
export function uniqueCultureName(civ:string,roll:number,kind:'lord'|'city',used:Iterable<string>){
 const seen=new Set(used);for(let i=0;i<100000;i++){const candidate=cultureName(civ,roll+i,kind);if(!seen.has(candidate))return candidate;}throw Error('Name pool exhausted');
}
