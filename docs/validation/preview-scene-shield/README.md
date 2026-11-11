# B10 建造預覽與場景盾牌定向修正

Base：`96935268381f4e6366489b46e7a168b89fd78fcc`（最新 main，含 PR #62／#63）。程式來源提交與檔案雜湊見 [compatibility.json](compatibility.json)；交付 HEAD 見 Draft PR。未合併、未部署，亦非整體遊戲或 Android 真機驗收宣告。

## 原因與修正邊界

`useConstructionPreviews` 原先將 `world.revision` 放進 identity。每次世界快照更新，舊結果立即不再符合 identity；Effect 清除定時器、取消同 channel 的回覆，再排入查詢。即使 Controller 命中快取，UI 仍會經歷 stale → ready，反覆顯示「預覽已過期／已更新」。持續生產又使「資源不足」快取的逐項庫存全等條件失效，增加真正送入 Preview Worker 的計算。

現在在 Effect 中使用既有 `constructionPreviewContext` 結算單城，對照實際整數庫存與正式建造依賴：所有建築／資源田等級、住房、永久資格、時代、所有權、暫停、槽位、施工佇列與排程、工匠資格、目標。無施工佇列時工期可隨時間平移；有施工佇列時保守納入時間。Revision、結算時間戳、餘數及與建造無關的世界資料不再成為失效原因。訓練不與施工共用容量；訓練支出／生產結算造成的實際庫存變化仍會納入。

第一次不足時，Preview Worker 對**私有複本**另用原 `quoteConstruction` 取得精確付款門檻，附在仍為 **invalid** 的顯示結果上。只要還有任一必要資源不足，就能沿用不足結果；達到付款門檻時重新向 Worker 查詢，庫存下降亦重新驗證。沒有新經濟公式或正式命令授權。未取得門檻時維持原本保守的庫存全等判斷。

每個新世界物件在比對前均不提供舊 Ready 作為 current `results`。相同 scope 的上次估時只能透過獨立 `displayResults` 顯示，不能授權操作；切城市、戰役、目標或分支時不沿用。generation／channel 取消、完整協定戳及舊回覆隔離保留。正式建造、升級、取消仍只送原命令並由 Runtime 重驗。

一般重算不再播報內部 stale／ready 文案；首次等待顯示「正在取得施工時間…」。成本與缺少數量、前置資格繼續使用既有 live UI。真的不可用、Worker 故障或原有 5 秒逾時仍顯示錯誤及「重新查詢預覽」，不自動無限重試，也不冒充世界引擎故障。原 80ms／250ms 合併界線與 5 秒 Worker 期限均未延長。

未修改任何既有 `src/game/formal/*`、Runtime、AI、戰鬥、經濟公式、存檔 Schema、T1／T2／T3、Replay Fence、Writer Lock、存檔管理、PWA 或美術。來源 Gate 以固定 BASE／implementation SHA 增加有限後繼證明；PR #62 原本的 Preview Controller 不變項只透過這個有限 UI 清單的精確雜湊銜接，歷史及其他不變項仍嚴格檢查。其他全部 `src`、PWA 設定、美術及歷史紀錄維持原雜湊。未放寬任何舊斷言或測試期限。

## 量測方法與實測

以 `scripts/verify-preview-scene-browser.mjs` 對修改前保存的 Production dist 與修改後 Production dist 分別執行。相同合成種子 884422、初始四資源 0、99 AI、390×844、1X／10X／25X，新瀏覽器 profile。1X／10X 各開啟 16 秒，25X 農田詳情連續開啟 61 秒。基準已在編輯前保存，未使用私人存檔。

觀察點是原生 Worker `postMessage`／回覆與 `.construction-preview-status` 的真實 DOM 變化；包含初次出現／移除的讀取提示，沒有把成本數字正常更新算成閃爍。測試伺服器在 Worker 外加純量測標記，記錄同一 message handler 的運算耗時，前後使用完全相同標記。沒有更換計算實作。圖檔、World Worker 及正式資料路徑照 Production 執行；此獨立效能測試阻擋 SW 以免不同快取暖機干擾，另以原生 SW 測試確認 #62／#63。

CPU 為 Linux `/proc` 中該 Chromium 及存活子程序的 user＋system ticks 差值（含 World Worker／繪圖等），不是只計算預覽，也不是 Android CPU。記錄並要求量測期間無子程序退出。另列 CDP 主執行緒 TaskDuration 與 Worker handler 耗時；三者不能混稱。各情境為單次樣本，不能推論所有機型固定改善百分比或 FPS。

