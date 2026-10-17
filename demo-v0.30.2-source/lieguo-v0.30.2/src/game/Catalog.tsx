import type {ReactNode} from 'react';
import {cultureId,civilizations} from '../content/civilizations';
import {technologyIds} from './content';
import {unitIds,type Unit} from './types';
import {Dialog} from './ui';
export type CatalogArt={sheet:'units'|'guards'|'technologies';index:number};
export const troopArt=(unit:Unit,owner:string):CatalogArt=>unit==='signature'?{sheet:'guards',index:Math.max(0,civilizations.findIndex(c=>c.id===cultureId(owner)))}:{sheet:'units',index:unitIds.indexOf(unit)};
export const techArt=(tech:typeof technologyIds[number]):CatalogArt=>({sheet:'technologies',index:technologyIds.indexOf(tech)});
export function CatalogImage({art}:{art:CatalogArt}){return <span className="catalog-image" aria-hidden="true" style={{backgroundImage:`url(${import.meta.env.BASE_URL}art/catalog-${art.sheet}.webp)`,backgroundPosition:`${art.index%3*50}% ${Math.floor(art.index/3)*100}%`}}/>;}
export function CatalogCard({title,art,children,onClick}:{title:string;art:CatalogArt;children:ReactNode;onClick:()=>void}){return <button className="catalog-card" onClick={onClick}><CatalogImage art={art}/><strong>{title}</strong>{children}</button>;}
export function CatalogDialog({title,children,onClose}:{title:string;art:CatalogArt;children:ReactNode;onClose:()=>void}){return <Dialog title={title} onClose={onClose}><div className="catalog-detail">{children}</div></Dialog>;}
