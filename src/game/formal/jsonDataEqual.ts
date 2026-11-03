import {canonicalJSON} from './canonical';
/** Equality of the existing canonical JSON data, without allocating its strings.
 * Used on verified JSON evidence versus IDB rows, never as a checksum or proof.
 * Array holes/undefined and non-JSON scalars retain the old encoder semantics. */
export function jsonDataEqual(a:unknown,b:unknown):boolean {
 if(a===b)return true;
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return JSON.stringify(a)===JSON.stringify(b);
 if(Array.isArray(a)||Array.isArray(b)){
  if(!Array.isArray(a)||!Array.isArray(b))return false;
  if(a.some(x=>x===undefined)||b.some(x=>x===undefined)||Object.keys(a).length!==a.length||Object.keys(b).length!==b.length)return canonicalJSON(a)===canonicalJSON(b);
  return a.length===b.length&&a.every((v,i)=>jsonDataEqual(v,b[i]));
 }
 const x=a as Record<string,unknown>,y=b as Record<string,unknown>,keys=Object.keys(x).filter(k=>x[k]!==undefined),other=Object.keys(y).filter(k=>y[k]!==undefined);
 return keys.length===other.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(y,k)&&y[k]!==undefined&&jsonDataEqual(x[k],y[k]));
}
/** Proof reuse is stricter than canonical equality: unknown undefined fields
 * must still reach the normal schema verifier and be rejected there. */
export function exactDataEqual(a:unknown,b:unknown):boolean {
 if(a===b)return true;if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)!==Array.isArray(b)||Array.isArray(a)&&a.length!==(b as unknown[]).length)return false;
 const x=a as Record<string,unknown>,y=b as Record<string,unknown>,keys=Object.keys(x);
 return keys.length===Object.keys(y).length&&keys.every(k=>Object.prototype.hasOwnProperty.call(y,k)&&exactDataEqual(x[k],y[k]));
}
