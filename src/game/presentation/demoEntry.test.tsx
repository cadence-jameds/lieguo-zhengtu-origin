import {Children,isValidElement,type ReactElement,type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import {Home} from '../FormalHome';
import FormalWorldMap from '../FormalWorldMap';
import {createFormalWorld} from '../formal/generator';
import {MapToolbar} from './MapToolbar';
import {Shell} from './Shell';

const noop=()=>{};
const world=createFormalWorld({campaign:'demo-entry-correction',seed:90217});
function elements(node:ReactNode):ReactElement<Record<string,unknown>>[]{
 return Children.toArray(node).flatMap(child=>isValidElement<Record<string,unknown>>(child)?[child,...elements(child.props.children as ReactNode)]:[]);
}
it('the ellipsis invokes only expansion; panel actions are separate buttons',()=>{
 const onToggleTools=vi.fn(),onXY=vi.fn(),onFavorites=vi.fn(),onTerritory=vi.fn();
 const props={expanded:false,labels:false,territory:false,favorites:2,onToggleTools,onXY,onFavorites,onTerritory,onZoom:noop,onReturn:noop,onOverview:noop,onLabels:noop};
 const toggle=elements(MapToolbar(props)).find(e=>e.props['aria-controls']==='map-extra-tools')!;
 (toggle.props.onClick as ()=>void)();expect(onToggleTools).toHaveBeenCalledTimes(1);
 for(const action of [onXY,onFavorites,onTerritory])expect(action).not.toHaveBeenCalled();
 expect(renderToStaticMarkup(MapToolbar(props))).toContain('aria-expanded="false"');
 expect(renderToStaticMarkup(MapToolbar({...props,expanded:true}))).toContain('class="map-extra-tools expanded"');
});
it('Home uses the DEMO river-city asset and the map has no extra world-tools panel',()=>{
 const home=renderToStaticMarkup(<Home theme="classic" onThemeChange={noop} world={null} loading={false} busy={false} onNew={noop} onStart={noop} onRetry={noop} onExport={noop} onImport={noop}/>);
 expect(home).toContain('/art/river-city.webp');expect(home).not.toContain('terrain-base.webp');
 const map=renderToStaticMarkup(<FormalWorldMap world={world}/>);
 expect(map).not.toContain('世界工具');expect(map).toContain('aria-controls="map-extra-tools"');expect(map).toContain('滾輪縮放');
 expect(renderToStaticMarkup(<FormalWorldMap world={world} mobile/>)).toContain('雙指縮放');
});
it('desktop keeps its side rail; phone city uses bottom navigation without an extra context row',()=>{
 const props={world,city:world.cities[0],cities:[world.cities[0]],view:'city' as const,onView:noop,onCity:noop,onHome:noop,onResource:noop,onMore:noop,moreOpen:false,busy:false,children:<p>城市</p>};
 const desktop=renderToStaticMarkup(<Shell {...props} mobile={false}/>),phone=renderToStaticMarkup(<Shell {...props} mobile/>);
 expect(desktop).toContain('desktop-layout');expect(desktop).toContain('left-rail');expect(desktop).not.toContain('mobile-nav');
 expect(phone).toContain('mobile-layout');expect(phone).toContain('mobile-nav');expect(phone).not.toContain('left-rail');expect(phone).not.toContain('context-strip');
 expect(renderToStaticMarkup(<Shell {...props} view="map" mobile/>)).toContain('世界運行中');
});
