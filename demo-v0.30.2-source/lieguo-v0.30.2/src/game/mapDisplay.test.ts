import {expect,it} from 'vitest';
import {sceneryRasterScale,showMapCaption} from './mapDisplay';
it('開啟只顯示資源等級，關閉隱藏等級；城市名稱一律不顯示',()=>{
 expect(showMapCaption(false,true,1,false,false)).toBe(true);
 expect(showMapCaption(false,false,1,true,false)).toBe(false);
 for(const labels of [false,true])for(const zoom of [.12,.3,.75,2])for(const selected of [false,true]){
  expect(showMapCaption(true,labels,zoom,selected,false)).toBe(false);
 }
});
it('資源等級保留距離與操作規則，選取不能繞過關閉開關',()=>{
 expect(showMapCaption(false,true,.12,true,false)).toBe(false);
 expect(showMapCaption(false,true,1,false,true)).toBe(false);
 expect(showMapCaption(false,true,1,true,true)).toBe(true);
 expect(showMapCaption(false,false,2,true,false)).toBe(false);
});
it('近景依像素密度升級，操作結束能回到清晰圖層',()=>{
 expect(sceneryRasterScale(2,2)).toBe(4);
 expect(sceneryRasterScale(2,2,true)).toBe(2);
 expect(sceneryRasterScale(.3,1)).toBe(.25);
 expect(sceneryRasterScale(1,1)).toBe(1);
});
