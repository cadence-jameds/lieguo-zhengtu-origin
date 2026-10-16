export function playablePath(path:string):boolean;
export function playableChanges(paths:string[],before?:(path:string)=>string,after?:(path:string)=>string):boolean;
export function nextVersion(base:string,count:number,ceiling?:number):string;
export function validateNote(note:unknown):{title:string;notes:string[];pr?:number};
export function checkNotes(root:string,base:string,head?:string,body?:string):{functional:boolean;notes:unknown[]};
export function createMetadata(root:string,options?:{head?:string;strict?:boolean;working?:boolean}):import('../src/game/releaseTypes').ReleaseMetadata;
export function prepare(root?:string,options?:{head?:string;strict?:boolean;working?:boolean}):import('../src/game/releaseTypes').ReleaseMetadata;
export function loadMetadata(root?:string):import('../src/game/releaseTypes').ReleaseMetadata;
