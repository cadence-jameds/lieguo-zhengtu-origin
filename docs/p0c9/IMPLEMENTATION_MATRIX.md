# P0-C-9 Runtime Candidate — Authority／公式矩陣

本輪僅 P0-C-9。Authority：玩家 2026-10-19 正式施工令 > v94 §10.4／§10.4.1 > main source。main `06c4cb93779f1f679bb77470515fd8aee1c42de9`，研究 `fa038a00d3aa5a500cb055176164a907495b6212`，研究 CI https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/39181291329 。其他 P0-C／五筆排程／DEMO UI／流亡資格不在本輪施工範圍。

## Runtime 路徑

`autonomy.handleAutonomy` → 原軍事 `aiActions.militaryDecision` → 原 recall／援軍／active／威脅／冷卻／在外上限／啟動機率／joint.join → 共用原城市合法候選與 joint.create 優先 → `pickAttackStrategy` 一次 → `executeAttackStrategy` 的單一策略 → 原 `submitAutonomous` 逐筆 `submitFormalOrder`（Replay 原 submit draft）→ 原 Scheduler／Combat／回城／addStock。

所有五策略保留原人口、訓練、經濟、科技、外交、行軍與戰鬥數值。11 traits、Schema、Scheduler、Reducer、SaveCodec／Recovery／CAS 契約不變；不新增存檔策略欄位、永久職業、交易機制或世界永久統計。原 military trigger offset +311 只在入口檢查一次；策略抽選固定 offset +1923，`aiRandom` 不改。研究 wrapper 重複呼叫同一 stateless RNG 的 gate 已收斂為一次檢查，未增加第二次機率。

| 策略 | 搜尋（野外／城） | 野外距離項 | 野外 score 與門檻 | 城市／其他 |
|---|---|---|---|---|
| A48 | 48／48 | 按 Euclidean 距離取最近，不評分 | 至少50有效兵，site level ≤ max(1,floor(total/100))，派30% | main 城市優先；有合法敵城候選就不走野外 fallback |
| V2B48 | 48／48 | `1-d/24` **無 clamp**；48格為 -1 | `.45 need+.30 distance+.20 safety+.05 levelFraction`，理論 [-.30,1.00]；擇最高，不加新門檻；diversion 機率 clamp [0,.88]，scout 上限 .26 | 原 city command；偵察受保護，不固定打野 |
| V3Parallel48 | 48／48 | `clamp(1-d/24)`，25–48 為0 | `100*(.30 need+.25 gain+.25 safety+.15 distance+.05*.5)`；理論 [2.5,97.5]；≥35、派28%、至少14名 | 原城市分數距離分母48、clamp；雙線 total≥90／已有外軍≤1／city score≥33；單線偏好需野外 score > city+8；scout 不被單線替換 |
| WildPriority60 | 60／48 | `clamp(1-d/24)`，25–60 為0 | `100*(.40 need+.25 safety+.20 distance+.15*(.45 economy+.55 raiding))`；[0,100]；≥38、safety≥.14、派26%、至少12名 | 城市分母48、clamp；wild+12≥city 才取代；保留 scout |
| WildParallel48 | 48／48 | 同上，25–48 為0 | 同上 | 同時保留打野與多線；total≥90／已有外軍≤1／city score≥32；scout 可與野外併行 |

各模式保留研究版「沒有敵城且24格內已有原 wild fallback 時，先沿用該命令」；A48 則直接擴大原 fallback 至48。擴大候選均透過 Spatial 區域查詢、近距排序後最多8筆；未把距離分母改成48／60。City score 範圍沿研究：V3 [0,100]；WildPriority 城市 [0,100]（組件受各自 trait 及戰爭範圍限制）。本表理論包絡不聲稱每個端點在實際世界均可達。

## 五策略抽選（原 Candidate 數值）

`A48=.70+.55K+.35D`；`V2B48=.70+1.60E+.55R`；`V3Parallel48=.65+1.25M+.90X+.35K`；`WildPriority60=.70+1.70E+.65(1-K)`；`WildParallel48=.70+1.35R+.95M+.55E`。`P=W/sum(W)`，每次重新抽取；所有 trait 組合對五策略均保持正權重。沒有改動外交／忠誠／復仇機制。

## 研究 → 正式安全 Delta

1. 將 Vitest wrapper 改為正式 `aiAttackStrategies.ts` 模組；共用原 city candidate，抽選後只執行所選策略的野外／城市比較。joint.create／join、援軍與召回維持先行。
2. 多線 allocation 查兩筆命令的**全部兵種 union**：有效常規戰鬥兵逐兵種最多合計70%，保留研究動態版30%守軍；斥候／攻城器依原任務分配並逐種核對實際可用量，沒有因其不在 wild detachment keys 而漏檢。策略 generation 的比例／門檻不改。
3. `submitAutonomous` 每筆重新讀取 live troops、origin 外軍上限3與當輪 ephemeral 守軍下限。政策 preflight 拒絕不扣兵；實際送出的每筆仍由原 Reducer 驗證目標、世代、任務、路由、外交與兵力。第一筆成功不因第二筆失敗回滾，不新增跨命令交易。
4. 已有 CommandId 先走 Reducer 去重，不因部隊已離城被 preflight 誤拒；duplicate 不新增 accepted／rejected 計數。軍事冷卻只在實際新增本勢力軍隊後更新。
5. 原研究候選的同距／同分 ID tie break 改為明確字串比較，避免依宿主 locale；原 A48 的 stable 陣列順序仍保留 main 行為。沒有新增權重／門檻或正規化 Delta。

## 驗證與證據方法

- `p0c9Attack.test.ts` 保留「有敵城／25–48格野外」的 before FAIL／after PASS。
- `p0c9Strategies.test.ts`：權重端點、每次重抽、五種搜尋邊界（25／48／49／60／61）、偵察保護、隱藏敵方資料不影響候選、多線真 Reducer／部分失敗／兵種餘額／守軍／重送、SaveLoad／Recovery／CAS／離線／Replay／三速度。
- `scripts/p0c9-prepare.mjs`：原 source 以現有 compiler 編譯；只在可拋棄 compiled 副本插入觀察 wrapper。比較模式只替換純策略 selector 的 policy；traits 為正常 production 預設，不改世界、AI數量、出征頻率、經濟或兵力。
- `scripts/p0c9-simulate.mjs`：自然開局、99 AI、seed 90217／104729；逐小時真 Formal Scheduler。普通野外／流亡／玩家分開；實際入庫在 `addStock` 前後量測，另列返城 cargo，不能把攜帶量冒充實際收入。成本統計為**catalog 等值重招成本估計**，非實際已支出招募費。
- `scripts/p0c9-matrix.mjs`：35 jobs，168／360 各兩seed、720一seed，五單策略／平均／性格混合；每次結果記錄 input HEAD、source hash、原始 JSON 與逐小時 CSV，失敗保留。不引用研究數字作正式完成證據。
- 本機 GitHub shell egress 僅允許 npm registry，Git objects 透過已連接 GitHub GET API 取得，按原 SHA 驗證還原，基準與樹完整保留；未改寫歷史或繞過網路政策。

最終通過數、模擬數值、CI、待驗與 BLOCKER 必須以本輪 Delta Report 為準。本矩陣不是 Gate PASS。
