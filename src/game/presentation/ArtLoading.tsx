import {useSyncExternalStore} from 'react';
import {artLoader} from './artLoader';
import {BrandMark} from '../BrandMark';
export function ArtLoading({paths,onCancel}:{paths:readonly string[];onCancel:()=>void}){
 useSyncExternalStore(artLoader.subscribe,artLoader.snapshot,artLoader.snapshot);
 const p=artLoader.progress(paths);
 return <main className="art-loading-screen"><section className="card art-loading-card"><BrandMark/><p className="eyebrow">河谷戰役</p><h1>正在準備河谷世界…</h1><progress max={p.total} value={p.loaded} aria-label="美術資源載入進度"/><p role="status">美術資源 {p.loaded} / {p.total}（{p.percent}%）</p><small>剩餘 {p.remaining} 張圖片</small>{p.failed.length>0&&<div role="alert"><p>有 {p.failed.length} 張必要圖片無法下載。請確認網路連線後重試。</p><button className="primary" onClick={()=>artLoader.retry(p.failed)}>重試圖片下載</button></div>}<button onClick={onCancel}>返回首頁</button></section></main>;
}
