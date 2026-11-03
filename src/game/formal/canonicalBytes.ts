/** Exact bytes of the existing canonical encoder. Bounded text fragments avoid
 * constructing a full canonical transport string alongside its UTF-8 buffer.
 * This changes allocation only, never the hash algorithm or stored format. */
export function canonicalBytes(value:unknown):Uint8Array<ArrayBuffer> {
 const encoder=new TextEncoder(),chunks:Uint8Array[]=[],parts:string[]=[];let chars=0,length=0;
 function flush(){if(!parts.length)return;const bytes=encoder.encode(parts.join(''));chunks.push(bytes);length+=bytes.length;parts.length=0;chars=0;}
 function text(s:string){parts.push(s);chars+=s.length;if(chars>=65536)flush();}
 function write(v:unknown,arrayElement=false){
  if(v===null||typeof v!=='object'){const s=JSON.stringify(v);if(s!==undefined)text(s);else if(!arrayElement)text('undefined');return;}
  if(Array.isArray(v)){text('[');for(let i=0;i<v.length;i++){if(i)text(',');write(v[i],true);}text(']');return;}
  const o=v as Record<string,unknown>;text('{');let first=true;for(const key of Object.keys(o).filter(k=>o[k]!==undefined).sort()){if(!first)text(',');first=false;text(JSON.stringify(key));text(':');write(o[key]);}text('}');
 }
 if(value===null||typeof value!=='object')return encoder.encode(JSON.stringify(value));
 write(value);flush();const out=new Uint8Array(length);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out;
}
