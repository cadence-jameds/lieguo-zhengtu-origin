export function parseWorldSeed(text:string):number|null{
 const value=text.trim();if(!/^\d{1,10}$/.test(value))return null;
 const seed=Number(value);return Number.isSafeInteger(seed)&&seed<=4294967295?seed:null;
}
export const randomWorldSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
