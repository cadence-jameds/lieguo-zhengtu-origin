# 正式 UI 依賴盤點

以 PR #56 `1737d14` 的正式 UI／共用讀函式為基準。開發者獨立情境工具保留其自己的 FormalWorld；不是正式玩家 UI 的權威替代品。新型別禁止展示世界直接送入 Reducer、Persistence 或完整世界 Schema。

| 畫面／讀取入口 | 真實資料依賴 | R3-04 展示來源 |
|---|---|---|
| 地圖、據點、目標情報、路線 | 城市 ID／位置／owner、勢力、軍隊、政治、據點 generation、地形山脈 | 實體 Delta；靜態地圖獨立區段；歷史情報維持有 campaign/time/reportCursor 的權威單點查詢 |
| 城市資源與建築／資源田／牆／佇列 | 城市 economy、fields、milestones、slots、construction、勢力科技時代 | 城市實體；原純讀公式；Preview 獨立唯讀 Worker |
| 建造／訓練／科研資格與費用 | 本城、owner、科技、軍事佇列、研究與公共政治條件 | 共用正式純讀函式，WorldRead 聯集；正式提交再次完整驗證 |
| 軍隊、兵力、招募、移動、撤退 | 軍隊／城市 military、勢力、政治關係、公開目標 | 軍隊與城市實體；ID 與順序維持；不傳完整建立歷史 |
| 科技、突破、奇觀 | factions、researchProjects、largeProjects、物流、文明與資格 | 目前研究／工程資料，保留付款及 creation source 的必要 ID，不展開歷史收據 |
| 軍團／外交／帝國 | factions、politics、城市使館 | 現況政治區段，排除 RNG counter |
| 總督／治理 | 城市、governors、最後設定命令身份、owner／市政廳資格 | Verified Reader 增量衍生 governance fingerprint，含最新寫入身份，保留 ABA 保護 |
| 任務／征途目標／獎勵 | growthTasks facts/completed/claimed，城市容量與預約 | 持久任務狀態，不重掃收據；claimed 保留權威獎勵／來源資料，排除內部來源去重集合 |
| 戰報／通知 | 版本化分頁查詢、reportCursor、未讀數 | 獨立既有查詢；notificationSequence 不讓舊通知逆序覆蓋，不塞進世界歷史 |
| 戰鬥畫面／動畫 | combat battles/statistics、既有動畫最後 128 效果 | 現況戰鬥與 bounded battleEffects recent/cursor；正式 resolution receipts 全留權威 |
| 時間、速度、新手保護、滅國／復國／終局 | time、speed、nextEventAt、factions protection、extinction、victory | 展示區段＋原獨立 DisplayClock；不越過未提交事件時間 |
| 工匠與城堡文明來源 | 城堡永久來源／初建 job／精確 command issuer | Runtime 使用 Verified Ledger 精確查詢，輸出每城 castleSources；UI 不解析 fingerprint |
| 首頁／設定／更新 | metadata、campaign、時間速度、儲存狀態 | 明確 PresentationWorld，更新與正式保存仍等既有 durable acknowledgement |

## 所有原有 UI 命令歷史入口

| PR #56 入口 | 原歷史用途 | 現在行為 |
|---|---|---|
| `worldStream.worldPatch → projectWorld` | materialize 全收據並比較 section JSON | 完全移除正式展示路徑；WorldProjection 明確選欄位，WorldStream v2 比實體與展示區段 |
| `runtime.worker` 世界發送 | 完整世界／全量展示 Snapshot | 只發 committed read projection；投影失敗只提示重同步，不改 T2 結果 |
| `useGame` World／Patch 接收、`interaction.reconcileWorld` | 完整 FormalWorld 組裝與 JSON section sharing | 專用 PresentationStore，整包驗證、實體版本與結構共享；沒有空收據假 FormalWorld |
| `orderAdmission.playerOrderWithBase` | 玩家命令順序與身份 fence | 權威端原 fence 保留；UI 的 playerOrderBase 從展示現況擷取意圖，army map 用版本化靜態 digest |
| `governanceAdmission.governanceBase` | 順序敏感最後 applied governance write | UI 讀版本綁定派生 fingerprint；權威原演算法保留，共用 encoding，新增 ABA 對照 |
| `buildingDetailData.castleSource` | 初始建堡命令 issuer → 文明 | Runtime exact lookup／永久狀態衍生，UI 按 cityId 讀 source，不掃帳本 |
| 任務 selector／JourneyGoals → growthTaskStatus | UI 讀 completed/claimed；正式證明引用 findReceipt | 展示只需持久任務狀態；正式領獎證明與精確身份仍在權威 Schema／Reducer，未刪 |
| `FormalWorldMap` BattleImpacts | 從 combat.receipts 取最後效果，完整 cursor 去重 | 展示 bounded recent/cursor；來源 ID、cursor、branch 仍防止動畫重播 |

`commandHistory/findReceipt` 留在正式 admission、規則與 Schema 的呼叫，不是 UI 全歷史回傳介面。測試專用 ProjectionTestBridge 同時保留原始完整權威斷言，且驗證每份真 v2 投影與 committed source 的展示欄位完全一致；無生產 fallback。RAM Verified fixture 不冒充 IndexedDB T2；真正 DB／Worker 證據另列。

## Selector 失效邊界

城市詳情依本城、所屬勢力／總督、所有城市的身份／名稱／位置／owner／市政廳／使館、相關軍隊／物流／研究／工程、真實共享規則區段與事件時間失效。其他城市單獨庫存或人口變化不使本城詳情失效。跨城名字影響隨機建城名稱，跨城使館影響軍團容量，不能只比較本城。

Store 永遠保存最新完整展示現況；局部 Selector 僅保留一份前次讀取上下文。正式 issue 從根 useGame 的 React 已提交版本擷取，不從局部 Selector 的舊上下文取版本。開啟 Preview 另訂閱最新根展示版本。不同 campaign/branch/writer 的表單與快取重建。

React 仍會因時鐘、共享規則、健康狀態與真正改變的父層需求重繪；本批不宣稱所有元件都只因單一實體更新。可證明的是未變城市／軍隊參照穩定、單城詳情訂閱隔離、輸入本地化、無 render 全歷史或完整 Reducer。
