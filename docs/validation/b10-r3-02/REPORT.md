# B10-R3-02 非同步建造預覽

狀態：Draft；只交付 R3-02，未合併、未部署，不開始 R3-03。Base 是未合併 PR #54 的 `edca2f29805f0cdc4b0f89cd3cd00a8f9a819e39`。GitHub main 在施工開始時仍為 PR #53 的 `443f170b277f71ee26a34ee3b5017687a98e01ab`，因此本 PR 疊在 R3-01 分支；沒有更新 PR #54 的 branch、body、HEAD 或 manifest。

## 依賴盤點與實作

舊冷預覽的 `constructionPreview`／`craftsmanCastleAction` 在 render 內呼叫 `submitFormalOrder`，複製世界、搜尋命令收據、建構 Scheduler 並驗證整份草稿。找到的產品入口：

| 入口 | 本批處理 |
| --- | --- |
| FormalCityPanel 空地分類候選清單 | 同畫面候選單一批次，非同步 Worker |
| BuildingDetail 新建、連續升級、固定城牆 | Hook 查詢，舊結果立即失效 |
| FormalCityPanel 資源田 | 同一 Hook；正式 Lv1～15 資格 |
| 現有多筆工程 | 正式 jobs 直接顯示，新增工程排程交給 Worker |
| CraftsmanPanel 工匠建堡 | 同一 Worker，共用工匠與建堡資格；不冒用普通城堡付費規則 |
| cityActions 對外工具函式／既有領域測試 | 保留輕量共用規則 adapter，移除完整 Reducer、world WeakMap cache；產品 render 無呼叫 |

新增 `constructionRules.ts` 抽出原正式建造 admission、付費快照、通道及開始時間，Formal economy handler 與 Preview 共用；`buildingRequirements` 委派相同的 `constructionRequirements`。原施工 promotion 邏輯移至共用 helper，正式 EventScheduler 的排序、事件建立／替換仍留原位置。`RuleViolation` 只有模組搬移與原 re-export。正式 handler 仍先結算、提升佇列、驗證、扣款及建立事件；預覽從不做正式提交。未修改 Reducer、Scheduler、Model、Schema、AI 或 WorldStream Protocol。

## 單城 Context 與資料依賴矩陣

| 正式依賴 | 傳輸／共用方式 |
| --- | --- |
| 建築 identity、等級、slot、資源田、牆 | 單城 buildings、slots、fields、wallLevel；共用 catalog／requirements |
| 城市所有權與發令勢力 | city.ownerFactionId、issuerId；Worker 再檢查 |
| 時代 | owner age；正式規則目前無獨立科技／文明建造折扣，不新增公式 |
| 科技、文明、跨城行政、移動軍隊／拓殖護衛糧耗 | 在 effect 使用正式 `citySnapshot`／`settleCity` 結算單城；傳結算後 stock、housing、milestones，不傳科技樹、軍隊、所有城市或收據 |
| 人口、住房與永久 City 資格 | 單城結算後 population、housing、milestones、cityPromotionCompleted |
| 五筆佇列、第二施工通道、連續相同目標 | 單城 construction（上限五）、milestones；共用 promotion／quote |
| 施工時間、完成時間與付款 | time、既有 jobs 與共享 catalog；quote 回 startsAt、durationMs、paidResources、from/toLevel、lane、allocatedSlot |
| 工匠文明及待命資格 | 僅本城工匠 ID→待命授權布林；文明不影響現行工期／免資源資格，正式命令仍保存真正文明與工匠身分 |
| 滅國／結束 | paused；不提供可建造成功；合法復國後新 branch/revision 重查 |
| 舊經濟版本 | 無法安全局部遷移時回「無法提供最新預估」，不產生假結果 |
| Recovery／Import／Start／Reset | 使用 R3-01 真正 branch 識別、campaign、revision；不是由 world 物件引用猜測 |

Context **不含** FormalWorld、commandReceipts、events、BattleReports、Inbox、Authority、Recovery、worldLayer 或軍隊。只對單城做既有 lazy settlement／clone，且在 effect 內；React render 不做 context clone、Canonical JSON 或正式 Reducer。共享規則在 Worker 對私有單城草稿執行，沒有第二世界權威。

## 非同步生命週期

`protocolVersion=1`、Context version=1；每批帶 campaign、branch、revision、cityId、targets（含 slot／lane）、requestId、generation。單一 lazy Dedicated Worker；每次一批，最多八個 channel 排隊，每 channel 只保留最新一批，每批最多 32 個目標。Hook 80ms 合併更新，連續更新最長 250ms 就送出當時最新內容。新世界／目標／分支 render 立即隱藏舊結果；effect cleanup 與 controller cancellation 阻止關閉或切換後的回覆。

