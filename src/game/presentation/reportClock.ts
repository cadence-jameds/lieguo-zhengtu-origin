import type {FormalReport} from '../formal/model';
const date=new Intl.DateTimeFormat('zh-TW',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
export const reportTime=(realAt?:number)=>realAt===undefined?'時間未記錄':date.format(realAt);
export const reportEventTime=(r:Pick<FormalReport,'at'|'realAt'|'clockSpeed'>,at:number)=>r.realAt===undefined?undefined:Math.max(0,Math.floor(r.realAt+(at-r.at)/(r.clockSpeed??1)));
