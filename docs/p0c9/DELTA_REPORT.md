# P0-C-9｜正式 Runtime Candidate Delta Report

狀態：**Implementation Candidate Ready for Review**；**效能相容性HOLD，待獨立複驗**。僅供中控獨立審查；不是正式 Gate PASS。main、Pages、Issue 狀態及歷史驗收紀錄未變更。

## 來源與 Authority

- main baseline：`06c4cb93779f1f679bb77470515fd8aee1c42de9`；提交證據前再次從 GitHub 讀取，仍為同一 SHA。
- 施工分支：`feat/p0-c-9-five-strategy-ai-20261019`，從 main 建立。最終交付 SHA 以 Draft PR 的 head 及 PR Body 為準。
- 研究：`fa038a00d3aa5a500cb055176164a907495b6212`，[研究 Actions](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/39181291329)。研究檔案沒有併入正式 Runtime。
- 功能 checkpoint：`33b7452a3ac6aedba89e5b80c2261e9c24bc5aa7`；完整證據／CI checkpoint：`28edce40c45b741c7b1ab62d4f7b3ac5b4a13cb0`。兩者 production 程式相同，後續僅補測試工具、文件與證據。三個正式變更檔案的 SHA256 見 [runtime-source-hashes.json](evidence/runtime-source-hashes.json)。
- 優先順序：本輪玩家正式施工令與核准 Candidate 數值、v94 §10.4／§10.4.1、相關有效規格、main。Issue #14 的其他項目不在本輪施工範圍。

| Authority | 正式對應與證據 |
|---|---|
| v94 §10.4 活躍與反應 | 原活動、軍事啟動 offset311、冷卻、來襲守備、召回／援軍／聯軍先行；未變更活動頻率或事件時序 |
| v94 §10.4.1 有敵城仍能打野 | 五策略每次重抽；原 A48 城市優先保留，其餘四策略允許比較野外；before main FAIL／after Candidate PASS |
| v94 §10.3 資訊限制 | 候選只讀公開 site metadata、合法 acquired city intel；隱藏敵方兵力／庫存變動不影響候選的回歸 |
| v94 §10.4.1 玩法同權 | 原 Reducer／Routing／Combat／返城容量／wild respawn；普通野外、流亡、城市任務分開計數 |
| v94 §10.4.1 效能與公平 | Spatial 查半徑內 site，排序最多8個候選；選中策略才評分；保留99 AI原排程、玩家優先及CAS |
| 本輪五策略／公式授權 | [IMPLEMENTATION_MATRIX.md](IMPLEMENTATION_MATRIX.md) 列完整權重、半徑、門檻、距離分母與 safety delta |

## Runtime 改動與研究 Delta

`aiActions.militaryDecision` 呼叫獨立 `aiAttackStrategies`；`autonomy.submitAutonomous` 逐筆核對 live troop ledger、守軍底線及同城外軍上限，再交原 Reducer。第一筆成功、第二筆失敗沿用既有逐命令原子性；不創造額外交易。不新增存檔策略欄位，五種策略均有正權重，每次符合原條件時只抽一次。

研究公式、48／60搜尋半徑、24距離分母、clamp、偵察保護與原城市優先完全保留。正式安全增補為：核對所有兵種 union（含未出現在野外分隊的斥候／攻城器）、每筆讀取實際餘額、effective combat troops逐種保留至少30%、同城最多3軍、既有CommandId先走原Reducer去重、僅實際新建本勢力軍隊才更新軍事冷卻。收斂研究 wrapper 重複讀取 stateless military RNG 為原入口單次檢查；研究新候選同分ID排序改為明確字串比較，原A48 stable排序不改。

未變更 Schema、11 traits、Scheduler、SaveCodec、Persistence、軍事成本、行軍速度、戰鬥倍率、資源產量或其他 P0-C 系統。沒有把研究 wrapper／Vitest mock 帶進正式執行路徑。

### 距離實際探針

