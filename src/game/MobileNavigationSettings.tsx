import {useState,type ReactNode} from 'react';
import {RELEASE} from './release';
import {NAV,type View} from './presentation/Shell';
import {Dialog} from './presentation/UI';
import {DEFAULT_MOBILE_SHORTCUTS,MAX_MOBILE_SHORTCUTS} from './mobileNavigationPreferences';
import {NavigationBadge,type NavigationReminders} from './NavigationReminder';

export function MobileMoreMenu({shortcuts,view,onNavigate,onHome,onCustomize,reminders,children}:{shortcuts:View[];view:View;onNavigate:(id:View)=>void;onHome:()=>void;onCustomize:()=>void;reminders:NavigationReminders<View>;children:ReactNode}){
  return <><div className="mobile-more"><button onClick={onHome}>列國征途首頁 · v{RELEASE.version}</button>{NAV.filter(n=>n.id==='settings'||!shortcuts.includes(n.id)).map(n=><button key={n.id} data-nav-id={n.id} className={(view===n.id?'active ':'')+(reminders[n.id]?.attention?'has-unread':'')} aria-current={view===n.id?'page':undefined} onClick={()=>onNavigate(n.id)}><span>{n.icon} {n.name}</span><NavigationBadge reminder={reminders[n.id]} label={n.name}/></button>)}<button onClick={onCustomize}>自訂底部快捷列</button></div>{children}</>;
}
export function MobileNavigationSettings({shortcuts,onSave,onClose}:{shortcuts:View[];onSave:(ids:View[])=>void;onClose:()=>void}){
  const [draft,setDraft]=useState(shortcuts);
  const move=(index:number,delta:number)=>{const next=[...draft];[next[index],next[index+delta]]=[next[index+delta],next[index]];setDraft(next);};
  return <Dialog title="自訂底部快捷列" onClose={onClose} className="mobile-shortcut-dialog"><p>最多選擇六個功能，也可以少於六個。未選功能可從「更多」開啟。設定僅儲存在這台裝置，獨立於戰役存檔。</p><p role="status">已選 {draft.length}／{MAX_MOBILE_SHORTCUTS}</p><ol className="mobile-shortcut-order" aria-label="快捷列順序">{draft.map((id,index)=>{const n=NAV.find(n=>n.id===id)!;return <li key={id}><span>{n.icon} {n.name}</span><div><button aria-label={`將${n.name}向前移`} disabled={index===0} onClick={()=>move(index,-1)}>↑</button><button aria-label={`將${n.name}向後移`} disabled={index===draft.length-1} onClick={()=>move(index,1)}>↓</button><button aria-label={`移除${n.name}`} onClick={()=>setDraft(draft.filter(v=>v!==id))}>移除</button></div></li>;})}</ol><div className="mobile-shortcut-options" aria-label="可加入的功能">{NAV.filter(n=>!draft.includes(n.id)).map(n=><button key={n.id} disabled={draft.length>=MAX_MOBILE_SHORTCUTS} onClick={()=>setDraft([...draft,n.id])}>加入{n.name}</button>)}</div><div className="dialog-actions"><button onClick={()=>setDraft([...DEFAULT_MOBILE_SHORTCUTS])}>恢復預設</button><button onClick={onClose}>取消</button><button className="primary" onClick={()=>onSave(draft)}>儲存快捷列</button></div></Dialog>;
}