<!-- measurements -->
| 倍速／觀察秒數 | Worker 請求前→後 | 可見切換前→後 | Worker 運算 ms 前→後 | Chromium CPU 秒前→後 | 主執行緒 Task ms 前→後 |
|---|---:|---:|---:|---:|---:|
| 1X／16s | 1 → 1 | 4 → 2 | 3.5 → 7.8 | 5.13 → 1.80 | 1579.5 → 564.7 |
| 10X／16s | 4 → 1 | 16 → 2 | 5.7 → 2.0 | 5.47 → 4.35 | 923.9 → 678.5 |
| 25X／61s | 44 → 1 | 178 → 2 | 22.0 → 2.7 | 36.06 → 29.63 | 3438.8 → 2411.0 |

Chromium 154.0.8037.57，Linux、Node 24.19.0、容器 2 CPU／8 GiB。25X 基準的 Worker stamp 從 revision 0 到 88；DOM 記錄 88 次 stale 與 89 次「已更新」出現（約每秒 1.44 次失效、2.92 次可見切換）。修改後只有初次讀取提示出現與移除，後續 61 秒沒有重播 stale／ready 訊息。成本仍實際更新；另測石材缺 4 → 足夠後按鈕可用並成功保存。

[25X 詳情修改前](before-390-25x-dialog.png) · [25X 詳情修改後](after-390-25x-dialog.png)。
<!-- /measurements -->

明細：[measurements.json](measurements.json)。原始開發排查曾捕捉到 25X／61 秒 45 次 Worker 計算、174 次狀態切換；上述最終量測統一從點擊前開始，包含初始查詢，不與早期排查窗口混算。

## 場景盾牌

Shell 的獨立保護列已移除。盾牌只掛在城郊 `.city-scene-viewport`，是橫向捲動 `.town-viewport` 的兄弟節點；中心位於可視容器左起 40%、上緣 8%，28px 高、內容自適寬、深綠半透明及細金框、等寬數字。定位不依螢幕固定座標，也不在滑動或放大後的美術 composition 上。

城內及其他頁面沒有這個覆蓋元件或保留空白列。詳情依盾牌實際位置選擇上下方、限制在 HUD 下緣與手機導航上緣之間（短畫面可捲動），使用 Portal 避免場景裁切；再次點擊、外部點擊、Escape 及關閉按鈕均可收合。結束後完全移除，場景高度不變。48 世界小時、復國、提前解除、官方 effectiveSpeed／暫停來源及開發者保護罩規則均未變動。

| 檢查尺寸 | 結果 |
|---|---|
| Android 模擬 320×640、320×844 | 定位、28px 高度、全景／放大、左右捲動、可見資源田點擊中心、城內建築、詳情邊界通過 |
| Android 模擬 390×844、390×660 | 同上；不重疊底部導航與快速設定齒輪 |
| Desktop 1440×900 | 同上；城內及非城市頁面沒有盾牌列 |

[390px 修改前](before-390-shield.png) · [390px 修改後](after-390-shield.png) · [320px](320x640-shield.png) · [390px 詳情](390x844-details.png) · [320px 捲動詳情](320x640-details.png) · [桌面](1440x900-shield.png)。幾何與互動紀錄見 [browser-checks.json](browser-checks.json)。

## Issue #38 盤點

- 正式入口 `src/main.tsx → src/App.tsx → game/GameApp.tsx`。
- `cityActions.ts` 已用 `QUEUE_CAPACITY` 顯示「已排滿 5 項工程」，本次不重做。
- `FormalCityPanel`、`CityScenes`、`CityQueues`、`BuildingDetail` 的建造／訓練摘要均使用正式上限；正式建築、資源田、城牆及徵兵入口沒有過時的 3 筆容量文字。
- 新回歸確認建築／資源田／城牆在 3、4 筆時不誤報額滿，5 筆時顯示正式上限，施工與訓練摘要顯示 3/5。原 Formal 五筆可排、第六筆拒絕及玩家／AI 測試保留。
- **全專案搜尋仍找到歷史 DEMO** `CityView.tsx:35`、`Views.tsx:12,18` 的 `/3`，及 `legacyEngine.ts:812` 的舊總督文字。它們僅供 `legacyGameApp.tsx`，不在正式入口；`legacyEngine.ts:255` 的歷史規則本來就是三筆。將其文字改成正式五筆會錯述歷史 DEMO 規則，因此未改動。規格參考中的 9/3/3/3、歷史證據及非容量的除以三亦保留。
- Issue #38 保持 OPEN。本 PR 僅確認目前正式 UI 一致性並補回歸；集中回饋的其他待追加項目未處理，未宣稱整個 Issue 結案。

