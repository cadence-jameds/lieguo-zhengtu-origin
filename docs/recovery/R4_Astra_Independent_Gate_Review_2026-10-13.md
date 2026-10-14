# PR #3｜R4 Astra Independent Gate Review

審查日期：2026-10-13（UTC）。審查角色：使用者指定之獨立 Astra 審查者。模式：唯讀。本文是新一輪 Gate 裁定，不回寫或改稱任何歷史審查結果。

## A. Gate 裁定與精確範圍

**正式 R4／B6～B8 Integration Gate：HOLD。G2 實作驗證：FAIL。B5 E1：HOLD；新增 Chrome 工程證據僅 PARTIAL，不能 CLOSED。目前不建議合併 PR #3，不得據此開始 B9、通過 release acceptance 或部署。**

理由不是 V93/V94 後續需求尚未實作，而是固定 HEAD 可重現兩類 B7 跨系統缺陷：已滅國、仍在交戰的 AI 征服成功會造成世界推進驗證錯誤；工匠所在城失守後仍停留敵城，施工中的外文明城堡還會替敵方完成並消耗原持有者工匠。前者是 Gate BLOCKER，後者是 MAJOR。另原 M3 Lv15 玩家人工證據仍未補足。

兩項程式缺陷存在於 PR base，**不是本 PR 兩處政治 UI 修改引入**。但本輪任務是完整 B6～B8 正式整合 Gate，不能以「非 PR 新增」排除。兩處 UI delta 本身沒有發現新增阻塞缺陷。

