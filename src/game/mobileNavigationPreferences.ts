import {useState} from 'react';
import type {View} from './presentation/Shell';

export const MOBILE_SHORTCUTS_KEY='lieguo.mobile-shortcuts.v1';
export const MAX_MOBILE_SHORTCUTS=6;
export const DEFAULT_MOBILE_SHORTCUTS:View[]=['map','city','army','reports','research','legion'];
const validViews=new Set<View>(['map','city','army','reports','research','legion','diplomacy','empire','tasks','settings']);
export function normalizeMobileShortcuts(value:unknown):View[]{
  if(!Array.isArray(value))return [...DEFAULT_MOBILE_SHORTCUTS];
  return [...new Set(value.filter((id):id is View=>typeof id==='string'&&validViews.has(id as View)))].slice(0,MAX_MOBILE_SHORTCUTS);
}
export function readMobileShortcuts():View[]{
  try{const value=localStorage.getItem(MOBILE_SHORTCUTS_KEY);return value===null?[...DEFAULT_MOBILE_SHORTCUTS]:normalizeMobileShortcuts(JSON.parse(value));}
  catch{return [...DEFAULT_MOBILE_SHORTCUTS];}
}
export function useMobileShortcuts(){
  const [shortcuts,setShortcuts]=useState(readMobileShortcuts),[storageError,setStorageError]=useState(false);
  const save=(value:View[])=>{
    const next=normalizeMobileShortcuts(value);setShortcuts(next);
    try{localStorage.setItem(MOBILE_SHORTCUTS_KEY,JSON.stringify(next));setStorageError(false);}
    catch{setStorageError(true);}
  };
  return {shortcuts,save,storageError};
}
