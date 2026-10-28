import {assetURL} from './presentation/artMap';
import {cultureId,civilizations} from '../content/civilizations';
export function MiniatureCity({civ,era,wall}:{civ:string;era:number;wall:number}){
 const index=Math.max(0,civilizations.findIndex(c=>c.id===cultureId(civ))),col=index%3,row=Math.floor(index/3);
 return <span className={'miniature-city'+(wall>0?' walled':'')}>{wall>0&&<img className="miniature-city-wall wall-rear" src={assetURL(era===3?'art/unified/wall-ring-imperial.webp':'art/wall-ring-'+era+'.webp')} alt=""/>}<span className="miniature-city-art" style={{backgroundImage:`url(${assetURL(era===3?'art/unified/cities-imperial.webp':`art/cities-age-${era}.webp`)})`,backgroundPosition:`${col*50}% ${row*100}%`}}/>{wall>0&&<img className="miniature-city-wall wall-front" src={assetURL(era===3?'art/unified/wall-ring-imperial.webp':'art/wall-ring-'+era+'.webp')} alt=""/>}</span>;
}