[score-audit.json](evidence/score-audit.json) 以編譯後**原評分表達式**加觀察 tap；固定 seed90217、原性格、單個Lv1 site、1000民兵、零庫存。此為明確受控、縮減的 decision-only 探針，沒有送單／存檔，不是自然世界平衡結果。完整1／24／25／48／49／60／61格原始值已保存。

| 模式 | 25格 | 48格 | 49格 | 60格 |
|---|---:|---:|---:|---:|
| A48 | 進入最近候選 | 進入最近候選 | 排除 | 排除 |
| V2B48 | 0.6265 | 0.3390 | 排除 | 排除 |
| V3Parallel48 | 72.17655 | 72.17655 | 排除 | 排除 |
| WildPriority60 | 72.20684 | 72.20684 | 72.20684 | 72.20684 |
| WildParallel48 | 72.20684 | 72.20684 | 排除 | 排除 |

V2距離項不clamp，因此25–48格分數下降；其餘三個評分模式距離項在24格後clamp為0，仍能進入選擇。本探針完整已計分距離的實測範圍：V2B48 0.3390–0.9265；V3Parallel48 72.17655–86.55155；WildPriority60／WildParallel48 72.20684–91.37351。理論包絡與探針實測範圍分開記錄，沒有將分母改成48／60。

## 35組自然世界矩陣

[實際 GitHub Actions](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/39187161204)：**35／35案例成功**。168h、360h各兩seed90217／104729；720h為90217；各七模式。所有案例起始100城市、99AI、人口每城200、原資源／建築、零軍隊，沒有注入部隊、情報、資源或改變AI活動／出征機率。

測試直接編譯正式 Runtime；只在 disposable JS 放入統計 wrapper。單策略／equal比較只替換純selector policy，traits為正式預設。每組 raw JSON 內包含head、sourceTreeHash、compiledTraceHash、觀察邊界與無world mutation聲明。[未加wrapper的168h世界](evidence/observation-equivalence.json) 與CI traits世界在統一offlineHours設定後canonical hash完全相同。此單點等價證據不替代其他組的逐案統計。

每個原始結果：[matrix/](evidence/matrix/)，檔名 `<seed>-<hours>-<policy>.json` 及逐小時 `.csv`；全部來源head為28edce4，sourceTreeHash為`a72996b07477ea37bcd20cb4b1f5afe879320cab85ff2a0e41c6d64c3ccee2b5`。彙總另見 [summary.csv](evidence/summary.csv)、[策略次數與比例](evidence/strategy-selections.csv)、[主要性格分布](evidence/personality-selections.csv)、[拒絕原因](evidence/rejection-reasons.csv)、[run／job／artifact對照](evidence/ci-runs.json)。沒有混入玩家戰果；所有案例流亡出征／擊破均為0，未將其算成普通野外。

表中「偵察」為成功提交任務，「城掠」為已結算城市raid（不等於必勝），「征服」為成功征服；未完成戰鬥／返城可能留在世界內。「實際入庫」為返城`addStock`前後差值；cargo為攜回量，受容量影響可能不能全部入庫。資源四項相加僅供對照，並非市場價值模型。RSS／耗時是獨立CI VM上的Node量測，未宣稱手機效能。

