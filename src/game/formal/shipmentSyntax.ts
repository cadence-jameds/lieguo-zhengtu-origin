import {z} from 'zod';
import type {FormalWorld,Shipment} from './model';
const {isAsync}=z;
const pendingRoots=new WeakSet<object>();let active=false;
const readers=new Set<ShipmentSyntax>();
const parsers=new WeakMap<Function,number>();let parserSequence=0;

/** Only Reducer's private native-cloned drafts enter this synchronous scope.
 * Public load/import/validation always uses the original structural parser.
 * The root permit is weak, single-use, and carries no validation certificate.
 */
export function withDraftShipmentSyntax<T>(w:FormalWorld,validate:()=>T):T{
 const previous=active;
 const context=JSON.stringify([w.campaignId,w.ledger?.anchor?.branch,w.ledger?.anchor?.writerEpoch]);
 for(const reader of readers)reader.refresh(context);
 pendingRoots.add(w);active=true;try{return validate();}finally{pendingRoots.delete(w);active=previous;}
}
/** Public/re-entrant validation cannot inherit a private draft's permission. */
export function withShipmentValidation<T>(value:unknown,validate:()=>T):T{
 const previous=active;active=!!value&&typeof value==='object'&&pendingRoots.delete(value);
 try{return validate();}finally{active=previous;}
}
/** Fingerprint only the small compiled syntax definition, never world/history.
 * Unsupported/effectful schemas disable reuse. Changing any field constraint,
 * union option, regex or key order invalidates all stored structural results.
 */
function rules(schema:z.ZodTypeAny):string|undefined{
 const leaf=(s:z.ZodTypeAny):boolean=>{const d=(s as any)._def;return d.typeName==='ZodOptional'||d.typeName==='ZodNullable'?leaf(d.innerType):['ZodString','ZodNumber','ZodLiteral','ZodNever'].includes(d.typeName);};
 const root=(schema as any)._def;
 if(root.typeName!=='ZodDiscriminatedUnion'||[...root.optionsMap.values()].some((s:any)=>{
  const shape=s._getCached().shape;if(!shape.resources||!shape.authorizationSnapshot)return true;
  return Object.entries(shape).some(([k,v]:[string,any])=>k==='resources'||k==='authorizationSnapshot'?v._def.typeName!=='ZodObject'||Object.values(v._getCached().shape).some(x=>!leaf(x as z.ZodTypeAny)):!leaf(v));
 }))return;
 const seen=new Map<z.ZodTypeAny,number>(),nodes:unknown[]=[];let supported=true;
 const visit=(s:z.ZodTypeAny):number=>{
  const existing=seen.get(s);if(existing!==undefined)return existing;
  const id=nodes.length;seen.set(s,id);nodes.push(null);const d=s._def as any;let detail:unknown;
  switch(d.typeName){
   case 'ZodObject':{if(d.unknownKeys!=='strict')supported=false;const cached=(s as z.AnyZodObject)._getCached();detail=[d.unknownKeys,cached.keys.map(k=>[k,visit(cached.shape[k])]),visit(d.catchall)];break;}
   case 'ZodDiscriminatedUnion':detail=[d.discriminator,[...d.optionsMap].map(([k,v])=>[k,visit(v)])];break;
   case 'ZodOptional':case 'ZodNullable':detail=visit(d.innerType);break;
   case 'ZodNever':break;
   case 'ZodLiteral':detail=d.value;break;
   case 'ZodString':case 'ZodNumber':
    if(d.coerce||d.checks.some((c:any)=>!['regex','min','max','int','finite','multipleOf','length'].includes(c.kind)))supported=false;
    if(d.checks.some((c:any)=>c.kind==='regex'&&(c.regex.global||c.regex.sticky)))supported=false;
    detail=d.checks.map((c:any)=>c.kind==='regex'?{...c,regex:[c.regex.source,c.regex.flags]}:c);break;
   default:supported=false;
  }
  let parser=parsers.get(s._parse);if(parser===undefined){parser=++parserSequence;parsers.set(s._parse,parser);}
  nodes[id]=[d.typeName,parser,detail];return id;
 };visit(schema);return supported?JSON.stringify(nodes):undefined;
}
type Entry={value:Shipment;keys:string[];resources:string[];authorization:string[]};
function sameFields(a:Record<string,unknown>,b:unknown,keys:string[]):boolean{
 if(!b||typeof b!=='object')return false;
 const proto=Object.getPrototypeOf(b);if(proto!==Object.prototype&&proto!==null)return false;
 const raw=b as Record<string,unknown>;
 if(Object.keys(raw).length!==keys.length)return false;
 for(const k of keys)if(!Object.hasOwn(raw,k)||!Object.is(a[k],raw[k]))return false;
 return true;
}
function matches(entry:Entry,raw:Shipment):boolean{
 if(Object.getPrototypeOf(raw)!==Object.prototype&&Object.getPrototypeOf(raw)!==null||Object.keys(raw).length!==entry.keys.length)return false;
 for(const k of entry.keys){if(!Object.hasOwn(raw,k))return false;
  if(k==='resources'){if(!sameFields(entry.value.resources,raw.resources,entry.resources))return false;}
  else if(k==='authorizationSnapshot'){if(!sameFields(entry.value.authorizationSnapshot,raw.authorizationSnapshot,entry.authorization))return false;}
  else if(!Object.is((entry.value as any)[k],(raw as any)[k]))return false;
 }return true;
}
const copy=(s:Shipment):Shipment=>({...s,resources:{...s.resources},authorizationSnapshot:{...s.authorizationSnapshot}});
class ShipmentSyntax extends z.ZodType<Shipment>{
 private version?:string;
 private context?:string;
 private readonly entries=new Map<string,Entry>();
 constructor(private readonly syntax:z.ZodType<Shipment>){super({});readers.add(this);}
 refresh(context:string){const version=rules(this.syntax);if(version!==this.version||context!==this.context){this.entries.clear();this.version=version;this.context=context;}}
 _parse(input:z.ParseInput):z.ParseReturnType<Shipment>{
  if(!active||!input.data||typeof input.data!=='object'||input.parent.common.async||!this.version)return this.syntax._parse(input);
  const raw=input.data as Shipment,known=this.entries.get(raw.shipmentId);
  if(known&&matches(known,raw))return{status:'valid',value:copy(known.value)};
  const result=this.syntax._parse(input);
  // Keep a bounded stable prefix instead of thrashing when a world exceeds
  // capacity. Additional records retain the ordinary complete Zod path.
  if(!isAsync(result)&&result.status==='valid'&&(known||this.entries.size<4096)){
   const value=copy(result.value);Object.freeze(value.resources);Object.freeze(value.authorizationSnapshot);Object.freeze(value);
   this.entries.set(value.shipmentId,{value,keys:Object.keys(value),resources:Object.keys(value.resources),authorization:Object.keys(value.authorizationSnapshot)});
  }
  return result;
 }
}
export function shipmentSyntax(schema:z.ZodType<Shipment>):z.ZodType<Shipment>{return new ShipmentSyntax(schema);}
