import {prepare,checkNotes} from './release-metadata.mjs';
import {readFileSync} from 'node:fs';
const root=process.cwd(),event=process.env.GITHUB_EVENT_PATH?JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')):null;
if(event?.pull_request)checkNotes(root,event.pull_request.base.sha,'HEAD',event.pull_request.body??'');
const meta=prepare(root,{strict:process.env.GITHUB_REF==='refs/heads/main',working:true});
if(process.env.GITHUB_REF==='refs/heads/main'&&meta.dirty)throw Error('Refusing to publish uncommitted playable changes');
console.log(JSON.stringify({version:meta.version,date:meta.date,commitSha:meta.commitSha,dirty:meta.dirty}));
