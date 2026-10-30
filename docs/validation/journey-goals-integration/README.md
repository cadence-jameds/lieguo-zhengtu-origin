# 征途目標整合驗證

基準為最新 main `9ac3ccc06e1bc8915147ee405d385c369ea47027`。程式、定向測試、正式 v96 規格及四張必要截圖固定於實作 commit `f6c2bdd09d0b53e11a31ac87ad91e4ab7e3b6cef`；本輪只整合獎勵、無損失容量領取及方案 B UI。

## 獎勵與規格

80 個原 ID、名稱、達成條件、次數與前置保留。四資源合計由 **2,313,000 → 842,700（降低約 63.6%）**。

| 時代 | 項數 | 調整後總額 |
|---|---:|---:|
| 黑暗 | 14 | 12,650 |
| 封建 | 29 | 74,000 |
| 城堡 | 20 | 210,550 |
| 帝王 | 17 | 545,500 |
| 合計 | 80 | 842,700 |

每種資源以 5 為單位，使用原任務權重的整數商與最大餘數法；餘數相同依糧、木、石、金順序分配。四資源總額依序為 84,270／188,375／290,605／279,450。測試逐項比對玩家指定的 80 個總額及正式規格表。

依 AGENTS.md 的完整主規格版本規範，新增 `docs/b6-v96/河谷戰役_vNext_平衡重構討論_v96.md`，完整繼承 v95；僅修改任務章節、必要的 §17 凍結例外與版本優先序。測試確認 §1～15 及其餘後續章節不變；v95／v94 原文與歷史獎勵表保持原樣。v96 修正了原 N 小計誤植為帝王小計的表格錯誤，未改動歷史文件。

## 領獎與歷史相容

- 四資源都須滿足 `可用容量=max(0,floor(storageCapacity-currentStock-reservedIncoming))`。任一項不足，整筆拒絕，庫存及領取資格均不變。提交時再次驗證所有權、完成狀態、未領取狀態及完整容量。
- 新指令與憑證使用 `rewardVersion:2`。完整獎勵向量固定，不綁定自然產出持續改變的庫存快照；不需反覆重新核對。Receipt 去重、世界 revision、CAS 與原子存檔交易繼續保護一次性發放。
- 缺少版本欄位明確代表原版 v1，使用獨立凍結的 `growthTaskRewardsV1.ts` 及原實收／溢出公式驗證。沒有 Zod 預設值或讀取時補寫，不更改舊 Fingerprint、Receipt、checksum 或已領取資料。未知版本、版本與 Fingerprint 不符、偽造實收／損失均拒絕。
- 舊版已領取不扣回、不補發、不重領；舊版未領取改用新表。舊命令可依原 Receipt 去重重送，但沒有 Receipt 的舊格式新提交會拒絕。Recovery 與舊存檔匯入仍保留不可逆領取歷史。

`legacy-v1.json` 是用**未修改的基準引擎**及合成 Formal fixture 產生的三個存檔（完整入庫／部分溢出／全部溢出），不含玩家存檔。SHA-256：`2b97930e0cf91ef22d9c8a685968d9532e69bbf27ee3982b655889a7de01df67`。新版 decode→encode 的 checksum 與原版完全相同，舊指令仍為 duplicate。另測新舊混合憑證的存讀檔、舊存檔匯入及 Recovery 不重發。

可在基準 commit 的 detached 工作目錄準備鎖定依賴及 `npm run release:prepare`，由本分支呼叫 `scripts/prepare-growth-legacy-fixtures.mjs <output.json>` 重現；腳本先校驗原引擎來源 SHA，再產生固定命令與 ASCII JSON。本輪已重產並 `cmp` 確認位元組完全一致。

## UI 與截圖

可領取任務跨時代置頂，容量不足仍留在可領取區；進行中按四時代展開；已領取整區預設收合，單行摘要 44px，點擊才繪製歷史明細，無重領按鈕。桌面雙欄、手機單欄。折疊狀態不進存檔；領獎後待 Worker 忙碌結束，以 `preventScroll` 將焦點交給下一操作或可領取標題。Native details 支援 Enter／Space，`aria-expanded` 與有效的 `aria-controls` 區域同步。

- `320-capacity-blocked.jpg`：容量不足與完整領取停用。
- `390-ready.jpg`：所選自有城市、四資源獎勵、可用容量及不足量。
- `1440-ready.jpg`：桌面雙欄。
- `390-claimed-history.jpg`：44px 已領取摘要與點開的歷史明細。

`browser-result.json`：320／390／1440px **3 PASS、0 FAIL、0 JS／載入錯誤**。使用正式 build、真實 Worker／IndexedDB 及合法完成事件的合成世界；驗證完整領取、分類、兩項連續領取、防重領重載、鍵盤展開、無橫向溢出、手機既有六格導航、獨立任務／戰報徽章，以及勝利之路原有條件與計時。

重現：先 Build，以相同 Pages base 啟動 Vite preview；`JOURNEY_INTEGRATION=1 node scripts/prepare-journey-goals-fixtures.mjs <temporary-fixtures>`，再執行 `JOURNEY_BROWSER_URL=<preview-url> node scripts/verify-journey-goals-integration.mjs <playwright/index.mjs> <temporary-fixtures>`。來源的瀏覽器模組與 Chromium 路徑可依機器設定，不需要私人存檔。

## Gate 與結果

原美術 Gate 同時凍結了任務來源。本輪透過 `growth_tasks_successor.py` 與 `compatibility.json`，只接納八個明確授權的任務來源，固定到不可變實作 commit；原美術 manifest、v95 與既有 UI 相容紀錄均保持原 SHA。新增／修改來源、舊獎勵表或證據，即使重算 JSON 雜湊仍會被拒絕。原 Gate 繼續執行，另有三項新防竄改測試。

110 項定向測試通過；所有完整檢查結果見 `checks.json`。完整回歸只在拋棄式副本執行，維持既有 30,000ms 門檻；不改寫歷史證據。B5 E1 HOLD、Astra Gate 非 PASS 等既有驗收事實仍保留，本輪工程通過不等於正式發布放行。

待玩家驗收：實體手機觸控、長名稱可讀性、連續領獎的捲動體感，以及新獎勵節奏。維持 Draft，不合併、不部署。
