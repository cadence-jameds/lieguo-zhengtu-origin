# V94 UI 整合交付

施工基準 main `9cf6369097cc7495c99197b83026b09c447f0f19`（已包含V94正式規格）。獨立分支 `v94-ui-integration`，保留 R4 `608de8a77a8644b7a3a894685e27ced9d4507ca0` 為祖先；PR #3及其分支沒有更新。開發checkpoint `7c8ee6f3953a3f98b0fc4fd1ed7562557eb2385a` 已在本機 `checkpoint-v94-ui-20261013` 保留。沒有hard reset、force push、歷史改寫或部署。

## 最終行為

| 要求 | 實作／Formal接線 | 證據 |
|---|---|---|
| 自己軍團頁 | Shell桌機／手機導覽新增軍團；LegionView總覽、成員、聯防、聯軍、管理；團長／普通成員／帝國領袖權限，min(使館,10)含團長容量；轉讓／踢除／退出／解散確認並檢查組織fingerprint與來源城所有權 | 主browser五分頁、建立／申請接受／拒絕／邀請／踢除／轉讓／退出／解散／超額／普通成員 |
| 世界勢力 | PoliticsView帝國／軍團／領主三分頁、搜尋、所有其他軍團與公開成員／城市座標、正式外交；自己的聯防／聯軍集中至軍團頁 | world三分頁、山岳／遠方軍團、foreign-members截圖；不接回legacy帝國三模式 |
| 聯防／聯軍 | incomingAlerts合法警報；canCoordinate資格；來源城只允許自有城市；defense.set/dispatch、joint.create/join；引擎計算真實行軍／抵達／留守，友軍只顯示公開參戰狀態 | 保留990名、派出10名援軍；兩筆自己的聯軍承諾；補充fixture盟友13,791名不顯示 |
| 城市治理 | 搜尋／篩選／50城分頁列表、城市總覽、單一選取城GovernorControls；保留governanceBase CAS、ownership與Worker admission；市場物流獨立區域 | 桌機／手機1/10/50X，五方針、委任／停止、搜尋與城市切換、stale拒絕／duplicate／fresh retry |
| 外交記事 | 真實玩家可見politics delta產生diplomacy報告；成團／加入／退出／成員／領袖／帝國／請求／友好／六時解除／宣戰／停戰；無關AI與私有兵力不投影；四分類、50則分頁、未讀／已讀／單則與分類清除 | 核心diplomacyV94、browser62則真實命令記事／第二頁／重讀／Recovery；新類別checksum完整備份 |
| 工匠團 | 自軍隊頁特殊非戰鬥單位卡片，與拓殖隊並列；六文明名稱，待命／轉移／隨軍／施工真實狀態；自己的目的城；constructionAction正常資格／成本／工期，原craftsman.move/castle | 六文明下拉、SVG正常載入、同文明禁建、轉移／建堡成功；消耗成本與constructionCommandId／castleCivilizationId已核對 |
| #4文明介紹 | 移除六文明共用「戰鬥功能將於後續開放」，保留整備軍隊參考語句 | 補充browser六文明逐一選取及start-updated截圖 |
| #5城市佇列 | CityScenes工具列顯示建造N/QUEUE_CAPACITY、訓練N/QUEUE_CAPACITY；按選取城active＋queued訂單計算 | 0/3與真命令產生3/3；切城回0/3；桌機／手機 |
| #6建築選單成本 | 圖示／名稱／說明置頂，成本／缺額／工期／前置全寬；一般手機四資源同列，極窄螢幕可換行 | 手機卡356px、facts330px，四項成本同一Y；桌機卡608px、facts574px，無卡片overflow |

所有命令仍從useGame→Worker→Formal reducer→Persistence。新介面未修改AI策略、作戰數值、外交資格、25%流亡軍收編、工匠取得、城堡成本／工期、衛隊、總督成本或任務獎勵。

## 必要限定修復

真瀏覽器超過50則報告時發現 `readReportPage` 在Dexie Collection套用offset／limit後才呼叫count，而Collection操作會改變query，總數被截成50／當頁筆數，導致下一頁消失。改為**先計算未分頁總數，再讀取該頁**；新增第0／1頁總數均為53的回歸。這是本輪實際發現的缺陷，未改分頁大小／報告可見範圍／清除規則。

