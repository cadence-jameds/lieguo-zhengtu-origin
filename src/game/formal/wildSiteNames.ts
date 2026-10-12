import type {WildSite} from './model';
export const WILD_SITE_NAMES={food:'沃野農莊',wood:'山林木寨',stone:'採石場',gold:'黃金礦脈',bandit:'盜賊營地'} as const;
export function wildSiteName(site:Pick<WildSite,'resource'|'level'>&{id?:string}){return site.id?.startsWith('wild:exile-')?'流亡軍隊（流）':`${WILD_SITE_NAMES[site.resource]} Lv.${site.level}`;}
