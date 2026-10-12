import {it,expect,vi} from 'vitest';
import {createFormalWorld} from '../formal/generator';
import {paintSurface} from './mapPaint';
import {project} from './mapGeometry';
it('pixel worker accepts a terrain-only view and returns generation-tagged transferable pixels',async()=>{
 const w=createFormalWorld({campaign:'pixel-worker',seed:90217}),view={seed:w.seed,dimensions:w.dimensions,worldLayer:w.worldLayer},before=JSON.stringify(view),postMessage=vi.fn(),scope:{onmessage?:({data}:{data:unknown})=>void;postMessage:typeof postMessage}={postMessage};
 vi.stubGlobal('self',scope);
 try{await import('./mapRaster.worker');scope.onmessage!({data:{type:'init',world:view,generation:9}});scope.onmessage!({data:{type:'paint',cx:80,cy:150,key:'80,150:.25',quality:.25}});const [r,transfers]=postMessage.mock.calls[0];expect(r.generation).toBe(9);expect(r.error).toBeUndefined();expect(r.key).toBe('80,150:.25');expect(transfers[0]).toBe(r.pixels.data.buffer);const p=project({x:80,y:150});expect(r.pixels.data).toEqual(paintSurface(w,{x:p.x-352,y:p.y-64},704,384,.25).data);expect(JSON.stringify(view)).toBe(before);expect(Object.keys(view)).toEqual(['seed','dimensions','worldLayer']);}finally{vi.unstubAllGlobals();}
});