Cache 上限 64 個小批次，以正式資格／時間／排程依賴與 branch、target 為鍵。健康空佇列的 startsAt 可精確平移，cache hit 仍重新檢查 stock 足夠覆蓋原付款；扣資源、取消、換 slot、資格與排程變動會失效。資源不足的 invalid 結果只有庫存逐值相同時跨 Tick 重用；庫存改變就重新查詢，不會被誤用成新的可建造結果。這些檢查都在 effect/controller，不在 render，沒有掃描完整歷史。

Worker 失敗後同一目標的異常不因後續 revision 消失，也不自動反覆重啟，直到手動重查或切換目標／分支。逾時 5 秒或 Worker error/messageerror 終止 Preview Worker，顯示「暫時無法預估」及重新查詢；不無限重試。重查可建立新的唯一 Worker。預覽 loading/stale/unavailable 不作為一般建造提交的 disabled 條件；工匠未知預估亦可提交，由正式權威驗證。

T1/T2/T3、DB v2 Inbox、RuntimeMeta、有限重試、獨立命令計時及舊 Ack 防護保持原樣。`useGame` 只額外向畫面暴露既有 branch ref；`GameApp` 只提供 Preview branch context。預覽取消、錯誤或 timeout 不呼叫命令取消／重送。

## 正確性證據對照

| 需求 | 證據 |
| --- | --- |
| 建造 Lv1、各種類、指定 slot、城牆 | constructionPreviewR302：全 Reducer 對照；wallDelta 舊測試 |
| 建築／資源田連續升級與 Lv1～15 | 同測試逐級參數化、前序 jobs；economyB3 舊矩陣 |
| 五筆容量、第二通道、同城不同工程、取消重排 | 同測試比 lane、startsAt、duration、付款、from/toLevel、slot |
| 資源不足、前置、時代、永久門檻、滿級、拆除、易主 | 同測試逐個與正式 rejection reason 比對；舊 schema Gate 不放寬 |
| 科技、跨城行政與軍隊糧耗、人口結算 | 同測試使用正式 lazy settlement，真實科技／軍事單位；development/economy 舊回歸 |
| 工匠、免資源、外文明與特殊資格 | 同測試及 craftsmanCastleUI 原有文明矩陣 |
| Save／Recovery、凍結、結束與合法復國 | 新 save roundtrip、freeze/end 對照；R3-01 durable／PR53 原測試 |
| 過期 revision／branch／target、亂序及關閉 | controller 與 React asyncConstructionPreview；權威 stamp 全欄檢查 |
| Worker 中斷、messageerror、timeout、重啟 | controller 與 React；明確 query 入口，不產生假報價 |
| 高頻更新、cache 與庫存變動 | React 連續 30 次 revision；controller time/stock 測試 |
| 99 AI／25X、Inbox 與 Ack 恢復 | 原 durableRuntime／useGameInteraction 定向回歸；真 Chromium 的獨立 Runtime／Inbox 情境 |

新等價測試會對同一世界／目標執行完整正式 Reducer，逐欄比較 quote，拒絕時比較 reason，並驗證世界未被預覽修改。未知／未支援內容回 unavailable，不自行猜測。

## 驗證與效能

詳見本目錄 checks.json、node-perf.json、browser-results.json。Node 與 Chromium 各自使用 100 勢力合法合成世界與 0／10k／30k／60k 收據，不上傳世界內容；每組 30 個正式樣本＋3 次 warmup。舊完整 Reducer 路徑在同次量測內重現，但使用本次版本的共用正式規則；不是重新驗證舊版本的 R1-C 絕對時間，也不與 R1-C 的 114.35／179.75ms 宣稱精確改善比。

原生 Chromium 使用本機 Vite source、真正 Dedicated Worker／IndexedDB；為測試本機 Vite，允許 Chromium localhost WebSocket，沒有關閉遊戲保護。cold sample 使用新 Worker，和產品持續共用 Worker 的 warm 行為分開。Node 小成本不代表桌面 p95 100ms／Android p95 250ms 收件指標達成。

### 原生 Chromium 結果

七個不同情境已通過，分三輪保留證據：完整量測輪的前五項 PASS；其第六項暴露 harness 只改 wall clock 的錯誤而 FAIL，修正為 wall＋monotonic clock 後，以原斷言定向重驗 PASS。前兩輪間遊戲 production source 完全未變。之後只增加庫存未變的不足報價快取分支，另以第三輪原生測試確認 30 個 Tick 只計算一次、補充資源後重新計算並回 ready。`browser-results.json` 同時保留原始 FAIL 與最後採用的每項結果，不把未執行的項目列為重驗 PASS。

99 AI 原生情境以 144,000ms 合成雙時鐘推進觸發一世界小時、25X 補算。在 Durable 通知當下記錄：預覽仍 Pending、catch-up 尚未完成；隨即終止 Preview Worker，最終正式結果 committed、效果及玩家施工各一筆，99 個 agent 均已有實際決策。這個時鐘注入只用於功能驗證，不是實機效能標準。

