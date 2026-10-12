# R3 本地 Chrome 瀏覽器驗收 — 2026-10-12

本輪已實際控制 Windows 本地 Chrome，看到遊戲並完成主要瀏覽器功能驗證。結果為 **主要操作通過，治理密集事件場景有問題；不是完整 R3／Astra Gate PASS**。未修改遊戲程式、平衡、專案依賴或 Git 分支，未開始 R4。

## 環境與版本

- 專案：`G:\Projects\Lieguo`
- 分支：`work/r3-browser-verification`
- HEAD／R3 基準：`4ed0f1073aafbc675b24bf8351818e76a45a76a9`
- 遊戲畫面：v0.30.49，正式 384×384／100 勢力／432 野外據點。
- Playwright 1.64.0，安裝於 `%TEMP%\lieguo-r3-playwright`；沒有新增專案 npm 依賴，沒有下載另一份 Chromium。
- 本機 Chrome 154.0.8037.98，`channel: chrome`、有視窗、獨立 BrowserContext；未使用使用者原本 Chrome 的儲存資料。
- 桌機 viewport 1440×1000；手機模擬 390×844，CDP 注入瀏覽器可信觸控事件，非實體手機。
- WebGL 診斷：ANGLE／NVIDIA GeForce RTX 3070 Ti／Direct3D11。遊戲地圖本身使用 Canvas2D；此診斷不是 GPU 效能認證。
- origin：`http://127.0.0.1:5173/`。初次工具檢查時沒有服務接受連線，因此以既有 `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` 啟動 Vite，342ms ready。Vite 留在本機運行。
- 內建瀏覽器無法連線，Chrome connector 未提供；實際驗收改用本機 Playwright，不沿用先前 Cloud Chrome 的失敗結果。

## 使用者要求的六項確認

| 項目 | 結果 | 真實證據 |
|---|---|---|
| 讀取本地專案與 Git | 通過 | 分支、完整 commit、初始乾淨工作目錄；結束時僅驗收文件與證據有變更 |
| 連線遊戲 | 通過 | Chrome 成功載入 localhost Vite；[首頁](01-home.png) |
| 首頁與開始新遊戲 | 通過 | [開局表單](02-new-game-form.png)、[正常新城](03-new-city.png)；種子 92049、中國、50X、離線 0h |
| 世界地圖、城市、縮放 | 通過 | [地圖](04-world-map.png)、[放大](05-map-zoom-in.png)、[拖曳](06-map-pan.png)、[全區](07-map-overview.png)、[城市選取](08-map-home-selected.png)；75%→98%→75%→8%；XY 與進城實際點擊 |
| AI 行軍、雙劍、治理 | 已驗證；治理有場景問題 | 自主 AI／受控 100 軍隊／真實持續攻城／正式總督命令，詳見下文 |
| 截圖、Console、測試證據 | 通過 | 29 張未合成 Chrome PNG、[Console 原始紀錄](console.json)、[全部操作含失敗嘗試](actions.json)、[主要 trace](trace.zip)、[治理 trace](trace-governance.zip)、測試存檔與 SHA256 manifest |

## 實際操作與資料核對

**城市建設：** 從地圖選取己城、進入城市、打開農田明細並點「升級至 Lv1」，正式工程出現在施工佇列。農田完成後基礎糧食產量由 +54／時變為 +66／時。保存 [明細](09-field-detail.png)、[施工](10-field-construction.png)、[城內](17-city-interior.png)、[市政廳](18-townhall-detail.png)。正常新局沒有市政廳時，[委任總督停用](11-governance-prerequisite.png)。

**100 軍隊顯示：** 受控場景透過目前正式 `submitFormalOrder` 建立軍隊，含 1 支玩家軍、99 支 AI 所有權軍隊；不是「100 個 AI 自行決定同步出兵」。經 schema／checksum 編碼，從遊戲匯入介面載入。全區畫面讀到 99 條行軍線、97 個軍隊 marker、100 個 route cache；LOD 合併與在交戰軍隊解釋 marker 數不等於資料筆數。[全區截圖](14-100-armies-overview.png)，原始世界見 `controlled-loaded-state.json`。

**正式 AI 自主出兵：** 另一份成熟測試世界提供部隊與資源，但沒有手動提交 AI 出兵命令；原生城市位置／地形保留，呼叫正式 `enableAutonomy`／`advanceFormal`。世界 75 分鐘時有 169 次決策、117 次接受、0 次拒絕、5 支 AI 偵察軍。匯入 UI 後，正式 Worker 繼續運行；後續採樣 337 次決策、278 次接受、0 次拒絕、13 支軍隊。軍隊 `army:0000000000000124`、owner `faction:039` 的正式投影由 `(27.1596,147.1596)` 移到 `(29,150)`；畫面有行軍箭頭與路徑，隨抵達事件移除。見 [移動前](25-autonomous-ai-before.png)、[移動後](26-autonomous-ai-after.png)、`autonomous-movement.json`、`autonomous-loaded-state.json`、`autonomous-final-state.json`。此為成熟測試場景，不代表正常新局 75 分鐘內必定出兵。

