/** Player wording only. Technical diagnostics remain outside game surfaces. */
export function playerMessage(value:unknown,fallback='操作未完成，請確認狀態後重試。'):string{
 if(!(value instanceof Error)&&typeof value!=='string')return fallback;
 const raw=value instanceof Error?value.message:value;
 if(!raw.trim())return raw===''?'':fallback;
 const text=raw.replace(/\s+/g,' ').trim();
 if(text.length>140||!/[\u3400-\u9fff]/u.test(text)||/^[\[{]|invalid_type|ZodError|[A-Z][A-Za-z]+Error|(?:expected|received|stack)\s*[:[".]|\b(?:savedAt|recovery|authority|checksum)\b|\bat\s+\S+\s*\(|\.(?:tsx?|jsx?)[:/]|CommandId/i.test(raw))return fallback;
 return text;
}
