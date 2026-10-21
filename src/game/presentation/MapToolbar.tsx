type Props={expanded:boolean;territory:boolean;labels:boolean;favorites:number;onToggleTools:()=>void;onZoom:(factor:number)=>void;onReturn:()=>void;onOverview:()=>void;onXY:()=>void;onTerritory:()=>void;onLabels:()=>void;onDisplay?:()=>void;onFavorites:()=>void};
/** DEMO toolbar: the ellipsis expands actions and does not open a floating panel. */
export function MapToolbar(p:Props){
 return <div className="map-tools map-tools-v8">
  <button aria-label="放大地圖" onClick={()=>p.onZoom(1.3)}>＋</button>
  <button aria-label="縮小地圖" onClick={()=>p.onZoom(1/1.3)}>−</button>
  <button className="map-tool-toggle" aria-label={p.expanded?'收起地圖工具':'展開地圖工具'} aria-expanded={p.expanded} aria-controls="map-extra-tools" onClick={p.onToggleTools}>⋯</button>
  <div id="map-extra-tools" className={'map-extra-tools '+(p.expanded?'expanded':'')}>
   <button onClick={p.onReturn}>回城</button><button onClick={p.onOverview}>全區</button>
   <button onClick={p.onXY}>XY<br/>定位</button>
   <button aria-pressed={p.territory} onClick={p.onTerritory}>帝國<br/>版圖</button>
   <button aria-pressed={p.labels} onClick={p.onDisplay??p.onLabels}>{p.labels?<>隱藏<br/>標示</>:<>顯示<br/>標示</>}</button>
   <button aria-label={`我的最愛 ${p.favorites}/5`} onClick={p.onFavorites}>★ 最愛<br/>{p.favorites}/5</button>
  </div>
 </div>;
}
