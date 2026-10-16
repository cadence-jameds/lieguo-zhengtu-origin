# V94 DEMO／Formal UI Parity Matrix（施工前盤點）

基準 main `9cf6369097cc7495c99197b83026b09c447f0f19`；本開發分支保留 R4 `608de8a77a8644b7a3a894685e27ced9d4507ca0` 的 Git 祖先與已驗證來源。V94主規格只讀，不變更第9、16、17章或其他主規格。

現存 legacy 元件是可用的視覺／操作參考，不等同完整v0.30.2 ZIP；本輪沒有該ZIP完整性證明。不得接回legacy engine／存檔／政治制度。全部操作沿用Formal commands、Worker、ownership、revision及Persistence。

| 項目 | 現有參考／差異 | 分類 | 本輪方案 |
|---|---|---|---|
| 自己軍團管理 | Views.tsx DiplomacyView／Formal PoliticsView 混在長頁 | ADAPT＋NEW | 新LegionView，摘要＋總覽／成員／聯防／聯軍／管理；min(團長使館,10)容量，所有操作原Formal命令 |
| 世界帝國／其他軍團／領主 | legacy empire／league／lords分頁；Formal目前沒有獨立世界軍團分頁，只有領主卡片 | ADAPT | 恢復三分頁、公開名單與詳細卡；保留全部其他軍團瀏覽，不拿自己軍團頁取代世界列表 |
| 舊帝國三模式／舊外交 | legacy direct/vassal/federal、truce/alliance/vassal | REMOVE | 不接入，使用Formal中立／友好／戰爭與軍團→帝國資格 |
| 聯防／聯軍 | Formal PoliticsView混合表單 | ADAPT | 集中自己的LegionView，讀incomingAlerts與canCoordinate，原defense/joint命令；友軍私有兵數不顯示 |
| 多城治理 | EmpireView搜尋／篩選／城市列表；Formal逐城50張表單 | ADAPT＋REUSE | 上方總覽、可搜尋／篩選列表與單一選取城市GovernorControls；完整保留governanceBase CAS與Worker admission |
| 市場物流 | FormalDevelopmentPanel物流 | REUSE | 與治理分開，維持自己城市操作，不新增DEMO批次治理／共享庫存 |
| 外交戰報 | ReportsView四分類；Formal只有三分類且政治命令目前無正式外交報告來源 | ADAPT＋NEW | 新diplomacy category與合法玩家政治delta notices、四分類、50則分頁／未讀／清除／checksum完整備份相容 |
| 工匠團 | ExtinctionView掛在天下勢力，只有⚒；拓殖隊在ArmyView | ADAPT＋NEW | 特殊非戰鬥單位卡片並列、共用detail視窗；獨立原創SVG工匠工具圖示，保留原craftsman commands及取得規則 |
| 畫面／文明徽章／分頁／確認dialog | game.css、presentation/Art/UI、public/art | REUSE | 延用卡片、關係色、文明圖示、Dialog及既有移動導覽，不建立另一套UI framework |
| #4 文明介紹過時文案 | Start.tsx共用六文明說明 | REMOVE | 移除「戰鬥功能將於後續開放」，不宣稱現代／任務等未實作功能已開放 |
| #5 城市佇列摘要 | CityScenes工具列目前缺少占用資訊 | NEW | 桌機／手機建造N/實際容量、訓練N/實際容量；active＋queued訂單數，城市切換同步 |
| #6 建築卡片資源排版 | FormalCityPanel、game.css construction-menu限制右側窄欄 | ADAPT | 圖示＋標題／說明置頂，成本／缺額／時間／資格跨欄全寬；不改成本、付款或工期 |

## 規格與source邊界

- V94第17章已核准每城建造／訓練各5笔，source `QUEUE_CAPACITY`仍是3。玩家本輪明確禁止藉UI重構修改Scheduler；摘要讀實際常數，不偽造0/5。五筆排程獨立實作 **PENDING（本輪不改）**。
- V94第16章80項任務目前只在主規格，source仍是既有三項指引。本輪不新增、變更任務／獎勵，80項任務實作 **PENDING（不在本輪）**。
- V94第9章封建使館Lv1建立軍團、容量包含團長、Lv12/13/14/15協作門檻與現有politics/cooperation helpers相容，UI直接讀正式helpers，命令端最終重驗。
- R4原證據不重寫；B5 E1 HOLD、Astra NOT DECLARED PASS、實體手機／長期校準待驗狀態保留。本輪只做新UI與必要外交事件投影，無B9／B10、無main/release更新、無Pages部署。

## 驗收與證據計畫

桌機1440×900／手機390×844，軍團五分頁及無軍團／普通成員／失效組織；保留世界其他軍團列表、治理1/10/50X及城市切換、真外交事件與50則分頁／Recovery、六文明工匠來源／轉移／建堡／非法拒絕，另驗證#4/#5/#6。元件測試與真Chromium分開標記PASS／FAIL／BLOCKER／MANUAL PENDING，不以Node時間宣稱GPU FPS。

## 完工接線

上述REUSE／ADAPT／NEW／REMOVE均依盤點完成；限定source修復為外交報告投影與真瀏覽器發現的50則分頁count缺陷。完成狀態、Formal命令、素材來源與檔案見 `V94_UI_Integration_Report.md`；主browser18組與補充10組PASS，完整Regression與最終SHA見 `../validation/v94-ui/summary.json`。V94§16／§17獨立PENDING與Astra／E1邊界不變。
