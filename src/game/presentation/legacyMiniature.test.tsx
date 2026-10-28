import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {MiniatureCity} from '../MiniatureCity';
import {CIV_ART} from './artMap';
import {legacyCityGroundOffset} from './legacyMiniature';
it('legacy grounding is limited to three lower-row civilizations, three ages and a finished wall',()=>{
 for(const civ of Object.values(CIV_ART))for(const era of [0,1,2,3])for(const wall of [0,5]){
  const markup=renderToStaticMarkup(<MiniatureCity civ={civ} era={era} wall={wall}/>),target=['civ_britannia','civ_japan','civ_mongol'].includes(civ)&&era<3&&wall>0;
  expect(markup.includes('grounded-legacy')).toBe(target);
  if(!target)expect(legacyCityGroundOffset(civ,era,wall)).toBeUndefined();
  if(era===3){expect(markup).toContain('cities-imperial');expect(markup).not.toContain('--legacy-ground-y');}
 }
});