| 對象 | 核對結果 |
|---|---|
| Repository／PR | `cadence-jameds/lieguo-zhengtu-origin`／[#3](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/3) |
| 固定 reviewed HEAD | `608de8a77a8644b7a3a894685e27ced9d4507ca0`，分支 `stage2-r4-integration`；本機 detached checkout |
| PR 建立時 base | `d5c0712b2b7ad1cd580999f97918f132d57c8f21` |
| 最新 main | `9cf6369097cc7495c99197b83026b09c447f0f19`；續審時再次核對未變 |
| PR live 狀態 | open、draft=true、merged=false、mergeable=true；無 merge／approve／comment 操作 |
| release | `695afb6e1f29bbaab7694d864449d48dd53f6103`，與原 scope 記錄相同 |
| Authority | 最新 main `docs/b6-v94/河谷戰役_vNext_平衡重構討論_v94.md`；V94 > V93 > V92 > 仍有效歷史 > source |
| 審查工作樹 | 審查前後 `git status --porcelain` 均空；未修改受審 source、spec、evidence、ref 或 acceptance |

### 證據驗證與獨立執行

已讀 R4 Integration Report、Independent Gate Handoff、summary、manifest、scope、全部 regression assertionResults、browser cases／script、controlled chain／persistence、三個 fair seed 報告與失敗嘗試。完整 PR diff 為 58 檔；其中 production application 只變更 `FormalWorldMap.tsx` 與 `FormalTargetPanel.tsx`。巨型 JSON 以本機完整原始檔核對，不因 GitHub patch 省略而跳過。截圖由協作主審抽核政治、帝國、Lv15、final、手機與 PWA 等代表畫面；截圖不當作隱藏 state 的替代證據。

| 證據 | 性質與實際結果 | 能支持的範圍 |
|---|---|---|
| manifest | 主審逐檔驗證 57/57 bytes 與 SHA-256 相符；唯一不列入是 manifest 自身 | 提交材料完整性，不等於行為正確 |
| 原 full regression | 135 檔，1123 PASS／0 FAIL／1 conditional SKIP，384.94 秒 | 既有 assertion 的覆蓋 |
| **本輪獨立 full rerun** | `node scripts/verify-in-isolation.mjs full`，原 maxWorkers=2；135 檔，1123 PASS／0 FAIL／1 SKIP，約 265.78 秒 | 未排除 legacy art，亦涵蓋 AGENTS 所列 smoke 檔；不能涵蓋不存在的邊界測試 |
| 本輪 typecheck／build | Node v24.19.0，`npm ci`、`npm run typecheck`、`npm run build` 成功 | 型別與 production bundle；無 deployment |
| **本輪反例 probes** | 受審 source 的 repo 外副本，362 個 tracked src 檔逐 byte 相同；新增 3 個測試，3/3 成功觀察到缺陷 | 有效 Formal world，正式命令與 scheduler，含 validate／SaveLoad roundtrip；受控 fixture，不是公平新局 |
| 既存 Chromium | `154.0.8037.57`，headless，11 cases PASS，36 次治理套用，26 張 PNG，記錄 errors=[] | 真 Chromium 自動化工程證據；**本輪沒有重新執行 browser script** |
| 三個公平新局 | seeds 12012／92049／90217，各 8 世界小時，100 勢力／99 AI／432 原據點；accepted 590／616／640、rejected=0；皆 100 城、0 軍團、0 帝國、0 戰鬥 | 初期經濟自治與 SaveLoad／切片／offline 等價；不證明成熟政治或戰爭平衡 |
| 受控整合鏈 | 人工設定時代、建築、資源、兵力，延後 AI decision；正式聯軍征服→滅國→流亡→25%→工匠→城堡→復國 | 正式執行路徑，不是無贈送公平自然進程 |
| GitHub Actions | 主審 plugin 與 REST 核對此 HEAD 無 run（total_count=0） | 不得宣稱 GitHub CI 已綠燈 |

原 `attempts/regression-contention.json` 的 1116 PASS／7 FAIL／1 SKIP 仍保留：四個 timeout（1 個 integration、3 個 dense runtime）及三個後續狀態／ack assertion 失敗。相同 source 的 exclusive targeted 68 PASS 與最終 full PASS 可支持「該次資源競爭嘗試未成功、後續獨占重跑成功」；不能刪除失敗或推論所有高負載風險已消失。本輪 full 也成功，無需放寬 timeout 或再跑泛用集合。

## B. G1～G5 驗收矩陣

下列 `formal/`、`presentation/` 與檔名簡寫均相對 `src/game/`（另有明列 docs/scripts 者除外）。source 行號均指固定 reviewed HEAD；V94 行號指最新 main 的完整原文。PASS／已覆核僅限列明的工程範圍，不代表人工作業、長局平衡或發布接受。缺陷與剩餘風險分列於 C。

### G1｜政治、聯防、聯軍、地圖

**裁定：G1 HOLD（與 G2-B1 征服所有權相交）。軍團／帝國／外交與本 PR UI delta 的已測分支 PASS，不能外推完整所有權鏈已通過。**

| 項目與規格 | Source 精確位置 | 驗證／限制 |
|---|---|---|
| 軍團建立、申請、邀請、接受／拒絕、退出；使館與容量；V94 §9.2，3680–3688 | `formal/politics.ts:45–75`，capacity admission 在 62；領主只可控制自城 `formal/reducer.ts:34–45` | `politicsB6.test.ts:14`、`autonomyR2b.test.ts:14–15` 及 full PASS；容量包含團長，未同意不加入，over-cap 停招不自動踢人 |
| 團長／帝國領袖權限、繼任與單人成團；V94 §9.2–9.5 | `politics.ts:25–44,51–52,71–80` | source 有最高使館候選、seeded 並列抽選；`empireDeltaR1.test.ts:23–35` 覆蓋 consent、資格、接班、容量與失效 scope；未宣稱每個並列種子皆人工測過 |
| 帝國成立至少兩團、Lv11、最多三團、加入／解散、2→1→0 | `politics.ts:33–41,64–80` | `empireDeltaR1.test.ts:23–37` 與 `integrationR4.test.ts:54–67,91–95`；join invitation 綁 sourceLegion／originEmpire，不把舊成立邀請默改加入 |
| 友好雙同意、戰爭／中立、六世界小時解除；V94 §9.4，3696–3703 | `politics.ts:21–23,63,81–84`；`reducer.ts:118`；`armies.ts:14–15,34–36` | `politicsB6.test.ts:15–16,23`；`autonomyR2b.test.ts:21`；期間不能用 war/peace 繞過敵對限制，外交不給 buff |
| scope 邀請／工程清理及失效事件 | `politics.ts:35–43,90–96` | `empireDeltaR1.test.ts:28–35`；R4 controlled 最後軍團滅國後 empires／requests／largeProjects=0；既有現代化 project 只作清理 fixture |
| Lv12 警報、Lv13 聯防與留守、原軍費、實際行軍；V94 §9.6–9.7，3713–3731 | `aiKnowledge.ts:15`；`cooperation.ts:13–14`；`armies.ts:16–18`；`military.ts:18`；`battles.ts:35–40,99–104,153` | `politicsB6.test.ts:18`、`autonomyR2b.test.ts:16`；由原 owner 出兵扣兵、keep 留守與真實 route；逐回合到場按 scheduler 加入，不是瞬移 |
| Lv14/15 聯軍承諾、等待、出發、會師、晚到；V94 §9.8，3733–3742 | `cooperation.ts:15–24`；`battles.ts:145–159` | `politicsB6.test.ts:17,21` 與 R4 `integrationR4.test.ts:73–92`；same-time 收齊再結算，late arrival 不提前傳送。大型多線／各種晚到人工矩陣未做 |
| 征服歸屬發起者→最多有效生還兵→並列抽選；V94 §9.9，3744–3752 | `politics.ts:88`；`battles.ts:84–96` | initiator 優先有正式同時空城測試；其餘分支 source 檢查。**死亡勢力資格未排除，與 G2-B1 相交，不能宣稱整個歸屬鏈無缺陷** |
| AI／玩家同命令、政治公開地圖一致 | `aiActions.ts:13–24`；`autonomy.ts:53–54`；`presentation/mapRelations.ts:5,9–11`；`FormalWorldMap.tsx:63,115`；`FormalTargetPanel.tsx:16–28` | `targetPoliticsR4.test.ts:12–23`（777 兵／13337 金不洩漏）、browser 政治case；兩處新增 UI 正確讀正式政治資料，未改投影算法或敵情權限 |

### G2｜滅國、流亡、工匠、外文明城堡

**裁定：FAIL。基本鏈可工作，但有已重現的交戰中滅國與失城工匠缺陷。**

| 項目與規格 | Source 精確位置 | 驗證／風險 |
|---|---|---|
| 城市歸零才滅國、原軍世界化、固定432 slots不被佔；V94 §6.4、§6.6，2773–2812 | `extinction.ts:19–37` | `extinctionB7.test.ts:13–15,19`；R4 `83–103`。母城失守但尚有其他城不提早流亡；獨立 army group 生成獨立 exile |
| 已交戰殘軍完成既有戰鬥後轉流亡，不得 AI 復國；V94 2775–2778、2812 | `extinction.ts:24–35` vs `battles.ts:90–96`、`schema.ts:104` | **BLOCKER B1**：extinctionPending 可跨回合，但勝利仍把城市給 extinct owner，有效存檔再推進會 throw |
| 最後擊破戰前剩餘編成逐兵種 floor25、單工匠、不復生；V94 2814–2831 | `battles.ts:56–60`；`extinction.ts:38–43` | player `extinctionB7.test.ts:16` 與 AI R4 `104–119`；正式結果為 7/11/5→1/2/1。phase gate 防重複、沒有 wild.respawn；未授予新兵種／科技資格 |
| 工匠 carrier、待命、轉移、目的地失守重導；V94 2831–2838 | `extinction.ts:43,47–51`；`battles.ts:148–149`；`schema.ts:104` | 返回 carrier 交付已驗；移動目的地失守有 fallback source。**MAJOR M1**：待命所在城失守沒有 reconcile；在 enemy city 的自家工匠可通過 schema 卻不能合法操作。既有full無 `craftsman.move` 專項 assertion |
| 外文明城堡正常成本／時間、完成才消耗、單城單堡；V94 2835–2847 | `extinction.ts:49,52`；`economy.ts:131–150,156–162` | `extinctionB7.test.ts:17`／R4 `120–130` 基本鏈 PASS。**M1**：所有權變更後特殊工匠施工仍完成並 consume 舊 owner 工匠；取消／轉移細節需按有效規則定義，不能擴大改動所有普通施工 |
| 六文明衛隊按 castle source，使用現領主科技 | `military.ts:32–40`、`combatModifiers.ts:10–20,43–48` 的 owner tech 套用；`extinction.ts:49–52` | 普通／外文明來源由同一 catalog 與 admission 控制；R4 只具體驗中國來源、B7測日本來源；**本輪沒有完成六文明工匠取得→城堡→徵募的完整人工矩陣**，不以素材完整代替行為證據 |
| 玩家復國400人口／住房、600×4、零軍、48h、保留文明時代科技；AI不可復國 | `extinction.ts:44–46`；`armies.ts:41` | `extinctionB7.test.ts:15`／R4 `131–144`／browser rebirth。拒絕 AI `player.rebirth` 有效，**不能因此掩蓋 B1 經勝利征服而復得城的另一條路** |
| SaveLoad／Recovery／工匠和流亡去重 | `extinctionPersistenceB7.test.ts:8`；R4 `151–189`；`persistence.ts:62–107` | 已有 fault／import／Recovery 基本鏈通過；本輪 roundtrip 後反例仍在。歷史 high-water 保留不是逐位元重播，流亡位置可能變，不算本 PR 偷改 |

### G3｜治理、AI 同權與合法情報

**裁定：已測工程範圍 PASS；自然長期自治與政治成熟分布 PENDING。沒有因新任務獎勵例外錯判普通 AI 同權。**

| 項目與規格 | Source 精確位置 | 驗證／限制 |
|---|---|---|
| 市政廳前置、5 方針、自城權限；V94 §4 市政廳、§15.4 B8 | `governance.ts:11–21`；`reducer.ts:40–45,70–73` | `governanceR2c.test.ts:18–21`、presentation governance tests；5 方針均存在，reserve不支出；失城或失前置停總督 |
| 每城每世界小時真支出預算及四資源保留 | `governance.ts:17–27` | `governanceR2c.test.ts:19–22`；同小時重送不清spent，budget sum 真成本，reserve逐resource檢查；不是依高速現實秒刷新 |
| 高倍速原子性與 R3 revision／CAS | `governanceAdmission.ts:6–36`；`runtime.worker.ts:58–71`；`reducer.ts:35–40,83–87`；`persistence.ts:65–78` | 原full涵蓋1/3/6/10/50X admission與IDB；既存browser 1/10/50X×0/100軍、36apply；設定唯一可 bridge且有intent／ABA保護，economic stale仍拒絕 |
| 99人格與錯峰，同命令無補貼；V94 §10.1–10.4，3756–3776 | `autonomy.ts:17–22,25–63`；`aiActions.ts:27–44` | `autonomyR2a`反事實隔離、正常支出、dedupe；full重跑PASS。inactive限制戰爭／拓殖，有既定防守／補給路徑；8h公平新局不證明成熟戰局 |
| 返城取得情報、12/24h老化、未讀隱藏軍隊／資源／科技；V94 §10.3 | `aiKnowledge.ts:13–31`；`battles.ts:72–81,148–149`；`aiActions.ts:35–40` | `autonomyR2b.test.ts:17–19,23`：軍令對敵方隱藏變動不變、scout返城前無intel；unrelated AI report不交付玩家。未宣稱所有未來 B9 情報亦已驗 |
| 科技／建築／人口／四資源前置同權 | `autonomy.ts:25–47,53–54`；`military.ts:32–40`；`economy.ts:131–150`；`reducer.ts:45,51–64,74–80` | AI planner quote後仍由正式admission重驗；無AI免成本入口；跨Faction研究不能因同帝國代付。V93玩家任務獎勵是後續明示例外，未實作不影響本判定 |

### G4｜整合與安全、R3/v91 保留

**裁定：G4 HOLD。持久化／scheduler／UI delta 已測部分 PASS；整體世界可推進性因 B1 FAIL，故不得據此 Gate PASS。**

| 項目與規格 | Source 精確位置 | 驗證／限制 |
|---|---|---|
| Typed ID、event排序／去重、CommandId | `ids.ts:1–37`；`scheduler.ts:3–27`；`reducer.ts:29–45,104–133` | 同時事件按 at／type priority／ID；重复ID拒絕；receipt fingerprint＋revision。全套測試通過，不代表跨domain invariant已完備 |
| IDB World／BattleReports／Recovery同transaction | `persistence.ts:49–107,113–127,153–175` | R4 `151–189` authority-write fault三store回滾；import含reports；Recovery游標清理、durable sequence不降；CLI使用fake-indexeddb，真IDB證據屬既存Chromium |
| offline切片等價 | `offline.ts:8–13`；R4 `192–221`；`governanceR2c.test.ts:22` | 3 seeds 8h direct／hour slices／SaveLoad／offline嚴格比較gameplay（僅正規化revision）與reports。**不能外推含B1交戰滅國世界亦可正常前進** |
| R3全owner行軍／AI雙劍／減動態／load不重播 | `presentation/armyOverlay.ts:8–40`；`FormalWorldMap.tsx:63–70`；`presentation/worldDynamicsR3.test.ts:14–19`；R4 `223–250` | full重跑、既存browser markers/dataset與截圖；100真Formal IDs，不是只畫玩家。沒有本輪真人長時目視或實體GPU FPS |
| v91持續Siege12、唯一final、即時戰況 | `battles.ts:106–139`；`battleProgress.ts:5–18`；`siegeV91.test.ts`／`battleStressV91.test.ts`／`battleView`與相關presentation tests | R4 AI-vs-AI Lv15→Siege11→12→held，final只有1，reload無雙劍/impact；受控高兵力成功征服另有case。兩類情境不得混作原 M3 |
| B9–B11／release／部署邊界 | 完整PR diff；`.github`／package／resolver等guarded 11檔 | 主審hash與base逐byte相同；沒有新B9執行器／release核准／workflow／依賴變更；B9種類僅既有schema及cleanup fixture，不是提前實作 |

### G5｜E1 獨立裁定

**E1 最終狀態：HOLD。Chrome Delta：PARTIAL。不是 CLOSED。**

V94 `5132–5136` 明列：歷史 v0.30.39 HOLD 不變，M3 實測 Lv10→Lv10 不得改寫 Lv15，B6～B8例外施工授權不等於Gate PASS，正式整合Gate前應合理關閉E1。R4 Handoff `20–31` 同樣保留原玩家目視缺口。

| 問題 | 本輪判斷 |
|---|---|
| 原 M3 Lv15人工是否真正補足 | 沒有。`manual-checklist.md:30–38,52–59,91–97` 要求玩家操作及戰報/世界一致觀察；現有browser腳本沒有替原M3補簽人工驗收 |
| Chrome證據是否完全無效 | 有效，但只支持已執行的自動化工程路徑。真瀏覽器並不自動等於真人目視；AI-vs-AI Lv15也不等於指定玩家Lv15操作 |
| v0.30.40終戰UI Delta | 現HEAD之resolver／final／load不重播與相關presentation已有工程覆核；未取得完整指定玩家人工Delta，因此不宣稱歷史UI Gate全部接受 |
| 手機／FPS | 390×844 viewport＋CDP touch為模擬，不是實體手機；`renderMs`、Node elapsed或短RAF不等於硬體GPU FPS |
| 晚期私人存檔 | 未提供 `REALM_REGRESSION_SAVE`，既有1項conditional SKIP仍SKIP，不能用synthetic替代 |
| 長局 | 8h沒有政治／戰鬥成熟；Day30／168h／360h／720h未完成，留後續校準。不將所有B11長測要求任意提前變成本輪新程式BLOCKER |
| PWA | `verify-r4-browser.mjs:133–134` 僅fresh本機SW控制＋network-offline首頁按鈕，不能支持舊部署版本升級或完整離線長局可玩 |

## C. Findings：重現、原因、影響、最小修正

### BLOCKER B1｜已滅國 AI 的既有攻城成功，使有效世界無法繼續推進

- **規格**：V94 `2775–2778`（城市歸零即滅國，AI永久退出）、`2812`（既有戰鬥結算後僅生還部隊轉流亡），另 §9.9所有權規則須在有效勢力範圍使用。
- **Source**：`extinction.ts:24–35` 正確標 `extinctionPending` 並保留engaged；`battles.ts:90–96` 沒有檢查 conquest recipient 已滅國，仍 `finishConquest`；`siege.ts:48–53` 轉移城市；`schema.ts:104` 最後拒絕 extinct擁有城市；`reducer.ts:128–133` 在轉移後才驗證。
- **可重現**：seed90217，受控battlefield。AI faction001從city001向空城city002／Lv15牆，正式派民兵30＋ram5；75,000ms進入Siege。玩家city000派民兵1000正式征服AI最後城city001；265,919ms後AI已列extinct，舊攻城軍仍engaged、pending=true。此時 `validateFormalWorld`、encodeSave、decodeSave全部成功；將讀回世界推進至3,865,919ms，拋 `Extinct faction ownership invalid`。
- **影響**：scheduler不能產生可提交世界。Worker保存前要完成advance，故此分支可能反覆重試而世界卡在同一事件；本輪未用真Chromium重新量測重試畫面，**不宣稱已造成IDB資料毀損**。此為直接程式可用性BLOCKER，不是單純缺人工證據。
- **最小修正**：終戰／征服歸屬需共同驗證勢力仍存活且有合法控制權；extinctionPending不能因勝利復國。保留既有戰鬥算出的傷亡，依規格將生還原軍一次性世界化；聯軍選所有權也必須排除無資格勢力。不能用刪除extinct標記、放寬schema、直接授新城或取消整場歷史傷亡掩蓋。新增該正式交叉事件的回歸，加SaveLoad／切片／Recovery安全性與唯一final／流亡驗證。
- **來源歸屬**：base已有，R4整合待修，非本PR UI引入。

### MAJOR M1｜工匠所在城失守沒有 owner reconciliation，原工匠被留在敵城或替敵方完工消耗

- **規格／驗收要求**：V94 `2831–2838` 工匠owner、在自己城市間轉移及於自有城建堡；handoff `11` 明列失城重路由與失城工程抽查。V94沒有逐字規定所有「進行中施工失城」一律取消，本文不擅自補訂普通施工規則。
- **Source**：`economy.ts:69–70` owner transfer不處理工匠；`extinction.ts:51` 只在移動到站發現目的地失守才fallback；待命／construction-held無對應轉換。`schema.ts:104`只驗city存在，不驗其owner。`economy.ts:156–162`及`extinction.ts:52`依commandId完成城堡並consume工匠，沒有owner匹配。
- **重現（待命）**：seed90217；玩家有city000、city001，正式raid擊破受控日本exile並返城取得工匠。有效world經SaveLoad；AI faction002正式征服city000。結果工匠owner仍faction000、cityId仍city000、eventId=null，但city000 owner=faction002，玩家仍有city001。schema接受；玩家不能對enemy city發command，敵方不能控制原owner工匠，工匠被擱置。
- **重現（施工）**：同前，先正式 `craftsman.castle` 扣正常資源、排完成於2,544,457ms；AI於644,118ms正式攻下city000。工程仍繼續，完成時enemy city取得castle1／civ_japan，原玩家craftsmen變空。沒有非法source修改參與易主／完工；初始贈送與前置均明列fixture。
- **影響**：跨owner消耗特殊資格單位、失去可操作工匠，與宣稱的失城處理不一致；可能讓敵方獲外文明生產資格。尚未直接證明工匠可被複製，不把它誤報為複製漏洞。
- **最小修正**：在正式owner change同一原子transition處理工匠所在城與特殊castle job；工匠不能保留敵城待命引用，完工必須校驗job／craft／city owner關係。若原owner尚存，依已批准失城重路由方向處理可用落點／實際行軍；若滅國，沿既有滅國處置。**特殊工匠工程究竟取消、解除綁定後重導或其他合法處置，需先由有效規則／中控確認**，不在審查中改規格或修改所有一般施工繼承；不得憑空退款。補待命、在途、施工、原owner滅國及同時完成／易主測試。
- **來源歸屬**：base已有；R4整合待修。

### MINOR N1｜R4 交接的 B7 回歸覆蓋描述大於實際 assertion

- **位置**：`R4_Integration_Report.md:21`、`R4_Astra_Independent_Gate_Handoff.md:11`；歷史 `B7_Regression_Evidence_R1.md:7` 亦有同類敘述。
- **重現／原因**：固定HEAD全部 `src/**/*.test*` 搜尋 `craftsman.move`、`extinctionPending` 沒有該行為專項；`extinctionB7.test.ts`只有7項、persistence1項；R4新鏈也沒有交戰中滅國再勝利／待命工匠失城／工匠施工失城。full assertionResults同樣沒有所稱邊界。
- **影響**：讀者可能把「full全綠」誤當這些缺口已覆蓋，這正是B1/M1可逃過既有集合的原因之一。歷史外部ZIP可能曾有其他測試，不在本文未見材料上武斷否認；但它不能冒充當前HEAD完整回歸。
- **最小修正**：以新增append-only delta／更正交接明確列每項測試檔、case、實際證據；保留歷史原結論與失敗材料，不補寫不存在的人工PASS。不需為修文案更改遊戲規則。

### PENDING P1｜E1原M3 Lv15玩家人工未補

- **權威**：V94 `5132–5134`；handoff `20–28`。
- **剩餘工作**：固定新HEAD、真Chrome／玩家依原M3指定情境重新操作並保存初始Lv15、命令、戰中狀態、終報與世界狀態、reload結果；記錄操作者／裝置／時間與實際結果，再由獨立Delta Review裁定。
- **影響**：即使B1/M1修完，E1仍不得由目前材料自動CLOSED；這是既有Gate前置缺口，非新加阻擋條件。歷史Lv10繼續記Lv10。

### PENDING P2｜六文明完整操作、實體手機、效能、SW更新、私人晚期存檔與長局

- **範圍**：六文明工匠→外堡→衛隊人工；實體手機touch／GPU FPS／玩家長時間操作；舊已部署SW→新版保存並更新；私人晚期存檔續進6h；Day30／168／360／720h與成熟政治分布。
- **原因**：本輪沒有提供這些實測材料，既有browser只涵蓋受控自動化與fresh PWA首頁。既有fair 8h戰鬥／政治為零。
- **最小完成方式**：對各項建立真實裝置／存檔／時間／seed記錄並執行對應情境；不改既有conditional skip成PASS。依原階段安排後續長局校準，沒有因它們全部pending而擅自要求提前開發B9–B11。

## D. 可直接交 Codex 的最小 Delta 指令

以下是修正交付建議，不是本審查已執行施工，也不是merge／deployment授權。

> 以 PR #3 reviewed HEAD `608de8a77a8644b7a3a894685e27ced9d4507ca0` 及最新main authority `9cf6369097cc7495c99197b83026b09c447f0f19` 為核對基準，只做 R4 Gate delta。保留歷史SHA、歷史驗收結果與全部原始失敗材料；不要reset、覆蓋舊程式、改數值、放寬驗證或重寫E1。
>
> 1. 修復B1：extinctionPending／extinct勢力完成原有戰鬥時不得取得新城；聯軍winner同樣排除失效owner。戰果、final、原軍生還轉流亡在同一transition完成，避免重複final／exile／軍隊。不准刪extinct標記或放寬schema來讓非法復國通過。
> 2. 修復M1：工匠待命／移動／施工與城市owner change一致；消耗時校驗owner。先核對工匠特殊工程失城處置的既定規則；若取消／重導細節無權威，提交最小明確選項由中控確認，再只實作該特殊分支。不要變更所有普通建築施工的繼承規則或自行新增退款。
> 3. 把附錄反例改成期望合法結果的回歸，加原owner仍有第二城／已滅國、SaveLoad、Recovery、同時事件、唯一final與流亡去重。現有full成功不能代替新分支測試。
> 4. 新增R4 Gate Delta報告，更正所稱B7覆蓋，逐case提供source／evidence；歷史報告保持原樣並用新記錄說明。不得把本審查probe的「成功觀察缺陷」寫作產品PASS。
> 5. 完成新HEAD typecheck、build、原full隔離runner；必要時重跑涉及UI／IDB的真browser針對測試，保留失敗。索引manifest綁定新HEAD／source hashes。
> 6. E1另做原M3 Lv15真人操作與v0.30.40以後UI Delta獨立覆核；仍記錄手機／FPS／長局／私人存檔pending。修完STOP，交獨立re-review；不merge、不approve、不auto-merge、不動release acceptance、不部署、不偷跑B9。
>
> V93 80任務與V94第17章「建築5筆＋軍訓5筆」另案delta，本次不能順手實作。原人口門檻第二平行lane不因排程5筆而改。

## E. 最新 main 可合併性與 V93／V94 影響

**技術上無merge conflict；驗收上暫緩合併。** 主審唯讀 `git merge-tree --write-tree origin/main HEAD` exit0，結果tree `37502df35a81b89b8c19efc4ca92602714a97c69`。沒有修改任何branch或真正merge。合併結果相對main的README／V92／V93／V94無差，相對R4 HEAD的src／public／package／lock／.github無差，會完整保留兩邊內容。

latest main比PR建立base新增 `7e09562`、`ffca378`、`d2ec9c6`、`9cf6369`，僅README、V92標示與新增V93／V94，沒有runtime修改。新版authority可以合入文件，但無衝突不等於Gate接受、GitHub CI通過或release核准。

| 規格增量 | 本輪正確處理 |
|---|---|
| V93第16章80個玩家一次性任務 | 後續實作delta；AI不領是明示例外，不拿它推翻普通成本／兵力／工匠同權。尚未實作本身不阻塞R4 |
| V94第17章兩類排程各5筆 | 後續實作delta；目前source `economy.ts:74,131`／`military.ts:35`仍3筆是已知尚未套用增量，不列R4 blocker |
| V94人口第二平行佇列 | 同城人口里程碑與排程容量不同，後續不能把5筆等同5lane或降低人口門檻 |
| 有效B6／B7／B8核心與E1規定 | 仍適用，B1/M1/E1缺口不能因V94新增功能而跳過或延後假裝PASS |

本輪完成正式獨立審查並得到可重現阻塞項。後續是上述最小Delta與E1補證後re-review；原PR及既有歷史不被改寫。

## 附錄：可複製反例與證據解讀

以下程式只應放在**repo外一次性副本** `src/game/formal/astraGateProbe.test.ts`，使用固定HEAD原source與其test helpers。依赖 `public/version.json` 也要複製，node_modules可連結現有依赖。`battlefield()` 是 seed90217受控fixture，明確贈資源、建築／兵力；工匠據點以正式 `createExile` 建立測試前置，工匠取得則正式raid＋返城。此不是一般新局／自然AI決策證據。

執行：`node node_modules/vitest/vitest.mjs run src/game/formal/astraGateProbe.test.ts --maxWorkers=1 --reporter=verbose`。

注意斷言是在**確認缺陷存在**，所以3 PASS表示三個反例確立，不表示產品規則PASS。最終版本加入validate／encodeSave／decodeSave後仍3/3。最初一次探針因漏複製`public/version.json`未載入，另一次使用toBe檢查validator回傳clone而失敗；修正的都是repo外測試環境／探針，沒有改受審source。初步失敗與第一輪成功原始log保留，最終結論取roundtrip版。

```typescript
import {it,expect} from 'vitest';

import {battlefield,issue,arrive,dispatch} from './combatTestSupport';

import {build} from './developmentTestSupport';

import {advanceFormal} from './reducer';

import {createExile} from './extinction';

import {changeCityOwner} from './economy';

import {isMissionArmy} from './combatModel';

import {validateFormalWorld} from './schema';

import {encodeSave,decodeSave} from './saveCodec';

function craftWorld(){let w=battlefield();
changeCityOwner(w,w.cities[1],w.playerFactionId,'receive');
w.factions[0].age=2;
for(const key of ['center','townhall','academy'])build(w.cities[0],key,5);
createExile(w,w.factions.find(f=>f.civilizationId==='civ_japan')!.id,{scout:4},[],w.cities[1]);
w.cities[0].military!.units={militia:100};
w=issue(w,{type:'army.dispatch',cityId:w.cities[0].id,mission:'raid',target:{kind:'wild',siteId:w.extinction!.sites[0].id,generation:0},units:{militia:100}}).world;
w=arrive(w).world;
w=advanceFormal(w,w.armies.filter(isMissionArmy)[0].arrivalAt).world;
w.cities[0].military!.units={};
w.cities[2].military!.units={militia:1000};
return w;
}
it('probe idle craftsman capture',async()=>{let w=craftWorld();
w=(await decodeSave(await encodeSave(validateFormalWorld(w)))).world;
w=dispatch(w,'conquest',{militia:1000},2,0).world;
w=arrive(w).world;
const craft=w.extinction!.craftsmen[0];
console.log('IDLE_CAPTURE',JSON.stringify({craft,cityOwner:w.cities[0].ownerFactionId,remainingOwn:w.cities.filter(c=>c.ownerFactionId===w.playerFactionId).map(c=>c.id)}));
expect(w.cities[0].ownerFactionId).toBe(w.factions[2].id);
expect(craft.cityId).toBe(w.cities[0].id);
expect(craft.ownerFactionId).toBe(w.playerFactionId);
expect(validateFormalWorld(w)).toEqual(w);
});

it('probe construction craftsman capture',async()=>{let w=craftWorld();
w=(await decodeSave(await encodeSave(validateFormalWorld(w)))).world;
const craft=w.extinction!.craftsmen[0];
w=issue(w,{type:'craftsman.castle',cityId:w.cities[0].id,craftsmanId:craft.id}).world;
const job=w.cities[0].economy!.construction[0];
w=dispatch(w,'conquest',{militia:1000},2,0).world;
w=arrive(w).world;
console.log('CASTLE_CAPTURE',JSON.stringify({time:w.time,completion:job.startsAt+job.durationMs,cityOwner:w.cities[0].ownerFactionId,craft:w.extinction!.craftsmen[0],jobs:w.cities[0].economy!.construction}));
w=advanceFormal(w,job.startsAt+job.durationMs).world;
console.log('ENEMY_COMPLETED_CASTLE',JSON.stringify({cityOwner:w.cities[0].ownerFactionId,castle:w.cities[0].buildings.castle,source:w.cities[0].castleCivilizationId,craftsmen:w.extinction!.craftsmen}));
expect(w.cities[0].ownerFactionId).toBe(w.factions[2].id);
expect(w.cities[0].buildings.castle).toBe(1);
expect(w.extinction!.craftsmen).toHaveLength(0);
});

it('probe extinct engaged AI conquers after last-city loss',async()=>{let w=battlefield();
w.cities[1].military!.units={militia:30,ram:5};
w.cities[2].military!.units={};
w.cities[2].wallLevel=15;
w=dispatch(w,'conquest',{militia:30,ram:5},1,2).world;
w=arrive(w).world;
console.log('ENGAGED_START',JSON.stringify({time:w.time,battles:w.combat!.battles.map(b=>({id:b.id,next:b.nextRoundAt,wall:w.cities[2].wallLevel}))}));
w.cities[0].military!.units={militia:1000};
w=dispatch(w,'conquest',{militia:1000},0,1).world;
const arrival=w.armies.filter(isMissionArmy).find(a=>a.ownerFactionId===w.playerFactionId)!.arrivalAt;
w=advanceFormal(w,arrival).world;
console.log('ENGAGED_EXTINCT',JSON.stringify({time:w.time,extinct:w.extinction!.extinct,battles:w.combat!.battles.map(b=>({id:b.id,next:b.nextRoundAt,wall:w.cities[2].wallLevel})),armies:w.armies.map(a=>({owner:a.ownerFactionId,status:a.status,pending:(a as any).extinctionPending}))}));
expect(w.extinction!.extinct).toContain(w.factions[1].id);
w=(await decodeSave(await encodeSave(validateFormalWorld(w)))).world;
console.log('LOADED_EXTINCT_VALID',true);
let failure='';
try{advanceFormal(w,w.time+3600000);
}catch(e){failure=String(e)}console.log('ENGAGED_FAILURE',failure);
expect(failure).toContain('Extinct faction ownership invalid');
});


```

最終重現摘要：

```text
IDLE_CAPTURE: craftsman.owner=faction000; craftsman.city=city000; city000.owner=faction002; remainingOwn=[city001]
CASTLE_CAPTURE: worldTime=644118; completion=2544457; city000.owner=faction002; craftsman.owner=faction000
ENEMY_COMPLETED_CASTLE: city000.owner=faction002; castle=1; source=civ_japan; craftsmen=[]
ENGAGED_EXTINCT: time=265919; extinct=[faction001]; army.status=engaged; extinctionPending=true
LOADED_EXTINCT_VALID true
ENGAGED_FAILURE: Extinct faction ownership invalid
Test Files 1 passed; Tests 3 passed (3); duration 2.12s
```

本輪持續保留的可查核原始材料：`astra-full-run.txt`、`review-repo/artifacts/integration/regression-full.json`、`astra-probe-results.txt`、`astra-probe-first-success.txt`、`astra-probe-initial-attempt.txt`、repo外`astra-probes/src/game/formal/astraGateProbe.test.ts`與主審`root-remote-audit.json`。本文已內嵌反例及關鍵結果，離開該暫存環境仍可依固定commit重現；沒有把未提供的私人存檔保存或上傳。
