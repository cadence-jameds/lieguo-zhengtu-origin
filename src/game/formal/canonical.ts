/** Stable JSON encoding. No normalizing, defaults, repairs, or legacy imports. */
export function canonicalJSON(value:unknown):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonicalJSON).join(',')+']';
  const o=value as Record<string,unknown>;
  return '{'+Object.keys(o).filter(k=>o[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonicalJSON(o[k])).join(',')+'}';
}
export async function digest(value:unknown):Promise<string>{
  const data=new TextEncoder().encode(canonicalJSON(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
}
