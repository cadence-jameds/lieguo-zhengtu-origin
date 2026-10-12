# 列國征途：始源 v0.30.29 更新報告

日期：2026-10-08。唯一 implementation baseline：v0.30.28，commit `33b1cec2251caa15df1b259e2951e2659b4a3670`。本輪規格 authority：v90。執行 B5 城池偵察單一化 Delta，以及使用者授權累積的資訊頁／圖層／戰報美術修正。沒有開始 B6、B7、B8，也沒有重做 combat resolver 或 B2～B4。

## 城市偵察結果

城市派遣移除情報類型選單；玩家僅編入斥候數量並下達偵察命令。新的城市 command 不帶 scoutMode；舊兩種 mode 保留於 schema 作相容用途，不能再由玩家選取。

成功時，Formal resolver 在斥候抵達時間先結算城市當下經濟，再一次複製四資源庫存、本城駐軍、合法駐防援軍編成、城牆等級和既有合法城防（castle／bunker.*）。駐軍與援軍各自保留兵種、數量，units 同時保留兩者合計供既有資料介面使用。觀測時間保留世界事件時間與現實時間，UI 顯示現實日期及歷史情報標示。

快照不含全部建築、科技、施工／研究佇列、出征軍隊或 AI 隱藏資訊；使用白名單逐項建立，沒有複製整個城市／勢力。援軍快照建立在反偵察傷亡之前，後續目標庫存、城牆、軍隊、城堡或援軍變化均不會改動已取得快照。

沿用 10／人的偵察力、12／人的反偵察力、嚴格大於、平手守方勝、失敗方斥候全滅及勝方既有 Math.round 傷亡公式。失敗沒有 intel；攻方失敗戰報亦不揭露援軍身分、來源、駐軍或即時城牆／人口數值。成功的防守玩家仍收到遭到偵察警報。

抵達後情報只留在 pendingIntel，target intel 與 IndexedDB BattleReports 均不能提前讀取。至少一名存活斥候返回原來源城才寫入 durable scout-delivery receipt 與成功戰報；改送其他己方城市不交付城市情報。BattleId／ResolutionId、完成及交付 receipt 沿用，沒有重建戰鬥結算架構。

戰報與世界地圖目標頁共用 ScoutIntelDetails，資源、駐軍、援軍、城牆及城防一次顯示同一份已交付 snapshot，並明示當時狀態／非即時數值。target intel 仍從既有獨立 IndexedDB 戰報取得，未另建資料庫或即時查敵方內政。

## 存檔相容邊界

Formal schemaVersion 3、既有內容／規則 ABI 標籤與存檔格式保留；只新增 optional city intel 欄位。新城市 scout 不需要 scoutMode，野外仍固定 resources-army。v0.30.28 舊 outbound 的 resources-army／defenses-army 任務可正常 encode/decode，抵達後兩者都產生 v90 完整快照。

**已在更新前抵達、正返城的舊任務若只保存了一半 snapshot，缺失的歷史資料已不可還原。此版保留它原先記錄及任務，不重抽、不取現在資料冒充過去；返城仍交付原部分紀錄，成功戰報明示「舊版部分情報紀錄」。因此「舊返城部分快照一律變成原抵達時完整情報」無法在不捏造歷史的條件下完成。** 新偵察及未抵達的舊任務皆符合 v90；此為明確相容限制，不宣稱舊部分歷史能補齊。

野外偵察資料形狀、固定模式、資源與軍隊、generation 隔離及既有返城規則維持。未修改 432 slot、生成比例、守軍、loot、generation、respawn 或 v87 盜賊 1.5 倍資源／1.2 倍守軍規則。

## 累積 UI 修正

- 共用建築頁：前置、施工狀態、成本、工期及升級／拆除操作移到效果與專屬資訊上方；前置全滿足預設收合，任一未達預設展開，仍可手動切換。
- 建造選單：移除獨立「查看資訊」按鈕，以可鍵盤操作的建築名稱開啟共用資訊頁；時代與最高等級置於名稱右側。逐項前置未達紅字、滿足綠字，「符合建造條件」綠字，數值仍讀 Formal selector。
- 地圖選取及定位光暈先畫於地面，建築畫在其上。城內／城郊施工進度改為獨立 z-index 200 overlay，不受前景建築或施工架遮擋；手機與桌機共用。
- 新的野外戰報名稱與地塊使用同一 Formal 名稱 catalog：沃野農莊、山林木寨、採石場、黃金礦脈、盜賊營地及 Lv。此為顯示修正，不改據點數值。
- 所有偵察戰報優先使用專屬 scout-report.webp：斥候於樹林遠觀城市，未再使用征服／攻城圖片。
- 首頁保留最新十項更新。地庫名稱、資源 Lv10 進階美術、市政廳 City 入口、DEMO 導覽與既有開發者模式沿用 baseline 已完成內容。

