# PR #64 追加：所有遊戲頁面的單一保護盾牌

基準為同一 Draft PR 的 `0c2c9b05b7299639152ca7aa2bed80b618f5405a`。本次直接追加至 PR #64；沒有建立新 PR、修改 main、合併或部署。此報告取代先前「僅城郊顯示、其他頁面隱藏」的 UI 定位結論；既有 25X 預覽修正與原安全驗證保留。

## 實作

- `Shell` 持有唯一 `ProtectionStatus`。各 View 共用同一個 Portal、按鈕 DOM、展開狀態與原 `useDisplayTime` 倒數來源。CityScenes 只提供目前區域與可視容器，沒有額外保護元件或計時器。
- 城郊維持場景左起約 40%、上緣約 8% 的山景位置；以可視容器計算，橫向捲動不影響座標。城內避開建築及城門的互動範圍；城市垂直捲離場景後採用可視區域避讓位置。
- 地圖使用既有 context strip 的空白位置，位於地圖 canvas、標記、工具與浮動面板之外，沒有新增一列或增加高度。
- 軍隊、科技、軍團、外交、戰報、治理、任務與設定共用可視區域的周邊候選位置，實際避讓按鈕、表單、導航、快速設定齒輪、提示與浮動面板。使用 ResizeObserver、DOM 結構變化及捲動／拖曳事件重新定位；合併至動畫幀，不因每秒倒數重新掃描版面。
- 全部頁面均為約 28px 的精簡盾牌及等寬倒數；沒有保護資訊列、拖曳系統或新增顯示設定。首頁因沒有 Shell，不顯示盾牌。
- 切 View／城市／戰役會收合詳情；切城內／城郊亦收合。詳情維持可點擊切換、外部點擊、Escape／關閉按鈕；限制於 HUD 與底部導航間，短畫面可捲動。保護提前解除或到期後，盾牌及詳情都移除。
- 世界／現實時間換算、新手與復國規則、提前解除、開發者罩、Runtime、存檔、T1／T2／T3、Replay Fence、PWA 及圖片皆未改。Preview Hook／Controller／Compute／Protocol／依賴鍵的正式來源與基準逐檔一致，有限來源證明另外鎖住這些不變項。

## Production Chromium 實測

Chromium 154.0.8037.57，Production build，原生 World Worker、IndexedDB。合成種子 884422、25X。Android viewport／觸控模擬為 320×640、390×844；桌面 1440×900。

**62 項檢查全通過**，含全部十種 View、城內／城郊、左右捲動、全景／放大、城市垂直捲動、地圖面板、齒輪避讓、首頁、到期／提前解除及復國提示。每個頁面都檢查一個且僅一個盾牌，尺寸、視窗／HUD／導航邊界，以及與重要控制項的遮擋。地圖另確認盾牌不與 canvas 重疊。

逐動畫幀觀察整段導覽，三種寬度皆為：**重複 0、缺失 0、節點替換 0**。倒數保持單調，不因切頁回到起始值；每次切頁後沒有殘留詳情。完整幾何與互動結果：[browser-checks.json](browser-checks.json)。

| 頁面 | 390px 截圖 | 320px／1440px 代表圖 |
|---|---|---|
| 城郊 | [山景定位](390-outskirts.png) | [320](320-outskirts.png) · [1440](1440-outskirts.png) |
| 城內 | [避開建築](390-town.png) | [320](320-town.png) · [1440](1440-town.png) |
| 世界地圖 | [地圖](390-map.png) · [面板](390-map-panel.png) | [320](320-map.png) · [1440](1440-map.png) |
| 軍隊 | [軍隊](390-army.png) | [320](320-army.png) · [1440](1440-army.png) |
| 科技 | [科技](390-research.png) | 全尺寸幾何結果見 JSON |
| 軍團 | [軍團](390-legion.png) | 同上 |
| 外交 | [天下勢力](390-diplomacy.png) | 同上 |
| 戰報 | [戰報](390-reports.png) | 同上 |
| 治理 | [治理](390-empire.png) | 同上 |
| 任務 | [征途目標](390-tasks.png) | 同上 |
| 設定 | [設定](390-settings.png) | [320](320-settings.png) · [1440](1440-settings.png) |

另以既有拖曳操作把齒輪移到盾牌原位置，確認盾牌避讓：[390px](390-gear-collision.png)。既有 390px 齒輪預設位置可能擋到 XY 工具；測試使用原有拖曳功能移開後操作，沒有以強制點擊跳過遮擋，也沒有擴張修改齒輪功能。

## 預覽與安全回歸

保留相同資產管理與 Preview 程式，重新量測：1X／10X 各 16 秒、25X 農田詳情連續開啟 61 秒，**每組都只送出 1 次初始 Preview Worker 查詢、2 次首次提示出現／移除，沒有背景訊息反覆閃爍**。數據見 [preview-retained.json](preview-retained.json)。CPU／handler 耗時是雲端單次樣本，不推論 Android 真機效能。

原 #64 瀏覽器回歸亦保留：成本不足變足夠、真正 Worker 錯誤與逾時、重試後正式提交、建造／取消各保存一次、倍速切換、保護提前解除與到期。舊的「城內／軍隊應沒有盾牌」斷言依本次正式要求改為顯示一個；沒有刪掉其他驗證或延長期限。新版全域定位在 ResizeObserver 後更新，場景縮放測試先等待實際幾何收斂，再維持原定位斷言。

88 項定向測試與原 13 項瀏覽器回歸已通過（明細：[preview-ui-checks.json](preview-ui-checks.json)）。相關定向測試包含單一 Shell 掛載、所有 View 的同一 DOM 與倒數、無殘留詳情、全尺寸避讓、官方倍速／暫停／復國／到期；原 Preview Worker 與正式 admission 比對全數保留。Typecheck、Build、完整隔離 Regression、來源 Gate 與 CI 最終結果見 PR Checks 及交付紀錄；完整回歸使用原 `node scripts/verify-in-isolation.mjs full`。

## 尚未驗證

Android 真機的手指點擊、網址列／軟鍵盤、字型及低階硬體仍待實機。避讓依可視 DOM 控制項幾何；密集頁面採周邊空間，極端小視窗仍需真機確認。歷史私人長局存檔測試的原有跳過條件、既有 HOLD 與獨立 Gate 狀態不變。
