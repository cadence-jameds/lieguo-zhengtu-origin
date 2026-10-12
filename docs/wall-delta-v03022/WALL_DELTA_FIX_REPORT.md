# 列國征途：始源｜v0.30.22 Wall Delta Fix Report

日期：2026-10-07。範圍：B5 前最後 Core Delta Fix，只補正式城牆施工。B5 與 Astra Gate 均未開始，v85 原文未修改。

## 結果

v0.30.21 的已知差異「城牆應可施工，但 Formal runtime 尚未接入正式施工」已修正。715 組既有 Formal 正例／反例全部相符，已移除測試中刻意接受這項 mismatch 的預期。Core regression 為 40 個測試檔、383 項測試全部通過；資料對照 140 項、295 組公式／曲線沒有數值差異，既有 54 項 developer 檢查通過。

這些結果確認本次施工 delta 與既有回歸。它們不宣告完整 v85 功能驗收、玩家實機驗收或任何 Gate PASS。

## 唯一來源與規格

- 唯一 source baseline：使用者提供的 `列國征途_原始碼_v0.30.21.zip`；SHA256 `9da2699a161203fde8b8ee0350394c8c562b8bed0ff500fdd006b01c147508e6`。
- 修改前 608 個追蹤檔案與該 ZIP 的 source manifest 逐檔相符；baseline commit `1d1d9728b4f83d393b37f3b3fc772a9aae2ac134`。
- Authority：v85 > v84 > source。原 v85 SHA256 `fac5536c86935ccd99ee41cd58076bd1f1a401b4b3bc091c8195728a432439d9`，獨立驗證快照保留不變。
- v85 第 973、979 行：固定設施，不占 15 格自由建築槽。第 994 行：黑暗時代、城市中心 Lv2。第 1018、1025 行：城市中心加速適用城牆，倍率 `0.964^(中心Lv−1)`。第 1884～1913 行：最高 Lv15、逐級成本與基礎工期。

成本為 `round_to_5({糧30,木70,石160,金40} × 1.38^(目標Lv−1))`。逐列核對 v85 的 15 級表格與公式，兩者完全一致；累積總成本 98,185，累積基礎工期 21 時 50 分。正式工期沿用共用精度：`round(基礎毫秒 × 0.964^(中心Lv−1))`，現實秒數為工期毫秒／遊戲倍數／1000。

### 取消退款規格差異：仍需原文定義

v85 沒有明列一般建築施工取消的退款比例。本輪在實作前已列出這項差異；沒有新增城牆專用比例或把軍事／拓殖取消規則推定成建築規則。

城牆接入 v0.30.21 **原本的共用施工取消流程**：開始施工的工程退回每類已付資源的 80%（逐類向下取整），尚未開始的工程退回 100%；取消目標也移除同目標依賴它的後續升級，各工程依本身 active／queued 狀態計算。退款受本城可用倉儲及已預約入庫限制，超出不保留。這是 source 繼承行為，**不是 v85 明文定案**。

`specAudit` 仍顯示此退款項目為 `unverified`。715/715 是既有正式情境相符數，不把未定義的退款規則算成 v85 已確認。未自行修改 v85，也未要求或執行 Astra Gate。

## 實作與驗證

