import {afterEach,expect,it,vi} from 'vitest';
import {TerrainCache} from './terrainCache';
class FakeWorker{
 static latest:FakeWorker;onmessage:((e:unknown)=>void)|undefined;onerror:(()=>void)|undefined;
 messages:any[]=[];terminated=false;
 constructor(){FakeWorker.latest=this;}
 postMessage(message:unknown){this.messages.push(message);}
 terminate(){this.terminated=true;}
 reply(generation:number){this.onmessage?.({data:{generation,pixels:{width:1,height:1,data:new Uint8ClampedArray(4)}}});}
}
afterEach(()=>vi.unstubAllGlobals());
it('背景工作串行，完成後才接上地表，不阻塞要求圖塊',()=>{
 vi.stubGlobal('Worker',FakeWorker);const cache=new TerrainCache(),get=vi.spyOn(cache,'get').mockReturnValue({image:{} as HTMLCanvasElement,foliage:null,scale:2});
 cache.request(0,0,902,2,2,false,1);cache.request(16,0,902,2,2,false,1);cache.pump();
 expect(get).not.toHaveBeenCalled();expect(FakeWorker.latest.messages).toHaveLength(1);expect(cache.pendingCount).toBe(2);
 FakeWorker.latest.reply(0);expect(get).toHaveBeenCalledOnce();cache.pump();expect(FakeWorker.latest.messages).toHaveLength(2);cache.dispose();expect(FakeWorker.latest.terminated).toBe(true);
});
it('素材更新後拋棄舊背景結果並繼續產生新圖塊',()=>{
 vi.stubGlobal('Worker',FakeWorker);const cache=new TerrainCache(),get=vi.spyOn(cache,'get');
 cache.request(0,0,902,1);cache.pump();cache.setBankTexture({} as HTMLImageElement);FakeWorker.latest.reply(0);
 expect(get).not.toHaveBeenCalled();cache.request(0,0,902,1);cache.pump();expect(FakeWorker.latest.messages.at(-1).generation).toBe(1);cache.dispose();
});