| seed | h | 策略 | 野外出征／擊破 | 實際入庫／cargo | 偵察 | 城掠／征服 | 雙線 | 拒絕 | 存活 AI | 秒／事件 | peak RSS MiB |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 90217 | 168 | A48 | 19／19 | 10940／12410 | 944 | 300／25 | 0 | 0 | 79 | 28.137／55919 | 284.52 |
| 90217 | 168 | V2B48 | 110／107 | 80910／81710 | 950 | 294／23 | 0 | 0 | 79 | 41.388／56637 | 274.5 |
| 90217 | 168 | V3Parallel48 | 73／72 | 53110／53780 | 957 | 285／25 | 34 | 0 | 79 | 38.931／55926 | 279.64 |
| 90217 | 168 | WildPriority60 | 43／42 | 32310／32980 | 951 | 276／24 | 0 | 0 | 79 | 20.951／55976 | 285.53 |
| 90217 | 168 | WildParallel48 | 47／46 | 37940／38610 | 944 | 296／25 | 37 | 0 | 79 | 22.357／55982 | 457.76 |
| 90217 | 168 | equal | 72／71 | 52891／54015 | 953 | 304／25 | 23 | 0 | 81 | 22.297／56333 | 312.19 |
| 90217 | 168 | traits | 74／73 | 55970／57860 | 952 | 325／25 | 29 | 0 | 81 | 21.73／56513 | 394.22 |
| 104729 | 168 | A48 | 7／7 | 5670／5670 | 966 | 281／24 | 0 | 0 | 77 | 32.942／55851 | 682.62 |
| 104729 | 168 | V2B48 | 93／93 | 67920／67920 | 990 | 267／22 | 0 | 0 | 79 | 29.505／56557 | 383.46 |
| 104729 | 168 | V3Parallel48 | 84／84 | 66710／66710 | 982 | 272／23 | 52 | 0 | 77 | 36.84／56564 | 433.56 |
| 104729 | 168 | WildPriority60 | 35／35 | 29470／29470 | 971 | 282／24 | 0 | 0 | 78 | 35.807／56054 | 493.61 |
| 104729 | 168 | WildParallel48 | 55／55 | 44800／44800 | 966 | 279／24 | 42 | 0 | 77 | 35.341／56080 | 277.43 |
| 104729 | 168 | equal | 66／66 | 51875／52675 | 967 | 274／23 | 25 | 0 | 78 | 36.791／56210 | 392.3 |
| 104729 | 168 | traits | 69／67 | 51260／52060 | 972 | 270／23 | 25 | 0 | 77 | 22.234／56103 | 385.23 |
| 90217 | 360 | A48 | 180／180 | 369286／413070 | 2160 | 826／65 | 0 | 16 | 57 | 69.728／126891 | 403.3 |
| 90217 | 360 | V2B48 | 385／383 | 649460／727265 | 2242 | 767／68 | 0 | 6 | 57 | 121.928／129041 | 451.16 |
| 90217 | 360 | V3Parallel48 | 370／368 | 732147／757080 | 2234 | 835／69 | 150 | 22 | 54 | 112.514／128801 | 415.75 |
| 90217 | 360 | WildPriority60 | 297／293 | 581151／596185 | 2169 | 761／65 | 0 | 19 | 57 | 120.207／126930 | 410.8 |
| 90217 | 360 | WildParallel48 | 297／294 | 623606／648070 | 2152 | 809／72 | 118 | 29 | 55 | 121.978／127091 | 491.23 |
| 90217 | 360 | equal | 360／359 | 624088／653560 | 2216 | 832／65 | 89 | 4 | 55 | 122.185／130471 | 422.32 |
| 90217 | 360 | traits | 387／385 | 811255／846640 | 2224 | 828／67 | 97 | 23 | 57 | 77.191／129342 | 407.04 |
| 104729 | 360 | A48 | 63／63 | 97416／111652 | 2465 | 925／75 | 0 | 0 | 55 | 83.686／125008 | 460.68 |
| 104729 | 360 | V2B48 | 373／371 | 640389／694055 | 2374 | 893／82 | 0 | 7 | 49 | 76.935／130401 | 425.6 |
| 104729 | 360 | V3Parallel48 | 387／385 | 793132／814100 | 2340 | 905／75 | 234 | 29 | 54 | 72.056／128167 | 452.8 |
| 104729 | 360 | WildPriority60 | 214／213 | 319455／327325 | 2496 | 837／66 | 0 | 1 | 59 | 113.026／126096 | 459.92 |
| 104729 | 360 | WildParallel48 | 248／246 | 459108／465220 | 2453 | 889／78 | 174 | 6 | 52 | 115.139／125791 | 444.21 |
| 104729 | 360 | equal | 318／317 | 517416／542967 | 2390 | 880／72 | 114 | 4 | 55 | 73.035／127343 | 422.35 |
| 104729 | 360 | traits | 364／362 | 669916／703319 | 2379 | 888／68 | 131 | 3 | 56 | 119.155／127639 | 431.35 |
| 90217 | 720 | A48 | 1426／1387 | 4952756／8360344 | 3375 | 1504／108 | 0 | 243 | 42 | 367.421／356153 | 699.69 |
| 90217 | 720 | V2B48 | 1917／1870 | 6485913／11342076 | 2713 | 1179／107 | 0 | 237 | 41 | 473.512／359469 | 666.94 |
| 90217 | 720 | V3Parallel48 | 1582／1565 | 5865555／8850193 | 2955 | 1353／99 | 271 | 127 | 41 | 345.051／356534 | 683.63 |
| 90217 | 720 | WildPriority60 | 1373／1356 | 4933799／7510060 | 3153 | 1180／102 | 0 | 249 | 40 | 257.703／348043 | 779.62 |
| 90217 | 720 | WildParallel48 | 1463／1449 | 5555727／8321911 | 2975 | 1270／112 | 186 | 205 | 41 | 457.779／353662 | 637.9 |
| 90217 | 720 | equal | 1704／1685 | 6074400／9880200 | 2923 | 1241／107 | 139 | 152 | 39 | 428.298／358846 | 730.66 |
| 90217 | 720 | traits | 1682／1658 | 6093678／9751147 | 3042 | 1281／108 | 151 | 159 | 37 | 462.554／354960 | 709.95 |


