import {afterEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({load:vi.fn(),save:vi.fn(),advance:vi.fn()}));
vi.mock('./persistence',()=>({loadSave:mocks.load,save:mocks.save,clearSavedGames:vi.fn(),backupList:vi.fn(),exportSave:vi.fn(),importSave:vi.fn(),restore:vi.fn()}));
vi.mock('./engine',()=>({advance:mocks.advance,submitOrder:vi.fn()}));
vi.mock('./world',()=>({newGame:vi.fn()}));
vi.mock('./realmSystems',()=>({offlineElapsed:()=>600000}));
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();vi.clearAllMocks();});
it('does not accumulate timer work while restoring and saving a loaded campaign',async()=>{
 let tick!:()=>void,finish!:()=>void;
 const port={postMessage:vi.fn(),onmessage:null as unknown as (e:unknown)=>void};
 vi.stubGlobal('self',port);vi.stubGlobal('setInterval',(cb:()=>void)=>{tick=cb;return 1;});
 const g={time:0,savedAt:Date.now(),speed:1,next:1,campaign:'test',reports:[],player:'test',defeat:null,result:null};
 mocks.load.mockResolvedValue({game:g,recovered:false});
 mocks.save.mockImplementationOnce(()=>new Promise<void>(r=>{finish=r;})).mockResolvedValue(undefined);
 mocks.advance.mockImplementation((game,target)=>{game.time=target;});
 await import('./runtime.worker');port.onmessage({data:{type:'load'}});
 await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
 for(let i=0;i<100;i++)tick();finish();
 await vi.waitFor(()=>expect(port.postMessage).toHaveBeenCalledWith({type:'state',game:g}));
 expect(mocks.advance).toHaveBeenCalledTimes(2);
 expect(mocks.save).toHaveBeenCalledTimes(2);
 expect(port.postMessage).toHaveBeenCalledWith({type:'phase',text:'推進離線期間的世界'});
});
it('exits loading explicitly when no save exists',async()=>{
 const port={postMessage:vi.fn(),onmessage:null as unknown as (e:unknown)=>void};vi.stubGlobal('self',port);vi.stubGlobal('setInterval',vi.fn());mocks.load.mockResolvedValue({game:null,recovered:false});
 await import('./runtime.worker');port.onmessage({data:{type:'load'}});
 await vi.waitFor(()=>expect(port.postMessage).toHaveBeenCalledWith({type:'state',game:null}));expect(mocks.save).not.toHaveBeenCalled();
});