## 20 種共用建築頁覆蓋矩陣

每種均重跑手機／桌機頁面及共用骨架；操作位置修正對所有共用頁生效，18 格城郊資源田保持獨立。

| 建築／設施 | 專屬資訊沿用 | 手機／桌機 |
|---|---|---|
| 城市中心 | 施工加速、800容量、時代晉升 | PASS／PASS |
| 民居 | 單棟及全城住房、人口不直接由民居產生 | PASS／PASS |
| 倉庫 | 基礎與全城容量、City＋10%、固定800不加成 | PASS／PASS |
| 地庫 | 單棟及全城保護量、不增加容量 | PASS／PASS |
| 兵營 | 訓練兵種、精銳資格、時間倍率、佇列 | PASS／PASS |
| 城牆 | 防禦加成、正式等級／耐久、固定設施 | PASS／PASS |
| 射箭場 | 訓練兵種、精銳資格、時間倍率、佇列 | PASS／PASS |
| 馬廄 | 訓練兵種、精銳資格、時間倍率、佇列 | PASS／PASS |
| 鐵匠鋪 | 攻防科技及前置，不把建築當攻防加成 | PASS／PASS |
| 學院 | 一般研究加速、科技／精銳資格及研究狀態 | PASS／PASS |
| 市場 | 商隊2000載量、可用／在途、自動物流 | PASS／PASS |
| 市政廳 | City晉升、治理唯讀、行政網路、里程碑 | PASS／PASS |
| 使館 | 軍團／帝國及未開放政治唯讀 | PASS／PASS |
| 磨坊 | 每級4%、基礎／加成／實際產量 | PASS／PASS |
| 鋸木場 | 每級4%、基礎／加成／實際產量 | PASS／PASS |
| 石匠工坊 | 每級4%、基礎／加成／實際產量 | PASS／PASS |
| 鑄幣所 | 每級4%、基礎／加成／實際產量 | PASS／PASS |
| 攻城工坊 | 攻城／輜重兵種、時間倍率及佇列 | PASS／PASS |
| 城堡 | 來源文明、文明衛隊、拓殖合法入口 | PASS／PASS |
| 修道院 | 人口成長加成、全城成長、不增加住房 | PASS／PASS |

## 驗證結果

兩個正式回歸批次合計 **56 個測試檔、553 個唯一測試 PASS，0 failure**：Formal／presentation／save lock 49 檔525項；既有 interaction／useGameInteraction／worldStream／developer 7檔28項。包含原先 B1～B5、save/load、Recovery、BattleReports、target intel、城牆、v87／v88及全部既有 UI 回歸。新增 scoutV90 Formal 13項、UI 7項，共20項。

新增覆蓋：城市一次完整成功、駐軍援軍分離、只允許斥候、失敗0情報、平手守方勝、失敗報告隱去援軍、arrival immutable、返城前不可讀、0存活不交付、原城失去不交付、舊兩種 mode outbound及returning讀檔、defender警報、BattleReports reconnect/export與target同一snapshot、野外無回歸、無UI模式選單、專屬圖片、前置收合、建造名稱入口與顏色、進度overlay與地面selection繪製順序。

TypeScript 與正式 production build PASS；git diff --check PASS。UI證據為DOM互動、HTML、Formal數據、CSS圖層與canvas繪製順序，未追加真實瀏覽器像素／觸控／FPS驗收，不將HTML產物宣稱為實機截圖。

一般施工 active退款50%、queued退款100%，軍事／研究／拓殖與City規則、征服50X戰術封頂10X皆保持。沒有 legacy engine 作 authority，沒有新增未開放政治或交易 command，沒有 Gate 重審聲明。

## 交接與停止

只接續本版本 source；完整資料見交付source-tree.sha256及SHA256SUMS。authority-v90.md SHA256：`ab0a55539881f78744ef3c8ddc564e32598a2d80eeda323ec6cdb46a7f97d0f3`。

本輪完成後 STOP。未開始 B6／B7／B8；後續新階段須使用者另行授權。舊部分返城情報的歷史缺失限制保留於交接，不能由下一輪使用現在城市資料消除。
