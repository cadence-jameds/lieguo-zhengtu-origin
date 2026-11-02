import {createContext,useCallback,useContext,useSyncExternalStore} from 'react';
import type {PresentationWorld} from './presentationModel';
import type {PresentationStore} from './presentationStore';
export const PresentationStoreContext=createContext<PresentationStore|null>(null);
export function usePresentationSelector<T>(store:PresentationStore,selector:(world:PresentationWorld|null)=>T){
 const get=useCallback(()=>selector(store.getWorld()),[selector,store]);
 return useSyncExternalStore(store.subscribe,get,get);
}
export const selectPresentationWorld=(world:PresentationWorld|null)=>world;
export function usePresentationCity(id:string){const store=useContext(PresentationStoreContext);if(!store)throw Error('缺少展示資料來源。');const select=useCallback((world:PresentationWorld|null)=>world?.cities.find(c=>c.id===id),[id]);return usePresentationSelector(store,select);}
