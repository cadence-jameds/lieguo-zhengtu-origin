/// <reference lib="webworker" />
import {exportStoredSave} from './persistence';
self.onmessage=async(event:MessageEvent<{mode?:'quick'|'full'}>)=>{
 try{self.postMessage({type:'export',text:await exportStoredSave(event.data?.mode??'quick')});}
 catch(e){self.postMessage({type:'error',text:e instanceof Error?e.message:'存檔無法匯出。'});}
};
