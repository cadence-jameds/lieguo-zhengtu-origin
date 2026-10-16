# Stage 2 R4 完整整合驗證

狀態：R4 工程驗證交付，STOP，等待 Astra Independent Gate Review。B5 E1 仍 HOLD；Astra Gate NOT DECLARED PASS。B9／B10 NOT STARTED。沒有更新 release、發布核准紀錄、Sites 或觸發 Pages 部署。

最終完整Regression：**135 files／1123 PASS／0 FAIL／1既有conditional SKIP**；原隔離runner、原maxWorkers=2，384.94秒。Typecheck／production build PASS。真Chromium **11組PASS、36次治理套用、26張截圖、0 console/pageerror/HTTP/request錯誤**。完整原始報告、失敗嘗試與SHA256 manifest一併提交。

## 基準與授權

2026-10-13（Asia/Taipei）由玩家明確授權開始 R4，以 GitHub 最新 main `d5c0712b2b7ad1cd580999f97918f132d57c8f21` 為基準，開發分支 `stage2-r4-integration`。版本保留 v0.30.49。R3 Browser Delta `d7ceb4df97bdc9ebb58241285132c02ada7081f0` 是此基準的祖先；沒有重做 R0～R3 階段。

環境預載 HEAD 為 `273d4c6`。透過授權 GitHub 連接器補讀兩個 README 提交，逐一重建原始 Git object 並驗證完全相同的 SHA；最新 tree 是 `fa4350f5104f5d04b68ffee463bcb9c96c44c3af`。未改寫任何歷史。v92 SHA256 仍為 `2bb36aed23595b52b38e15ab5c76be883ec854c57517eaf61187af1f2c43e0e6`。

main 已包含 PR #1 的 Lv10 美術測試修正，因此 R3 當時的三項 legacy art failure 屬歷史結果，不能當成本輪仍然失敗，也不能刪改原紀錄。本輪使用完整 regression，沒有使用排除 legacy art 的 `r3` 模式。

## 整合覆蓋

| 範圍 | R4 驗證及證據 |
|---|---|
| B6 軍團、帝國、外交 | `politicsB6`、`politicsPersistenceB6`、`empireDeltaR1`、`autonomyR2b` 納入完整回歸；同意、容量、使館資格、友好六小時、繼任、2→1→0、scope-bound invitation、工程清理、拒絕與 dedupe 均保留。新增跨階段測試由聯軍正式征服觸發最後軍團滅國，檢查零帝國、失效邀請及工程立即清理。 |
| B6 聯防／聯軍 | 同命令、實際留守、原付款與軍費所有权、等待／出發／會師、同一 resolver／BattleId／唯一 final。受控跨階段情境各參戰城立即扣 1000 民兵，保留 1000 留守，實際攻下 Lv15 城。 |
| B7 滅國／流亡／工匠／城堡／復國 | 玩家最後城市正式失守，治理停止；混編在途軍轉獨立流亡據點，432 原野外 slot 不減少。AI 使用正式 raid 擊破，`floor(7×.25)=1`、`floor(11×.25)=2`、`floor(5×.25)=1` 回收，僅一工匠；返城後正常付款／排程完成外文明城堡才消耗工匠，再正常徵募來源文明衛隊，不繼承科技、不授予 modern qualification。AI 復國拒絕；玩家三候選復國，人口／住房400、軍隊0、四資源各600、保留文明時代科技、48世界小時保護、同命令重播不重複。另完整回歸涵蓋工匠移轉／失城重路由及 engaged extinctionPending。 |
| B8 99 AI／治理／合法情報／經濟／戰鬥 | `autonomyR2a/R2b`、`autonomyRuntimeR2c`、`governanceR2c`、governance admission 及 persistence/runtime 均納入。涵蓋99連續人格／錯峰、正常成本佇列、inactive限制、每城每小時真支出預算／保留量、不藉重送設定重置spent、返城才交付情報、12h/24h老化、隱藏軍隊資源科技的反事實隔離、AI vs AI記憶／戰報權限及原子revision。沒有提前實作 B9 兵種／認知／逆向工程／奇觀。 |
| R3 行軍／雙劍／Browser Delta | 完整回歸含全100 Formal ArmyId渲染、實際路徑方向／連續位置、cache/culling、civilian route、Raid terminal effect、reduced-motion與載入不重播。Chromium 驗證100軍行軍、AI vs AI Lv15攻城標記、11→12回合final後移除、載入final無雙劍／衝擊；治理1/10/50X×低密度/100軍共36次套用及duplicate/stale/economic guards。 |
| Save／Load／IndexedDB／Recovery／離線 | 新串接測試在 joint／帝國／治理尚存在的 checkpoint 後推進至滅國，注入 authority-write failure，三個store全部回滾；正常retry／完整import／Recovery保留生命週期，沒有 ghost report、重複final或免費回復。真瀏覽器另外驗證完整匯出、重載、Recovery、損壞checksum拒絕。 |

新增 R4 測試位於 `src/game/formal/integrationR4.test.ts`（6 cases，含3個seed）及 `src/game/presentation/targetPoliticsR4.test.tsx`（2 cases）。完整 assertionResults、實際統計與日誌见 [R4 evidence](../validation/r4-2026-10-13/)。

