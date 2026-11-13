/** Keep high precision for foreground/offline boundaries; quantize only once,
 * immediately before one persistence transaction stamps its shared wall anchor. */
export function persistenceTime(value:number):number{
 if(!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER)throw new RangeError('SAVE_TIME_INVALID');
 return Math.floor(value);
}
