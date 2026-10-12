export {WILD_SITE_NAMES,wildSiteName} from '../formal/wildSiteNames';
/** DEMO display names; no simulation rules or legacy state are imported. */
export const WILD_SITE_GLYPHS={food:'糧',wood:'木',stone:'石',gold:'金',bandit:'寇'} as const;
export type MapGlyph={text:string;x:number;y:number;size:number;color:string;priority:number};
/** Paint last, with DEMO selected/owned/city priorities and overlap suppression. */
export function paintMapGlyphs(ctx:CanvasRenderingContext2D,glyphs:MapGlyph[]){
 const placed:MapGlyph[]=[];ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 for(const glyph of [...glyphs].sort((a,b)=>b.priority-a.priority)){
  if(!glyph.text||placed.some(p=>Math.abs(p.x-glyph.x)<(p.size+glyph.size)/2&&Math.abs(p.y-glyph.y)<(p.size+glyph.size)/2))continue;
  placed.push(glyph);ctx.font=`bold ${glyph.size}px serif`;ctx.lineWidth=3;ctx.strokeStyle='#162218';ctx.shadowColor='#10180f';ctx.shadowBlur=3;ctx.shadowOffsetY=1;ctx.strokeText(glyph.text,glyph.x,glyph.y);ctx.fillStyle=glyph.color;ctx.fillText(glyph.text,glyph.x,glyph.y);
 }ctx.restore();
}
