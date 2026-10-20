import type {CommandReceipt,FormalWorld} from './model';

/** Receipt fields are primitives. Copy the records without re-copying long,
 * immutable fingerprint strings through the structured-clone transport.
 * Everything else keeps the general deep clone; malformed history also keeps
 * that path and is still rejected by the unchanged final world validator. */
export function cloneWorldDraft(current:FormalWorld):FormalWorld {
 const receipts:CommandReceipt[]=[];
 for(const receipt of current.commandReceipts){
  if(Object.getPrototypeOf(receipt)!==Object.prototype&&Object.getPrototypeOf(receipt)!==null)return structuredClone(current);
  const copy={...receipt};
  if(Object.keys(copy).length!==5||Object.getOwnPropertySymbols(copy).length||
   typeof copy.commandId!=='string'||typeof copy.issuerId!=='string'||typeof copy.fingerprint!=='string'||
   typeof copy.committedRevision!=='number'||typeof copy.disposition!=='string')return structuredClone(current);
  receipts.push(copy);
 }
 const draft:FormalWorld=structuredClone({...current,commandReceipts:[]});
 draft.commandReceipts=receipts;
 return draft;
}