下表各欄為 p50／p95 毫秒，n=30、另 3 次 warmup。舊路徑指在本次規則版本重現完整 Reducer 預覽；編譯 Worker 欄使用 Build 輸出的實際 Worker JS，UI 使用 Vite source。每個 cold sample 新建一個 Worker（產品實際只共用一個）；batch 是同 Worker 上未命中的六候選批次。

| 收據數 | 舊路徑主線完整 Reducer | 編譯 Worker 首次單項完成 | 編譯 Worker 六候選 batch | 新主線 context＋post p95 | 實際空地面板可互動 p95 | Request bytes |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 13.50／34.00 | 57.70／105.30 | 1.00／1.50 | 0.60 | 53.20 | 1489 |
| 10,000 | 27.00／35.20 | 54.50／112.30 | 1.00／1.30 | 1.50 | 49.70 | 1493 |
| 30,000 | 54.80／61.70 | 55.10／75.60 | 1.00／1.50 | 1.00 | 42.10 | 1493 |
| 60,000 | 102.80／111.00 | 54.90／103.80 | 1.00／1.30 | 0.80 | 41.40 | 1493 |

本次改善是移走完整 Reducer 主線阻塞；首次 Worker 完成時間並非每組都比舊路徑快。Vite 未編譯 Worker 的首次載入 p95 約 212～265ms，不能混成編譯產物結果。健康 cache hit、context 與批次成本詳見 JSON；可觀測 controller 情境為 3 次計算、1 次舊結果丟棄、1 次 cache hit。靜態依賴檢查為 73 個模組、0 authority/reducer/storage capability；UI 三入口 0 同步完整 Reducer 預覽呼叫。

安靜量測輪的預覽與空地面板觀察窗皆無 >50ms 長任務。較早與完整回歸並行時曾觀察城市面板長任務，另行保留在 attempts；不宣稱所有裝置或負載都無卡頓。資料量由 0～60k 不會增加單城 Context；bytes 的數字字串差異來自 campaign／request ID，沒有傳歷史。

### 回歸與 Gate 狀態來源

定向曾有 130 項 PASS；後續增加切城／戰役、失敗後持續更新與 rejection 顯示測試，最終 UI＋controller 16 項 PASS。既有 Runtime 檔獨立重驗 64 項 PASS。Typecheck、Build、兩層精確 successor、招募原碼／匯入區段保護與防竄改測試、靜態 capability 檢查 PASS。

Node 24.19 的兩輪完整隔離各有同一個既有 Runtime developer admission 測試逾時：2291/1/1、2294/1/1（PASS/FAIL/SKIP），不能宣稱全綠。該測試會推進約 30 天；相同 Node 24 環境的單項診斷 n=1，R3-01 約 17.774s、新來源約 18.034s，僅用於定位，非效能等價驗收。已清理完成的 disposable copies 並以 CI 的 Node 22.23.4 執行相同 `verify-in-isolation.mjs full`：2295 PASS／0 FAIL／1 既有可選 skip；不改期限或斷言。此輪在最後的不足庫存快取優化前完成，該分支另有 16 項定向、原生測試與 Build，最終 HEAD 全回歸由 PR Verify 再覆蓋。最終隔離完整結果與 GitHub CI 以本回合交付、當前 PR Verify／其 regression-full.json artifact 為準，不能把舊結果當新 HEAD 綠燈。詳見 checks.json、attempts.json。

## 限制與後續契約

- Android 實機、完整 production UI／Pages、完整 SW 更新與背景系統終止仍待驗，未部署。已單獨驗證真正編譯 Preview Worker。
- 原有 B5 E1 HOLD、Astra Gate 未 PASS、實體手機待驗事實保持不變。
- Context effect 的既有單城經濟投影會讀正式 cross-city administration／upkeep；它不複製世界或收據。超大軍隊數量的該段成本需後續實機觀察，不能把 Node 結果當最壞情境保證。
- 嚴格 revision 失效期間顯示過期／重算，仍能正式提交。連續權威更新可能降低預估可見時間，沒有沿用過期報價冒充最新。
- 增加唯讀 Preview protocol／Context v1，後續正式建造規則新增依賴時必須同步更新共用函式與 context 版本；不涉及 R3-03 命令帳本或 R3-04 WorldStream 協定。

招募 successor adapter 只允許精確 cityActions 後繼，舊 non-recruitment 原始檢查仍在原歷史來源執行；新 Gate 另外固定當前招募函式區段及三項匯入逐位元不變。舊 recruitment manifest、DevelopmentViews、military 與所有舊 metrics 不改。Gate bootstrap 只有 11 個明列支援路徑，不採目錄或來源前綴豁免。