| 項目 | 本次行為與證據 |
|---|---|
| Lv0→Lv15、前置、成本、工期 | `catalogB3.ts` 增加城牆資料；實際 reducer 入列、扣款、事件前 1 ms 與事件當下的等級皆核對。15 級 × 中心 Lv2／5／15 × 1／3／6／10／50 倍，共 225 組。滿級後拒絕 Lv16。 |
| 固定設施 | 唯一工程 identity 為 `wall`；不建立 `buildings.wall` 或 `economy.slots.wall`，拒絕指定一般建地。15 槽皆滿仍可蓋城牆。 |
| 正式 queue | 使用既有 `building.upgrade`、`construction.complete`、`construction.cancel`。工程容量 3，同時施工沿用永久 15k 第二佇列；同城牆升級保持等級順序與同 lane，不可跨 lane 超車。成本、工期在入列時固定。 |
| active／queued、取消 | 場景與詳情顯示施工進度或等待標記。排隊取消、施工取消、依賴連鎖取消、滿倉退款、事件撤銷、已完成工程取消拒絕均測試。 |
| scheduler／event | 未到時間不加級，完成事件更新 `city.wallLevel`；取消後事件不殘留，重複推進不再加級。15k 里程碑會依共用規則重排等待工程。 |
| save/load、Recovery | 正式 codec、持久化讀回、手動 Recovery、R1 自動回退至有效 checkpoint、離線／線上結果一致。backup／world／authority 三種寫入故障均能完整回退後安全重試。使用 fake-indexeddb 執行持久化回歸。 |
| duplicate／stale | 重複命令、相同 ID 不同 payload、過期 revision 被阻擋；Worker 存檔失敗不扣款，重試後重載不再扣款或占第二份工程。施工與完工結果都只在 durable save 成功後發布。 |
| UI／DEMO presentation | 城內既有城門入口與名冊接正式操作，不改布局或 CSS。複用原有城牆詳情 SVG、施工背景與各時代完工背景。排隊不提前換成施工美術；完成後回到完工場景。手機／桌機 10 項 DOM 互動測試通過。 |
| 單一 wall authority | 完成等級只存 `city.wallLevel`；`buildingLevel(city,'wall')` 與場景讀取同一欄位。schema 拒絕另存 wall 建築／槽位或不合法工程等級鏈。保留供未來 B5 siege 讀取，未加入戰鬥 resolver。 |
| developer/spec | 城牆試玩 fixture 使用 `wallLevel`；ready 正例改為真正允許施工，取消已知失敗例外；715/715 對照全部相符，退款文義缺口仍另列。 |

## 檢查與重跑

| 檢查 | 結果 |
|---|---|
| `npm ci` | 成功，394 個套件；本輪安裝後使用原 lockfile 依賴。 |
| `npm run typecheck` | 成功，exit 0；`typecheck.txt`。 |
| Formal／B1／R1／B2／B3／B4＋developer/spec＋presentation regression | 40 檔、383/383；`core-regression.json` 與 `core-regression.txt`。 |
| Formal 規格情境 | 715/715、failures 空陣列；`spec-scenario-comparison.json`。 |
| 獨立資料／公式 | 140 項資料無差異、295/295 公式相符；`spec-data-comparison.json`。 |
| 城牆級別／倍數矩陣 | 225/225；`wall-level-speed-matrix.json`。 |
| 既有 developer checks | 54 項通過；`developer-checks.json`。 |
| `npm run build` | 成功，exit 0；`build.txt`。 |

```sh
npm ci
npm run typecheck
DEVELOPER_EVIDENCE=docs/wall-delta-v03022/developer-checks.json npx vitest run src/game/formal src/game/presentation src/game/developer src/game/saveLock.test.ts src/game/interaction.test.ts src/game/worldStream.test.ts src/game/useGameInteraction.test.tsx --reporter=default --reporter=json --outputFile.json=docs/wall-delta-v03022/core-regression.json
npm run build
```

Node >=22.13.0；本輪使用 Node 24。既有測試可能重寫 `docs/playable/B4_manual_inspection.realm-save`，本次已還原該 baseline fixture。v0.30.21 證據維持原樣；新證據位於本目錄。UI 測試是 Happy DOM 的實際按鍵→正式 reducer 路徑驗證，沒有把它寫成手機／桌機實機截圖驗收。

## 停止點

產出 v0.30.22 新 checkpoint，保留 v0.30.21。下一階段應以新完整 source ZIP、SHA256SUMS、source tree hash 及交接為基準，另附原 v85。未重做 B2～B4，未重新設計 UI，未修改 v85，未執行 Astra Gate，未開始 B5。