### 168h研究核對與收益限制

兩seed的五種既有研究模式（共10組），野外擊破、返城cargo、城市掠奪、成功征服、雙線及decision數逐組完全一致，見 [research-comparison.json](evidence/research-comparison.json)。另兩種單策略為正式本輪新增對照。

性格加權合計：野外擊破140、cargo109920、**實際入庫107230**、城掠595、征服48、雙線54、拒絕0。研究的109920是返城cargo，不能當成容量扣除後收入。A48合計擊破26、cargo18080、實際入庫16610。

720h traits：擊破1658、實際野外入庫6093678、cargo9751147；普通野外戰損32344單位，catalog等值重招成本合計6415640，兩者差額**-321962**。這是四資源數量相加的成本估計，非實際招募支出／遊戲淨利。168h兩seed差額分別40330／37100、360h為603395／524476；長期收益不能以早期正差額推定。保留此平衡審查風險，不擅改核准數值。逐兵種傷亡與四資源成本保留於每組JSON。

### 指令拒絕、多線與世界狀態

168h所有模式均0拒絕；360h及720h出現正常Reducer拒絕，詳見原文原因CSV，不能沿用研究168h的0拒絕敘述。720h traits159筆：勢力授權152、同類政治請求6、聯軍資格1；A48亦有243筆。其他模式另有路徑、政治／軍團／外交及容量等拒絕。未繞過拒絕條件；自然矩陣preflight拒絕皆0，受控測試另驗證兵力／守軍／容量不符的防護。

35組同城外軍最多3；所有有雙線案例最低逐種effective combat garrison比例≥1/3，高於30%底線，自然長測出現17輪partialParallel（360h三輪、720h十四輪），均為保留首筆已受理命令的既有逐筆原子性；各案例計畫輪數等於完整雙線加部分成功輪數；沒有雙線的案例守軍欄位記N/A。partial失敗另由定向真Reducer案例核對扣兵、軍隊、拒絕及Schema，不只依賴parallelOrders統計。99個AI records保留；存活AI隨征服減少（不將records誤當存活數）。完整人口、城市、駐軍／在外有效兵、外軍數、事件、heap、RSS及maxRSS見JSON與summary.csv；全組最高maxRSS826.41MiB，不能轉稱Android記憶體。

## 定向、完整回歸與原生瀏覽器

