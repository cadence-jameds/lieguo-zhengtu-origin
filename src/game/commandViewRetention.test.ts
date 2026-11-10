import {expect,it} from 'vitest';
import {retainCommandViews} from './commandViewRetention';
it('bounds settled display rows while preserving every unresolved operation and its original object',()=>{
 const actionable=['created','pending','retryable','blocked','receive-failed','needs-confirmation','retired'].map(state=>({state,id:state}));
 const completed=Array.from({length:10000},(_,i)=>({state:['committed','rejected','rolled-back'][i%3],id:String(i)}));const rows=[...completed.slice(0,5),...actionable,...completed.slice(5)],kept=retainCommandViews(rows);
 expect(kept).toHaveLength(1024+actionable.length);expect(kept.filter(r=>actionable.includes(r))).toEqual(actionable);expect(kept.at(-1)).toBe(completed.at(-1));expect(kept).toContain(completed[10000-1024]);expect(kept).not.toContain(completed[10000-1025]);expect(rows).toHaveLength(10007);
});
it('does not allocate a replacement array when nothing is retired',()=>{const rows=[{state:'committed'},{state:'pending'}];expect(retainCommandViews(rows)).toBe(rows);});
