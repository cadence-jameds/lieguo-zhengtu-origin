import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync,writeFileSync} from 'node:fs';
import {make} from '../formal/developmentTestSupport';
import {ResourceSprite} from '../ResourceSprite';
import {Shell} from './Shell';
import {DeveloperControls} from './DeveloperControls';
import {ArmyView} from './DevelopmentViews';
import {releaseNotes} from '../release';
const noop=()=>{};
it('advanced field art begins at Lv10 while Lv9 retains the base art',()=>{
 for(const building of ['farm','lumber','quarry','mine'] as const){expect(renderToStaticMarkup(<ResourceSprite building={building} level={9}/>)).toContain(`art/field-${building}.webp`);expect(renderToStaticMarkup(<ResourceSprite building={building} level={10}/>)).not.toContain(`art/field-${building}.webp`);}
});
it('in-game developer controls expose only 50X/200X and DEMO protection without independent testing/disband UI',()=>{
 const world=make();world.developer={enabled:true,speed:200};const city=world.cities[0],html=renderToStaticMarkup(<DeveloperControls world={world} city={city} issue={noop} busy={false}/>);expect(html).toContain('value="50"');expect(html).toContain('value="200"');expect(html).toContain('開啟保護罩');expect(html).toContain('20 世界小時');expect(html).not.toContain('測試情境');const army=renderToStaticMarkup(<ArmyView world={world} city={city} issue={noop} busy={false}/>);expect(army).not.toContain('解散');expect(releaseNotes).toHaveLength(10);writeFileSync('docs/ui-v03027/developer-controls-render.html',html);
});
it('outer developer gold frame overrides blue protection and unread reports alert on mobile and desktop',()=>{
 const world=make();world.developer={enabled:true,speed:50};world.factions[0].protectionUntil=72000000;const city=world.cities[0];for(const mobile of [true,false]){const html=renderToStaticMarkup(<Shell world={world} city={city} cities={[city]} mobile={mobile} view="map" onView={noop} onCity={noop} onHome={noop} onResource={noop} onMore={noop} moreOpen={false} busy={false} unread={2} alerts={1}><p>目前戰役</p></Shell>);expect(html).toContain('protected-world developer-world');expect(html).toContain('has-unread');writeFileSync('docs/ui-v03027/'+(mobile?'mobile':'desktop')+'-shell-render.html',html);}
 const css=readFileSync('src/game/presentation/parity.css','utf8');expect(css).toMatch(/\.developer-world::after\{[^}]*position:fixed[^}]*inset:0[^}]*z-index:10000/);
 const map=readFileSync('src/game/FormalWorldMap.tsx','utf8');expect(map).not.toContain('wallRing');expect(map).toContain('projectTime');
});