- **負向回歸**：Schema合法、原seed traits的「附近有敵城、24外野外」fixture，main06c4為0PASS／1FAIL，Candidate為1PASS；[before](evidence/before-valid-main.json)／[after](evidence/after-valid-candidate.json)。原野外清除透過真lifecycle事件並保留完整432slot世界。
- **定向59PASS／0FAIL／0SKIP**：[最終定向原始報告](evidence/targeted-final.json)（[前次59PASS](evidence/targeted-candidate.json)亦保留）。含42個新增策略／安全／save測試及17個既有AI回歸；五模式邊界、exactweights、determinism、偵察保護、intel隱私、兩筆真正Reducer受理、stale target、首筆失敗、兵力不足、守軍不足、duplicate、活動／冷卻。
- **SaveLoad／Offline／Replay／Recovery／CAS**：三速度同一seed的完整／切片／cooperative／離線推進保持一致；比較切片時只正規化API batching產生的revision與receipt committedRevision。真AI event送出兩軍後以原Persistence保存、競爭writer被CAS拒絕、restore回滾兩軍與receipt，再encode/decode驗證。沒有放寬Persistence必須每次revision+1的規則。
- **六個受控實際引擎情境PASS**：[scenarios.json](evidence/scenarios.json)。有敵城／無敵城、糧食不足保留原city gate、據點等級超過public force heuristic、來襲危機、同勢力多城分離兵力帳。使用真militaryDecision／Reducer／Schema；明確注入部隊、情報、位置、庫存或ownership等前提，與自然長測數字分開。
- **完整正式回歸1409PASS／0FAIL／1既有SKIP**：[CI checkpoint28](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/39187161071)／[摘錄](evidence/full-regression.json)。原`node scripts/verify-in-isolation.mjs full`、原25分鐘上限、未刪測試或改SKIP。Typecheck、Production Build、Pages paths／PWA／SW及release identity檢查同run成功。[功能checkpoint33 CI](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/39186001220)亦相同通過數。
- **Production Worker＋native IndexedDB**：三速度自然96h世界仍有99存活AI；真UI改名→durable ACK→heading render、duplicate、真正過期revision衝突、reload。另desktop／390×844手機模擬器兩軍真出征、native Recovery回滾兩軍／receipt。受控雙線fixture的注入條件存於result，不能算自然長測。

原生瀏覽器功能：Candidate完整5／5 PASS、errors空陣列；main僅跑共同三速度UI比較，不把main無新多線功能算作Candidate覆蓋。兩輪都使用相同自然96h輸入（99存活AI），原seed／traits；速度1／10／50、offline cap0以隔離匯入追補，UI延遲包含pointerdown到durable ACK再到heading render。先main→Candidate各20次／速度；再Candidate→main各6次／速度，無本機長測同時執行。前期有背景負載及部分負載的結果另外保留，不混成單一樣本。

| 輪次／來源 | 速度 | n | p50 ms | p95 ms | max ms |
|---|---:|---:|---:|---:|---:|
| main06c4先測 | 1X | 20 | 458.5 | 811.9 | 1308.5 |
| main06c4先測 | 10X | 20 | 606.7 | 1158.2 | 1174.7 |
| main06c4先測 | 50X | 20 | 945.5 | 1242.2 | 1283.4 |
| Candidate33後測 | 1X | 20 | 816.5 | 1071.5 | 1352.1 |
| Candidate33後測 | 10X | 20 | 791.6 | 1801.5 | 2137.3 |
| Candidate33後測 | 50X | 20 | 1586.7 | 2135.2 | 2188.1 |
| 反向Candidate33先測 | 1X | 6 | 465.7 | 640.4 | 640.4 |
| 反向Candidate33先測 | 10X | 6 | 435.2 | 798.0 | 798.0 |
| 反向Candidate33先測 | 50X | 6 | 899.8 | 1015.0 | 1015.0 |
| 反向main06c4後測 | 1X | 6 | 538.1 | 1156.5 | 1156.5 |
| 反向main06c4後測 | 10X | 6 | 627.4 | 980.3 | 980.3 |
| 反向main06c4後測 | 50X | 6 | 833.2 | 1150.0 | 1150.0 |

[20樣本main](evidence/browser-paired-main.json)／[20樣本Candidate與多線Recovery](evidence/browser-paired-candidate.json)／[反向Candidate](evidence/browser-reverse-candidate.json)／[反向main](evidence/browser-reverse-main.json)。production release identity分別鎖定main06c4／Candidate33，dirty:false；候選正式三檔在28與最終交付保持相同。

