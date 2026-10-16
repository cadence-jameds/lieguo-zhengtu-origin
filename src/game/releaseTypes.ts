export type ReleaseEntry={version:string;date:string;title:string;notes:string[];commitSha:string;pr?:number};
export type ReleaseMetadata={format:number;version:string;date:string;title:string;commitSha:string;contentSha:string;dirty:boolean;history:ReleaseEntry[];legacyNotes:string[]};
