import {it,expect} from 'vitest';
import {WILD_SITE_GLYPHS,wildSiteName,paintMapGlyphs,type MapGlyph} from './wildSiteLabels';
import {showMapCaption} from '../mapDisplay';
it('wild sites retain DEMO names across formal levels and DEMO map grain glyph',()=>{
 for(const [resource,name,glyph] of [['food','沃野農莊','糧'],['wood','山林木寨','木'],['stone','採石場','石'],['gold','黃金礦脈','金'],['bandit','盜賊營地','寇']] as const){
  for(const level of [1,10])expect(wildSiteName({resource,level})).toBe(name+' Lv.'+level);
  expect(WILD_SITE_GLYPHS[resource]).toBe(glyph);
 }
});
it('all resource glyphs reach the canvas; selected glyph wins overlapping city and lower priority text',()=>{
 const texts:string[]=[],ctx={save(){},restore(){},strokeText(){},fillText(text:string){texts.push(text);}} as unknown as CanvasRenderingContext2D;
 const glyphs:MapGlyph[]=Object.values(WILD_SITE_GLYPHS).map((text,i)=>({text,x:i*40,y:0,size:14,color:'#bec1b7',priority:0}));
 paintMapGlyphs(ctx,glyphs);expect(texts).toEqual(['糧','木','石','金','寇']);texts.length=0;
 paintMapGlyphs(ctx,[{...glyphs[0],text:'中',priority:1},{...glyphs[0],text:'糧',priority:3},glyphs[1]]);expect(texts).toEqual(['糧','木']);
});
it('resource level captions keep the DEMO label toggle and selection/drag/zoom rules',()=>{
 expect(showMapCaption(false,false,.75,true,false)).toBe(false);
 expect(showMapCaption(false,true,.75,false,false)).toBe(true);
 expect(showMapCaption(false,true,.75,false,true)).toBe(false);
 expect(showMapCaption(false,true,.3,true,true)).toBe(true);
 expect(showMapCaption(false,true,.2,true,false)).toBe(false);
 expect(showMapCaption(true,true,.75,true,false)).toBe(false);
});