**效能相容性：HOLD，需控制環境複驗。** 第一輪Candidate較慢，反向輪p95則較快，樣本量與先後順序不同，不合併成單一分布，也不據此宣稱無退步。觀察到主機CPU quota為2核，先後配對仍不足以排除宿主波動。延遲超過1秒的樣本確實存在，不能聲稱所有指令1秒內完成。此HOLD需中控在獨立環境審查；本輪不擴建其他P0-C效能系統，也未修改timeout／排程契約。


### 重現指令

要求Node22.13+、`npm ci`。輸出放repo外或忽略目錄，勿提交原始存檔、dist或trace。

```bash
npm run typecheck
npx vitest run src/game/formal/p0c9Attack.test.ts src/game/formal/p0c9Strategies.test.ts src/game/formal/autonomyR2a.test.ts src/game/formal/autonomyR2b.test.ts src/game/formal/autonomyRuntimeR2c.test.ts --reporter=json --outputFile=/tmp/p0c9-targeted.json
node scripts/verify-in-isolation.mjs full
npm run build
node scripts/p0c9-prepare.mjs /tmp/p0c9-compiled
node scripts/p0c9-simulate.mjs /tmp/p0c9-compiled 90217 720 traits /tmp/p0c9-results
node scripts/p0c9-matrix.mjs /tmp/p0c9-compiled /tmp/p0c9-matrix
# Uninstrumented compile for controlled/browser integration:
P0_INSTRUMENT=0 P0_RECORD_EVENTS=0 node scripts/p0-profile-prepare.mjs "$PWD" /tmp/p0c9-native
node scripts/p0c9-score-audit.mjs /tmp/p0c9-native /tmp/p0c9-score
node scripts/p0c9-scenarios.mjs /tmp/p0c9-native /tmp/p0c9-scenarios
node scripts/p0c9-browser-fixtures.mjs /tmp/p0c9-native /tmp/p0c9-fixtures
# Build/serve using GITHUB_ACTIONS=true and this repository identity for project base.
# Pass an installed Playwright module path and Chromium /usr/bin/chromium.
P0C9_LATENCY_SAMPLES=20 node scripts/p0c9-native-browser.mjs /path/to/playwright/index.mjs /tmp/p0c9-fixtures /tmp/p0c9-browser http://127.0.0.1:4309/lieguo-zhengtu-origin/
```

CI矩陣workflow僅此施工分支push／手動，contents:read，沒有部署步驟。最終證據提交沒有變更production Runtime，因此保留已完成35組的實際checkpoint歸屬，不能將checkpoint結果冒稱為另一SHA的實跑。

## 失敗歷程、未驗證及殘餘風險

[failure-history.json](evidence/failure-history.json) 保存前期失敗摘要；沒有把失敗改SKIP。初版受控fixture改寫seed traits，被正式Schema拒絕；修正fixture保留原traits。初版Recovery用直接兩筆送單再保存，被原revision+1契約拒絕；改測真正單一AI事件內兩筆命令，Persistence規則未變。早期負向fixture較簡化，已以完整Schema合法版本重新跑main／Candidate。瀏覽器第一次project base錯誤404，第二次觀察器保留巨大state history而終止；修正觀察器只保留非state訊息並限制RPC回傳，保留診斷。額外配對Candidate首次啟動受sandbox socket限制失敗，於允許loopback的執行環境重新執行，未更動Runtime。

本輪未發現存檔／Replay／多線安全BLOCKER。以下保留供審查：長期拒絕不是零；晚期資源容量與野外戰損使catalog成本差額可能為負；Browser延遲尾端超過1秒；Node長期記憶體不等於手機記憶體；單一720h seed與有限browser樣本不代表所有世界。

**Not Verified**：實體Android、手機GPU FPS、實機記憶體、玩家私人存檔。本輪未上傳私人存檔或raw browser trace。mobile為Chromium模擬器。B5 E1沿既有OWNER WAIVED權限、歷史HOLD／FAIL與Astra未PASS紀錄保留，沒有由本輪自動轉成PASS。中控審查後才可另行決定下一步；本輪交付Draft PR後STOP。
