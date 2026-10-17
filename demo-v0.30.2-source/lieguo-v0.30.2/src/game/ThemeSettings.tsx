import {useEffect,useState} from 'react';
export type Theme='classic'|'dark'|'light';
const options:{id:Theme;name:string;description:string}[]=[{id:'classic',name:'經典',description:'墨綠與金色'},{id:'dark',name:'深色',description:'深灰底與柔和灰白字'},{id:'light',name:'淺色',description:'米白底與深色字'}];
export function readTheme():Theme {try{const t=localStorage.getItem('guozhan-theme');return t==='dark'||t==='light'?t:'classic';}catch{return 'classic';}}
export function useTheme(){const [theme,setTheme]=useState<Theme>(readTheme);useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('guozhan-theme',theme);}catch{/* Preference only; gameplay saves are unaffected. */}},[theme]);return {theme,setTheme};}
export function ThemeSettings({theme,onChange}:{theme:Theme;onChange:(theme:Theme)=>void}){return <section className="card theme-settings"><h2>介面主題</h2><div className="theme-options" role="group" aria-label="選擇介面主題">{options.map(t=><button key={t.id} aria-pressed={theme===t.id} onClick={()=>onChange(t.id)}><span className={'theme-swatch '+t.id}/><strong>{t.name}</strong><small>{t.description}</small></button>)}</div><small>此裝置會記住選擇；地圖、建築及敵我標記保持原有美術。</small></section>;}