## Issue #14 僅 P0-C-1

原 `feedbackDuration` 的成功提示為 1500ms，錯誤為 6000ms；GameApp 提示 Effect 只依賴 error／notice／feedback，不因世界 Revision 重播。本次保留既有實作，以 Production 驗證「命令已提交。」自動消失，之後背景 ticks 不重新出現。

Preview 的正常重算不再製造通知。既有 `CommandFailure` 僅在真正需要操作的異常顯示恢復入口；未重新加入命令收件匣。原生 IndexedDB 接收故障 → 重試一次成功的 #63 測試保留，正常建造／取消及 Preview 故障恢復另行驗證。P0-C-2～13、Issue #46／#47／#48 全部未納入；Issue #14 其他效能 HOLD 或規則工作未宣稱完成。

## 驗證結果

<!-- validation -->
- 定向 Vitest：8 檔、83 項通過；包含原 Preview Worker 對正式 admission 的完整比較。
- Typecheck、Production Build、Release artifacts／Worker identity 檢查通過。
- 最終 Production Chromium：13 項通過，包含 320px 詳情不得覆蓋 HUD 的加強檢查。
- PR #62 原生 Worker／IndexedDB／Web Locks／SW：14 項通過。
- PR #63 原生快取／離線／恢復：9 項通過；同版本第二次進入無額外圖片下載，刪除一張快取只補一張，模擬更新兩張圖示只下載兩張，更新必須經既有確認流程。
- 上述 #62／#63 明細：[safety-browser-checks.json](safety-browser-checks.json)。更新測試在未推送的獨立 worktree 修改兩個 SVG 的無效用註解，正式 PR 的美術與 PWA 檔案均未修改。
- 來源／美術／歷史證據 Gate、完整 `node scripts/verify-in-isolation.mjs full` 與 GitHub CI 的最終結果，見 Draft PR Checks 及交付紀錄。保留原有全部檢查，不以 smoke 或 r3 模式代替完整回歸。
<!-- /validation -->

定向案例涵蓋 1X／10X／25X 持續生產、不足轉足夠、四種資源田、建築／城牆、施工排程／訓練支出依賴、不同城市／戰役／分支／目標、開關詳情、Worker 逾時／故障及恢復、過期回覆隔離、合法提交及唯一建造／取消效果。盾牌檢查一般與開發者有效速度、原生速度切換、暫停、復國、提前解除及到期。

開發過程曾與瀏覽器並行執行原 Formal 預覽測試，因共用兩顆 CPU 超過既有 5 秒期限。未修改期限或斷言，停止其他負載後以相同期限重跑通過；最終完整回歸使用既有隔離腳本。新增瀏覽器驗證亦改為等待實際 durable commit，而非用固定 600ms 猜測保存完成；讀取該 transaction 中的 committed row，避免把後續合法 T3 修剪誤判成命令遺失。

完整 CI 的第一次執行另發現盾牌詳情單元測試缺少版面 fixture：Happy DOM 回傳零尺寸，觸發正確的離開可視區域收合。已僅補上可視盾牌的 DOMRect，原倒數、展開、外部點擊、Escape、復國及到期斷言全部保留；產品程式與期限未改。Production Chromium 的實際版面檢查維持通過。修正後完整結果仍以 PR 最終 Checks／交付紀錄為準。

## 剩餘風險

Android 真機未驗證：觸控手感、Chrome 網址列／軟鍵盤、OS 字型及低階 GPU／CPU／記憶體表現仍須實機回歸。畫面位置與點擊證據來自 Chromium 的手機 viewport／touch 模擬，不宣稱為 Android 真機截圖。全景模式在 320px 空間較緊，已檢查可見互動中心，仍建議真機確認手指操作。

有施工佇列時為維持精確排程仍保守納入世界時間，Worker 次數不保證與空佇列相同；正常重算的顯示維持穩定。World Worker／AI 的總體效能並非此次改善目標。未提供私人長局存檔，因此既有可選長局回歸保留其原跳過條件。歷史 B5 E1 HOLD、Astra Gate 未 PASS 及手機實測待辦不因這個 UI PR 改寫。