**AI 對 AI Lv15 Siege：** 受控測試只有準備兵力與城牆；出征、抵達、持續攻城全部走正式引擎。攻方 `faction:001`、守方 `faction:002`、city `city:002`（291,68）、BattleId `battle:0000000000000001`。Chrome 中持續運行時，第 1→2 回合仍有雙劍，[初始](12-ai-vs-ai-lv15-siege.png)／[下一回合](13-siege-next-round.png)。沒有以匯入 final 檔案替代實際終戰：同一場景自然進行至正式 final，world time `16575000`、outcome `held`，持續 battles=0、`visibleBattles=0`；[終戰畫面](24-siege-final-marker-removed.png)、`siege-final-live-state.json`。生成的 `controlled-final.realm-save` 只用於額外對照，沒有用它製造終戰截圖。

**保存重讀：** 點立即保存、重新載入頁面、點載入進度；同一 campaign、33 支軍隊、同一 BattleId 與 siegeRound=9 保留。前後完整軍隊路徑／時間等資料保存在 `reload-state-comparison.json`。[重讀城市](19-reloaded-city.png)。

**治理：** 受控 50X 場景委任經濟總督，實際支出 250 並提交正式經濟命令，[委任](15-governor-commission.png)；重讀後停止成功，[停止](16-governor-stopped.png)。獨立 1X 場景完整驗證委任→經濟決策（四資源支出合計420）→套用資源儲備方針→停止；停止後 `enabled=false`、`eventId=null`，支出維持420，沒有重複付款。見 [方針套用](28-governor-reserve-applied.png)、[停止](29-quiet-governor-stopped.png)、`quiet-governor-comparison.json`。

**手機與 reduced-motion：** Chrome 390×844 模擬下，可信 touchStart／touchMove／touchEnd 實際改變相機；單指移動成功，雙指距離80→160讓 zoom 0.75→1.5；document width=viewport width=390。[手機畫面](20-mobile-map.png)、[雙指放大](21-mobile-touch-pinch.png)。`prefers-reduced-motion: reduce` 下仍保留持續攻城雙劍，[截圖](22-siege-reduced-motion.png)。未聲稱實體手機或所有動畫的 reduced-motion 全驗收。

**短時幀採樣：** 100 軍隊全區場景，Chrome requestAnimationFrame 採樣120個間隔：median 7ms、p95 13.9ms、平均換算約113.69 RAF/s；當次 overlay renderMs=1.50。這是本機短時開發模式樣本，不能當成長期 GPU/FPS Gate、實體手機效能或所有視角的 FPS 保證。原始值在 `actions.json`。

## 發現的問題

1. **密集事件場景治理設定拒絕。** 50X／100軍隊世界中，兩次透過介面套用資源儲備方針未生效，UI 提示「世界版本已更新，請重新確認狀態」，原設定仍為 economy。`actions.json` 的 `governor-budget-and-stop`、`governor-retry-and-stop` 保存等待新設定逾時；`city-townhall-detail` 保存錯誤 toast 與原設定。1X 獨立場景同操作成功。現象符合 revision 衝突，但本輪沒有確認根因或修正。
2. **市政廳舊文案。** [市政廳明細](18-townhall-detail.png) 同時顯示可用的城市總督與「治理方針／尚未開放」，會讓玩家誤以為尚未接入。
3. **開發環境警告。** Console 有6筆 warning：兩次頁面載入各有2筆 Permissions-Policy 未識別 feature 與1筆 React DevTools hook／Fast Refresh 停用。沒有 console error、未捕捉 pageerror、requestfailed 或 HTTP≥400。

原始操作亦保留工具端 locator 錯誤（含 icon 的 exact button name、label 含 option text）及未先關閉 dialog 的點擊逾時。修正定位或關閉對話框後完成驗證；這些工具操作失敗不算遊戲功能錯誤，也沒有从日誌刪除。

## 仍待驗收與證據使用

商隊／拓殖／工匠完整動態、六文明外城堡逐一辨識、流亡「流」／復國、Raid 瞬時終戰特效重播／恢復去重、敵情權限所有入口、實體手機與長時間壓力測試本輪未完成。B5 E1／Astra Gate 不由本輪自動升為 PASS。R4 尚未開始。

以臨時 Playwright 的 `show-trace` 開啟 `trace.zip` 或 `trace-governance.zip` 可重播操作；主要 trace 約340 MiB，包含真實頁面 snapshots、網路與截圖，沒有上傳至外部服務。`manifest.json` 提供每份證據的大小與 SHA256。`browser-driver.mjs`、`scenarios.mjs` 等保存驗收方法；fixtures 都只匯入本輪獨立測試 Context。使用者原本瀏覽器存檔未被替換。
