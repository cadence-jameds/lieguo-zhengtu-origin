/** Content identity is independent of release/commit identity: unchanged art keeps its cache key. */
declare const __ART_REVISIONS__:Record<string,string>;
export const ART_CACHE='lieguo-art-content-v1';
export const assetURL=(path:string)=>{
 const embedded=globalThis.__FORMAL_EMBEDDED_ASSETS?.[path];if(embedded)return embedded;
 const revision=typeof __ART_REVISIONS__==='undefined'?undefined:__ART_REVISIONS__[path];
 return import.meta.env.BASE_URL+path+(revision?'?art='+revision:'');
};
