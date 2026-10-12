# B5 v91 Delta — v0.30.39

範圍：只修改 B5 持續攻城、Formal 戰況投影、終戰戰報與測試台；不開始 B6/B7/B8。Sol Implementation 驗證不代表 Astra Independent Gate PASS。

## Authority / baseline

- 唯一開工 baseline：v0.30.38，commit `481c9abb847660f8289950f755106855e4dac409`。
- source ZIP SHA256：`ca3d2b98b15821339c7777deb33771319c79b82e3521b246990385dd6b135da0`。
- 開工 source-tree 的 922 個檔案全部吻合 Git checkout；未發現更新版本。
- v91 原文 SHA256：`c6428b647baf5ae7a5439c8534b4dc3212b261606ad20c15f4248d42510ee6c0`。
- authority-v91.md / authority-v84.md 是核對後原文；優先 v91 > v90 > v84 有效規則 > source。

## 實作契約

主戰 round 與 siegeRound 分開。主戰首回合立即、後續 5 戰術分鐘、無固定上限。攻城首回合立即，最多 12；partial wall damage、當級 identity、catapultBatchDone、下一次事件時間、摘要全部持久化。援軍及訓練以既有 Scheduler 優先序納入，重新主戰不重置 siegeRound。投石機同一 BattleId 只執行一次合法建築／資源田破壞批次。

城牆已降低等級保留，結束時未破當級的部分傷害不留至下一戰。征服成功效果只在 final receipt 執行一次；超時、无占領兵、雙方全滅及敗退各有真正原因。每 BattleId 只有終戰正式 BattleReport。

原生 schemaVersion 3 不變，ruleset 更新 v91-b5.2。checksum / 舊 schema 驗證後才確定性補齊新欄位；保留在途／進行中 ArmyId、BattleId、HP、回合與 EventId。不存在 DEMO migration。每戰摘要最多 64、攻城逐回合紀錄最多 12；沿用最小 resolution receipt ledger，未做 B11 全世界長期 ledger 壓縮。

liveBattleView 僅投影玩家本方兵力與合法重大事件，不傳敵軍 HP、即時精確編成、當級耐久或係數。行軍頁包含無 ArmyId 的本城防守入口。歷史偵察不當即時情報。

## 可重現驗證

```sh
npm ci
npm run typecheck
npx vitest run src/game/formal src/game/presentation src/game/developer src/game/saveLock.test.ts src/game/useGameInteraction.test.tsx --reporter=verbose --testTimeout=30000 --maxWorkers=2
npm run build
```

Core：65 檔 / 778 tests PASS；獨立攻城專項 186 tests PASS。DOM 為 happy-dom，390px / 1440px；不等同實體手機或真實瀏覽器人工試玩。

balance-matrix.json：160 組實際 Resolver 與獨立預期值。long-combat.json：第 1/10/30/60 回合終戰、497 回合壓力案例；大數字案例是工程壓力 fixture，不是正常人口平衡建議。concurrent-battles.json：12 場同時圍城。regression-evidence.json 包含終戰、Recovery、原子失敗注入、速度與邊界等記錄。lab-evidence.json 是既有隔離測試台的真實命令／排程操作。

## 人工驗收邊界

真實桌機、手機、觸控、視覺、SW 更新、真實瀏覽器重新讀檔均 PENDING。既有測試台可設 AI 目標、空城 Lv15、militia 1 + ram 1，逐事件至攻城 4（Lv14）、reload 保持 BattleId／partial，再到 12（Lv11）超時返回；全程只最後一份戰報。militia 615/564/563 無 ram 分別第 11 成功／第 12 成功／第 12 失敗 Lv1。守方只有駐軍時使用「本城防守中」入口。

Astra 必須獨立核對：Schema 舊存檔、Scheduler 同時事件、HP 同步／增援初始兵力、施工 rebase、倉庫預約、訓練取消／住房人口、final receipt、IndexedDB rollback／Recovery、戰況權限、戰報唯一性、12 回合 CALIBRATE。保留 12 與所有既有拆牆係數。
