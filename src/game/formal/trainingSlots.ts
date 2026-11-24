import type {WorldRead} from '../presentationModel';
import type {FormalCity} from './model';

/** The castle retains its time lane; only unfinished preparation uses a shared city slot. */
export const preparingSettlement=(w:WorldRead,c:Pick<FormalCity,'id'>)=>
 w.settlements?.find(p=>p.sourceCityId===c.id&&p.phase==='preparing');
export const trainingSlotsUsed=(w:WorldRead,c:Pick<FormalCity,'id'|'military'>)=>
 (c.military?.queue.length??0)+Number(!!preparingSettlement(w,c));
