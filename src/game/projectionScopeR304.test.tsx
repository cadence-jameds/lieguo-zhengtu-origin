// @vitest-environment happy-dom
import {act,useCallback,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {PresentationStoreContext,usePresentationScopeReset} from './usePresentation';
import {PresentationStore} from './presentationStore';
afterEach(()=>vi.unstubAllGlobals());
it.each(['campaign-a:2:1','campaign-a:1:2','campaign-b:1:1'])('unsolicited scope %s clears dirty targets/forms before paint while accepted commands remain tracked',async nextScope=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);const node=document.createElement('div'),root=createRoot(node),store=new PresentationStore(),reset=vi.fn();let dirty!:()=>void,queue!:()=>void;
 function Form({value}:{value:string}){const [draft,setDraft]=useState(value);dirty=()=>setDraft('old governor budget');return <output id="form">{draft}</output>;}
 function Surface({scope,revision}:{scope:string;revision:number}){const [target,setTarget]=useState('old exact coordinates'),[accepted,setAccepted]=useState(0),clear=useCallback(()=>{reset();setTarget('');},[]);queue=()=>setAccepted(n=>n+1);usePresentationScopeReset(scope,clear);return <><output id="pending">{accepted}</output><output id="target">{target}</output><PresentationStoreContext.Provider key={scope} value={store}><Form value={'revision '+revision}/></PresentationStoreContext.Provider></>;}
 await act(async()=>root.render(<Surface scope="campaign-a:1:1" revision={1}/>));await act(async()=>{dirty();queue();});await act(async()=>root.render(<Surface scope="campaign-a:1:1" revision={2}/>));expect(node.querySelector('#form')!.textContent).toBe('old governor budget');expect(node.querySelector('#target')!.textContent).toBe('old exact coordinates');expect(reset).not.toHaveBeenCalled();
 await act(async()=>root.render(<Surface scope={nextScope} revision={3}/>));expect(node.querySelector('#form')!.textContent).toBe('revision 3');expect(node.querySelector('#target')!.textContent).toBe('');expect(node.querySelector('#pending')!.textContent).toBe('1');expect(reset).toHaveBeenCalledTimes(1);await act(async()=>root.unmount());
});