外交通知是事件投影，不是新的政治規則。只比較玩家自己的軍團、帝國、收發請求及關係；未更改Formal Scheduler。重複／拒絕／回復撤銷命令不新增報告。舊存檔不補造過去的政治記事；新程式可讀原有schema3／原四類別存檔。新增類別沿用既有report schema、checksum、cursor、IDB交易與Recovery；未變更IndexedDB表或schemaVersion。

## 圖示來源

`public/art/formal/unit-craftsman.svg` 為本輪原創SVG程式碼：交叉木槌與角尺、地基線，64×64，沿用 `icon-settlement.svg` 的金色描邊與扁平視覺。沒有複製拓殖隊圖片或使用單一⚒字元。`CRAFTSMAN_ART` 使用Formal Art與assetURL（含base path），六文明共用工匠職業圖示、名稱取自正式civilizationId。拓殖隊沿用既有旗幟／帳篷SVG。所有existing art來源及R4素材保持不變。

## 驗證

最終數字與檔案SHA見 `../validation/v94-ui/summary.json`、`manifest.json`。完整Regression使用原 `node scripts/verify-in-isolation.mjs full`、maxWorkers2、原30秒timeout，在暫存複本執行，不排除歷史測試、不覆寫既有接受紀錄。Typecheck／production build只建置，沒有Pages部署。

主真Chromium桌機1440×900／手機390×844：18組PASS、0FAIL、0console/pageerror/HTTP錯誤；補充10組PASS／0FAIL。手機為觸控viewport與真Chromium自動操作，不是實體手機驗收。所有政治／協作／治理／工匠操作都有正式Worker ack與存檔狀態核對，commandEvidence在browser.json。100勢力／99AI三seed的8世界小時、SaveLoad、切片／離線等價由原integrationR4完整Regression在本輪來源上重驗，fresh evidence另存本輪目錄，R4原件沒有改寫。

前後截圖：before-*是修改前R4 production build、原governance-1-false合成存檔；after軍團／外交／工匠畫面使用本輪明確受控合成世界，不能拿不同fixture資源／軍力作平衡比較。合成fixture直接授予時代、使館、軍力、庫存、市政廳與工匠來源，AI決策延至30日；成功僅證明操作與正式命令接線，不宣稱自然AI必然接受邀請、自然取得工匠或自然平衡成熟。工匠取得／施工完成才消耗／外文明衛隊由既有完整Regression驗證。

初次測試嘗試保留在attempts：測試程式曾誤把JSON文字直接傳decodeSave／漏offline參數，已修正測試輸入；獨立targeted預設5秒不足以完成53筆IDB寫入，後續使用原full runner30秒契約。初次browser找到實際分頁缺陷；另一次工匠fixture僅授予市政廳Lv1，正式UI正確阻擋建堡；最終明確授予Lv5後驗證合法建造。沒有放寬正式資格或測試接受標準。

## 邊界與STOP

- V94§17每城建造／訓練各5筆：規格已核准，但本輪明確禁止修改Formal Scheduler；source容量3，UI如實顯示3，五筆排程實作PENDING。
- V94§16共80項一次性任務：主規格保留，尚非本輪介面實作，PENDING；未修改原三項指引或獎勵。
- B5 E1原HOLD、原M3 Lv15人工情境、實體手機、硬體GPU FPS、已部署舊版SW更新、個別私人晚期save及Day30／168／360／720h維持HOLD／MANUAL PENDING。
- Astra Independent Gate未執行、未宣告PASS。R4原Handoff保持原樣；本PR依賴PR #3先完成獨立審查。沒有開始B9／B10、更新main/release或核准檔，也沒有auto-merge／部署。

提交新Draft PR後STOP，等待使用者與Astra獨立review。若PR #3先合併，先保留checkpoint，再安全整合最新main、回報實際衝突及重跑相關測試；不覆寫R4成果。

首輪完整Regression：1136 PASS／1 FAIL／1 conditional SKIP。唯一失敗為舊update27固定七入口導覽契約；依本輪明確新增軍團要求，將預期擴充為八個固定入口，原七項相對順序、時代入口、選取樣式等檢查均保留。這是新功能的UI驗收契約更新，沒有修改Formal／政治／AI／Recovery規則測試，也沒有放寬timeout或排除任何檔案。原結果保留於attempts。
