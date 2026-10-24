/** Presentation only. Each feature supplies its own count and attention state. */
export type NavigationReminder={count?:number;attention?:boolean};
export type NavigationReminders<T extends string>=Partial<Record<T,NavigationReminder>>;
export function aggregateReminders(reminders:NavigationReminder[]):NavigationReminder{
  return {count:reminders.reduce((sum,r)=>sum+Math.max(0,r.count??0),0),attention:reminders.some(r=>r.attention)};
}
export function NavigationBadge({reminder,label}:{reminder?:NavigationReminder;label:string}){
  const count=reminder?.count??0;
  return count>0?<small className="nav-unread-count" aria-label={`${label}：${count} 則提醒`}>{count}</small>:reminder?.attention?<small className="nav-unread-count" aria-label={`${label}有待處理提醒`}>•</small>:null;
}
