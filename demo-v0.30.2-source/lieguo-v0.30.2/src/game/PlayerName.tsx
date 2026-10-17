import {useState} from 'react';
import type {Command} from './types';
export function PlayerName({name,issue,busy}:{name:string;issue:(c:Command)=>void;busy:boolean}){
 const [draft,setDraft]=useState(name);
 return <section className="card"><h2>玩家名字</h2><p>目前領主：{name}</p><form onSubmit={e=>{e.preventDefault();issue({type:'rename',name:draft});}}><label>領主名字<input value={draft} maxLength={24} required onChange={e=>setDraft(e.target.value)} /></label><p>1～24 字，免費、不限修改次數。既有戰報保留當時的名字。</p><button className="primary" disabled={busy||!draft.trim()||draft.trim()===name}>儲存名字</button></form></section>;
}
