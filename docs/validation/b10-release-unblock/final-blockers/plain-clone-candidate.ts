// Diagnostic candidate only. NOT wired into the production reducer.
// Proxy rejection cannot be proved by ordinary JS reflection; keep this caveat
// explicit even if timings on actual parsed JSON state look promising.
export function plainCloneCandidate<T>(value:T):T {
 const seen=new WeakMap<object,unknown>(),unsupported=Symbol();
 const copy=(v:any):any=>{
  if(v===null||typeof v!=='object'){if(typeof v==='function'||typeof v==='symbol')throw unsupported;return v;}
  if(seen.has(v))return seen.get(v);
  if(Object.getOwnPropertySymbols(v).length)throw unsupported;
  const array=Array.isArray(v),proto=Object.getPrototypeOf(v);
  if(!array&&proto!==Object.prototype&&proto!==null)throw unsupported;
  const out:any=array?new Array(v.length):{};seen.set(v,out);
  for(const key of Object.keys(v)){
   const d=Object.getOwnPropertyDescriptor(v,key)!;if(!Object.hasOwn(d,'value'))throw unsupported;
   const next=copy(d.value);
   if(key==='__proto__')Object.defineProperty(out,key,{value:next,writable:true,enumerable:true,configurable:true});else out[key]=next;
  }
  return out;
 };
 try{return copy(value);}catch(error){if(error!==unsupported)throw error;return structuredClone(value);}
}