Recovery 會保留 durable event/report/project sequence 高水位，因此 checkpoint 之後新分配的 EventId／流亡據點ID會改變；目前流亡位置的seed也讀project sequence，位置可改變。本輪記錄這個既有契約，驗證正式戰果、組織清理、兵力、BattleId／ResolutionId唯一性及未退回序號，不把 Recovery 宣稱為整個世界逐位元重播。正常 Save/Load、直接／分段／離線推進則嚴格驗證相同 gameplay 與 reports（只正規化revision）。交 Astra 抽查此語義；沒有為綠燈改動 durable ID 或流亡規則。

## 100勢力模擬的實際邊界

使用正常 `createFormalWorld`，384×384、100勢力、99 AI、432野外據點，沒有贈兵、贈建築或隱藏加成。seeds `12012 / 92049 / 90217` 各跑 **8世界小時**，同時核對 Save/Load、每小時切片及離線等價。正式接受命令分別590／616／640，拒絕0；各仍100城、0軍團、0帝國、0戰鬥結算。這是早期經濟自治觀測，沒有宣稱自然政治分布或自然軍事成熟。

軍事／政治／滅國鏈使用明確標示的 controlled fixture，包含兵力、資源、建築／時代設定與延後AI決策；所有結果仍由正式命令與scheduler算出。不得把受控情境當公平新局，不把Node elapsed時間當GPU FPS，也不把8h當Day30／168／360／720h校準。長期校準及實機效能仍 MANUAL PENDING。

## 限定修復

1. 有正式帝國時，「帝國版圖」仍顯示政治帝國尚未開放。真Chromium修復前截图 `empire-before.png`；修復後顯示正式帝國名稱及軍團數，既有 `politicalCells`／版圖算法不變。
2. 地圖城市資訊固定顯示「軍團尚未開放」，把已有帝國顯示成泛稱「同盟帝國」，且所有非友好目標皆標中立。真Chromium修復前 `target-politics-before.png`；現在讀相同正式 `legionOf / empireOf / diplomaticRelation`，顯示實際公開名稱及己方／友好／戰爭／中立。援軍／敵對資格仍讀原命令規則，未變更情報權限；新增測試確認不能讀出敵方777兵或13337金。

僅兩個presentation檔變更；戰鬥／經濟／外交resolver、AI策略、成本、人口、時間、Siege12、現代資格、v92原文、版本、依賴、release核准與workflow皆保持基準。範圍稽核见 `scope.json`，585份歷史docs逐檔維持。

## 重現與證據誠實性

Node >=22.13、`npm ci`；本次實際 Node24.19.0、Chromium154.0.8037.57。必須先stage新增測試（隔離runner以git ls-files複製），然後：

```sh
npm run typecheck
R4_EVIDENCE_DIR=/absolute/scratch/r4-fixtures node scripts/verify-in-isolation.mjs full
npm run build
```

真瀏覽器腳本 `scripts/verify-r4-browser.mjs` 使用workspace外安裝的Playwright、`/usr/bin/chromium`、local Vite dev :5174及production preview :4173；fixture generator只在dev origin，檢查在production origin，fresh context預設block SW避免舊資源混入，PWA檢查另開allow SW context。截圖、runtime acknowledgements、map dataset及IndexedDB觀測保留；不提交私人存檔、node_modules、dist、artifacts、raw traces或封裝archive。

初次 browser script 的兩項失敗是：即時scheduler合法推進被誤當成duplicate修改全部governor欄位；首頁續接按鈕實際為「載入進度」。後續Recovery腳本也必須選在新命令以前的checkpoint，不能在autosave已推進覆寫兩份backup後仍假定必有rolled-back。修正自有驗證腳本並保留原失敗JSON；沒有修改遊戲的admission／Recovery／測試基準來獲取綠燈。中間因新發現UI缺陷而被取代的full runs不計PASS；只採最終source完整run。

正式測試結果以 `summary.json / regression-full.json / browser.json` 為準。即使全部自動項目通過，也不能等同 Astra Gate 或 E1人工核准。

完整集合保留既有一項conditional SKIP：`batch210.test.tsx` 的個別使用者晚期存檔再推進6h，需要外部 `REALM_REGRESSION_SAVE`，本輪沒有提供私人存檔。它不是本輪新增skip；对应個別存檔驗收 MANUAL PENDING，不拿synthetic save替代或無條件標PASS。

最終source首次完整run與Chromium／build同時執行時，實際為1116 PASS／7 FAIL／1 SKIP，已保留在 `attempts/regression-contention.json`。一項8h測試超過原120秒，三項dense Worker測試超過原20秒，之後同檔有三項非預期state／ack失敗。停止其他重負載後，原兩個測試檔在相同source／斷言／逾時下独占隔離重跑，**68 PASS／0 FAIL**（integration96.6秒、runtime34.7秒）。完整集合再以原runner、原maxWorkers=2重跑；沒有為這次失敗改source、放寬timeout或排除測試。失敗與重跑兩份原始報告都保留供Astra判断。

## 停止與交接

见 [Astra Independent Gate Handoff](R4_Astra_Independent_Gate_Handoff.md)。本輪建立PR供獨立審查，不merge、不啟用auto-merge、不更新release、不觸發Pages。review前保留B5 E1 HOLD，實體手機／硬體GPU效能／舊版本SW更新／完整人工驗收及長期校準 MANUAL PENDING。
