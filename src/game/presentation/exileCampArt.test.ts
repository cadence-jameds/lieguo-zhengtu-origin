import {describe,expect,it} from 'vitest';
import {EXILE_CAMP_ART,exileCampFrame,isExileCamp} from './exileCampArt';
import {MAP_ART} from './artInventory';
import {mapNodeSize} from './mapViewRules';
import {project} from './mapGeometry';

describe('exile camp map art',()=>{
 it('uses the same exile identity as the existing label, not the shared bandit resource class',()=>{
  expect(isExileCamp('wild:exile-00011')).toBe(true);
  expect(isExileCamp('wild:bandit-00011')).toBe(false);
  expect(isExileCamp('wild:iron-00011')).toBe(false);
 });
 it.each([.3,.55,1,1.35])('aligns the sprite footprint to the selected tile at zoom %s',zoom=>{
  const site={x:16,y:34};
  const screen=(p:typeof site)=>{const xy=project(p);return {x:320+xy.x*zoom,y:240+xy.y*zoom};};
  const tileCenter=screen(site),size=mapNodeSize(false,zoom);
  const frame=exileCampFrame(site,screen,size);
  expect(frame.bottom.x).toBe(tileCenter.x);
  expect(frame.bottom.y-frame.height*(1-416/512)).toBeCloseTo(tileCenter.y+10*zoom,8);
  expect(frame.width).toBe(size*3.4);
 });
 it('uses the packaged WebP, separately from the regular resource atlas',()=>{
  expect(EXILE_CAMP_ART).toMatch(/world-exile-camp\.webp/);
  expect(MAP_ART).toContain('art/world-resources.webp');
 });
});
