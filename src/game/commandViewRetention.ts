/** Only settled display rows expire. Durable receipt/result retention is owned
 * by Persistence; unresolved UI operations always keep their recovery controls. */
export function retainCommandViews<T extends {state:string}>(rows:T[]):T[]{
 const settled=(row:T)=>['committed','rejected','rolled-back'].includes(row.state);
 let remaining=1024,removed=false;const keep=new Set<T>();
 for(let i=rows.length-1;i>=0;i--)if(!settled(rows[i])||remaining-->0)keep.add(rows[i]);else removed=true;
 return removed?rows.filter(row=>keep.has(row)):rows;
}
