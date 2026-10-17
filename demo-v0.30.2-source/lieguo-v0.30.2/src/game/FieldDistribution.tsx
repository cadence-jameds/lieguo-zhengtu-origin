import {fieldBuildings,fieldNames,fieldCounts,resourceLayout} from './resourceFields';
import type {Game,Point} from './types';
export function FieldDistribution({g,point}:{g:Game;point:Point}){const counts=fieldCounts(resourceLayout(g.seed,point));return <p className="field-composition-summary" aria-label="此地資源配置">{fieldBuildings.map(b=><span key={b}>{fieldNames[b]} <strong>{counts[b]}</strong></span>)}<small>共 18 塊</small></p>;}
