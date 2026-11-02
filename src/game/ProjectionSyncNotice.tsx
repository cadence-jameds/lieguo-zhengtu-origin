import {useSyncExternalStore} from 'react';
import type {PresentationStore} from './presentationStore';
export function ProjectionSyncNotice({store,onRetry}:{store:PresentationStore;onRetry:()=>void}){
 const health=useSyncExternalStore(store.subscribe,store.getHealth,store.getHealth);
 if(health.state!=='recovering'&&health.state!=='blocked')return null;
 return <aside className="projection-sync-notice" role="status"><strong>{health.state==='blocked'?'畫面同步需要處理':'正在重新同步畫面'}</strong><p>{health.reason} 正式命令與存檔保留。</p><button onClick={onRetry}>重新同步畫面</button></aside>;
}
