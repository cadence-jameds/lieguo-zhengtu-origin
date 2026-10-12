# 列國征途：始源｜v0.30.22 下一階段交接

日期：2026-10-07。此 checkpoint 只完成「B5 前最後 Core Delta Fix：城牆正式施工」。完成後 STOP；未開始 B5，未做 Astra Gate。

## 基準

- 唯一新 source baseline：`列國征途_原始碼_v0.30.22.zip`；不混用較早版源碼。
- 上一個 source baseline：使用者的 v0.30.21 ZIP，SHA256 `9da2699a161203fde8b8ee0350394c8c562b8bed0ff500fdd006b01c147508e6`。v0.30.21 保留未覆蓋。
- Authority：v85 > v84 > source。原 v85 SHA256 `fac5536c86935ccd99ee41cd58076bd1f1a401b4b3bc091c8195728a432439d9`；本輪原文與獨立快照均未修改。
- 正式網站維持同一「列國征途：始源」Sites。發布 commit、source tree hash、檔案校驗及發布收據以這份交接的 checkpoint 區及 evidence 為準。
- 解壓後專案為 `lieguo-origins-v0.30.22/`，源碼直接在 `src/`。完整 public 美術、依賴 lockfile、設定、測試、scripts、歷史 docs 及本輪 evidence 都包含；不含 node_modules、Git 歷史、dist、快取或玩家實際存檔。

## 已完成

城牆 Lv0→15 已使用既有正式建築施工命令、queue、scheduler/event、付款、取消、存讀檔與 Recovery；黑暗時代、中心 Lv2，固定設施不占 15 槽，最高 Lv15。逐級成本與工期依 v85；中心施工倍率與五種速度均驗證。施工／排隊／完成接上既有 DEMO presentation，沒有重設 UI 或重做 B2～B4。

完成城牆只有 `city.wallLevel` 是持久化 authority；`buildingLevel(city,'wall')` 與 presentation 讀同一值。不得建立 `buildings.wall` 或額外 wall slot。未來 B5 siege 要沿用這個權威，不另開完成等級或先行套用排隊中的 `toLevel`。

結果：715/715 Formal 規格情境相符，移除先前刻意保留的 known wall mismatch；Core 40 檔 383/383，140 項資料沒有數值差異，295 組公式／曲線相符，54 項既有 developer checks 通過；城牆 225 組級別／中心／倍數矩陣相符。`npm ci`、typecheck、build 均成功。

## 仍保留的規格文義差異

v85 未明列一般施工取消退款。城牆沿用 **v0.30.21 共用 source 行為**：active 退 80%、queued 退 100%，各資源向下取整，依賴同目標後續工程連鎖取消，受可用倉儲限制。沒有自行新增政策或修改 v85。specAudit 明確保留此項 `unverified`；715/715 不是退款政策已在 v85 定案的宣告。

v0.30.21 已存在的科技額外前置／騎士時代推定等文義核對事項沒有擴大處理。完整 B2～B4 玩家驗收、手機／桌機實機 Smoke 與 Core Gate 尚待後續獨立授權；本輪不執行它們，也不自動宣告 Gate PASS。

## 證據與操作

- `docs/wall-delta-v03022/WALL_DELTA_FIX_REPORT.md`：規格依據、退款差異、實作範圍與驗證。
- 同目錄 `core-regression.json`／`.txt`、`spec-scenario-comparison.json`、`spec-data-comparison.json`、`wall-level-speed-matrix.json`、`developer-checks.json`、`formal-art-map.json`、`civilization-speed-comparison.json`、`typecheck.txt`、`build.txt`。
- 三份關鍵測試：`formal/wallDelta.test.ts`、`presentation/wallDelta.test.tsx`、`formal/runtimeB4.test.ts` 的新增 wall cases。
- 實際試玩：開發者驗證台→建築→城牆，先試中心不足與 ready 情境；到城市→城內→城門，查看條件、按升級，觀察 queue、取消或推進完成事件，再保存讀回。可逐級驗證 Lv15 與滿級阻擋。
- 本輪 UI 驗證為 Happy DOM 互動；持久化測試使用 fake-indexeddb。未冒稱已在真手機／桌機親玩或拍攝新截圖。

```sh
npm ci
npm run typecheck
DEVELOPER_EVIDENCE=docs/wall-delta-v03022/developer-checks.json npx vitest run src/game/formal src/game/presentation src/game/developer src/game/saveLock.test.ts src/game/interaction.test.ts src/game/worldStream.test.ts src/game/useGameInteraction.test.tsx --reporter=default --reporter=json --outputFile.json=docs/wall-delta-v03022/core-regression.json
npm run build
```

Node >=22.13.0，使用 `npm ci` 還原依賴。測試可能重寫 docs 中的驗證檔案與測試 fixture。

## 下一個對話

請接續《列國征途：始源》，使用我附上的 v0.30.22 完整 source ZIP、SHA256SUMS、source tree hash、本交接及原 v85.md，先驗證 checkpoint。Authority 維持 v85 > v84 > source；城牆施工缺口已完成，不要重新實作 B2～B4 或重新設計 UI。先依我的下一步指示處理驗收；未取得新指示前，不開始 B5，不做 Astra Gate，不自行修改 v85。退款文義差異與既有未驗收事項要維持可見。
