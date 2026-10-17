import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Home} from './Home';
import {legacyGame,newGame} from './world';
import {RELEASE} from './release';
import pkg from '../../package.json';
const base={loading:false,busy:false,updateText:'已確認：目前為最新版本。',updateReady:false,updating:false,onStart:()=>{},onNew:()=>{},onUpdate:()=>{},onCheck:()=>{}};
it('首頁版本與發行套件一致；舊局顯示新版介面與舊世界的區別且不改存檔',()=>{const game=legacyGame('civ_zhongguo',1,1,0),before=JSON.stringify(game);const html=renderToStaticMarkup(createElement(Home,{...base,game}));expect(RELEASE.version).toBe(pkg.version);expect(html).toContain('v'+RELEASE.version);expect(html).toContain('既有世界');expect(html).toContain('新版外交介面可用');expect(html).toContain('開始新遊戲');expect(JSON.stringify(game)).toBe(before);});
it('新版戰役顯示獨立領主，已下載更新可保存後載入',()=>{const html=renderToStaticMarkup(createElement(Home,{...base,game:newGame('civ_zhongguo',1,1,0),updateReady:true}));expect(html).toContain('36 位領主');expect(html).toContain('保存進度並載入新版');expect(html).not.toContain('既有世界');});
it('正在讀取時禁止開始，不把讀取中的進度誤當沒有存檔',()=>{const html=renderToStaticMarkup(createElement(Home,{...base,game:null,loading:true}));expect(html).toContain('正在讀取本機進度');expect(html).toContain('正在確認本機進度，通常只需數秒。');expect(html.split('home-release')[0]).not.toContain('尚無本機進度');expect((html.match(/disabled=\"\"/g)||[]).length).toBeGreaterThanOrEqual(2);expect(html).not.toContain('開始你的第一場戰役');});

it('首頁主畫面只保留新局、載入和設定入口，匯出與配色藏在設定內',()=>{const html=renderToStaticMarkup(createElement(Home,{...base,game:newGame('civ_zhongguo',1,1,0)}));expect(html).toContain('開啟設定');expect(html).toContain('開始新遊戲');expect(html).toContain('載入進度');expect(html).not.toContain('home-export-choice');expect(html).not.toContain('theme-options');});
