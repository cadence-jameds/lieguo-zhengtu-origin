import {legacyCityGroundOffset} from './presentation/legacyMiniature';
import type {CSSProperties} from 'react';
import {IMPERIAL_MINIATURE} from './presentation/cityVisuals';
import {assetURL} from './presentation/artMap';
import {cultureId,civilizations} from '../content/civilizations';
export function MiniatureCity({civ,era,wall}:{civ:string;era:number;wall:number}){
 const index=Math.max(0,civilizations.findIndex(c=>c.id===cultureId(civ))),col=index%3,row=Math.floor(index/3);
 const [scale,y]=IMPERIAL_MINIATURE[cultureId(civ)]??[1,0],ground=legacyCityGroundOffset(cultureId(civ),era,wall);
 return <span className={'miniature-city'+(wall>0?' walled':'')+(era===3?' imperial':'')+(ground!==undefined?' grounded-legacy':'')} style={{'--city-art-scale':scale,'--city-art-y':y+'%',...(ground!==undefined?{'--legacy-ground-y':ground+'%'}:{})} as CSSProperties}>{wall>0&&<img className="miniature-city-wall wall-rear" src={assetURL(era===3?'art/unified/wall-ring-imperial.webp':'art/wall-ring-'+era+'.webp')} alt=""/>}<span className="miniature-city-art" style={{backgroundImage:`url(${assetURL(era===3?'art/unified/cities-imperial.webp':`art/cities-age-${era}.webp`)})`,backgroundPosition:`${col*50}% ${row*100}%`}}/>{wall>0&&<img className="miniature-city-wall wall-front" src={assetURL(era===3?'art/unified/wall-ring-imperial.webp':'art/wall-ring-'+era+'.webp')} alt=""/>}</span>;
}
