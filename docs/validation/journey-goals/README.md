# 征途目標整合工程驗證

Base：`9c62265dce81becb444c10d79450ec8574bbc05a`（GitHub main／PR #34 已合併）。分支：`feat/journey-goals`。此報告是 Draft PR 的工程證據，不代表正式發布、Gate 通過或玩家實機驗收完成。

## 實作及來源

- 征途目標沿用 `tasks` 路由，電腦主導覽維持 10 項，手機名稱為「目標」。PR #34 的快捷列元件、六格上限、本機偏好、固定更多及滑動架構未修改。
- 成長任務依有效 v94 §16 逐列實作 N01–N14／F01–F29／C01–C20／I01–I17，共 80 項。原條件、獎勵、正式前置及可信事件來源見 [逐列稽核](TASK_SOURCE_AUDIT.md)。來源文件未修改。
- 任務由後端正式事件與可證明的權威狀態記錄，前端只讀持久化的完成 ID。按時代收合，未展開分類不掛載任務卡片；顯示未完成／可領取／已領取、進度、條件與獎勵。
- 玩家手動指定當前自有城市，頁內核對各資源實際入庫及直接損失後領取；可取消、無限期延後。倉庫計算沿用原容量並扣除在途預約，容量或所有權變動須重新核對。沒有新增任務信件、戰報或獎勵彈窗。
- 領取庫存、任務 ID、指令收據及戰役 authority 於既有 CAS／IndexedDB transaction 提交。AI 無法領取。指令重送、不同 ID 重領、並行操作、故障回滾、重載、離線、Recovery 及同戰役舊檔匯入均有定向測試。Recovery 保留不可逆完成與領取紀錄，庫存依回復點還原，不補發獎勵。
- 勝利之路從軍團頁搬入征途目標第二分頁，顯示征服及帝國霸權的條件卡、數值、差額、進度與正式計時／終局。使用既有 `victoryConditions`／`victoryScope`／`victory.candidates`／`victory.result`，不建立前端時計或第二套判定。
- `formal/victory.ts`、`victorySchema.ts`、`militaryPower.ts`、`endgameAI.ts` 及既有 B9 測試未修改。經濟檔只增加人口事件觀察，未改公式、費率、成本或平衡。未施工 B10／B11。
- `NavigationReminders.tasks` 只反映已完成未領任務，快捷列與更多各自呈現；領取後即更新。戰報提醒及已讀規則未修改，普通勝利數值變動不新增閃爍。

## 分階段測試證據

| 階段 | 結果 | 證據 |
|---|---|---|
| 任務系統與存檔／離線／導覽定向 | 134 通過，0 失敗（含原 R4-C1 21 項及新增回復案例） | [phase1-tests.json](phase1-tests.json) |
| 勝利頁、B9 權威／奇觀與目標 UI 定向 | 67 通過，0 失敗 | [phase2-tests.json](phase2-tests.json) |
| 真實 Worker／IndexedDB 瀏覽器 | 10 案例通過，0 失敗，0 page errors | [browser.json](browser.json) |
| Typecheck／Build | 已通過；最終提交另驗建置身分及 Pages 路徑 | 最終摘要另附 |
| 隔離完整回歸 | 首輪 1951 通過／3 失敗／1 跳過；修正後重跑中 | [完整紀錄](full-regression.json) |

任務階段指令：

```sh
npm exec vitest run src/game/formal/growthTasks.test.ts src/game/formal/recoveryR1.test.ts src/game/formal/offlineCooperative.test.ts src/game/MobileNavigation.test.tsx src/game/formal/reviewDeltaR4.test.ts -- --maxWorkers=2 --testTimeout=30000 --reporter=json --outputFile=artifacts/journey-goals/phase1.json
```

勝利之路階段指令：

```sh
npm exec vitest run src/game/presentation/journeyGoals.test.tsx src/game/presentation/victoryB95.test.tsx src/game/formal/victoryB95.test.ts src/game/formal/hegemonyB95.test.ts src/game/formal/wonderDurabilityB95.test.ts src/game/formal/wonderCombatB95.test.ts -- --maxWorkers=2 --testTimeout=30000 --reporter=json --outputFile=artifacts/journey-goals/phase2.json
```

首輪完整回歸揭露 R4-C1 在 1X／10X／25X 下的 Recovery 等價差異：原先任務歷史連沒有新成就的人口抽樣與閒置世界時間也一併保留。修正為僅記真實進度／人口門檻及其發生時點，沒有改寫既有測試。第二輪在審查發現「已完成未領獎後回復較早世界時間」的額外邊界時中止；完成 ID 可保留，但領取世界時間不必晚於另一歷史分支的完成時間。防重仍以持久化 ID 與正式指令收據驗證。原失敗、中止及最終重跑均保留於完整紀錄。

完整回歸依 AGENTS.md 在可丟棄副本執行；不覆寫既有歷史驗收文件。保留 B5 E1 HOLD、Astra Gate 未 PASS、實機驗收待完成等既有事實，不把本次測試宣告為正式發布驗收。

## 瀏覽器與手機截圖

Chromium `154.0.8037.57`，production build，手機觸控模擬，繁中。共 33 張截圖。測試使用腳本產生的原生合成存檔，正式指令、resolver 與 B9 狀態機產生任務完成與勝利計時，再經真正 Worker／IndexedDB 匯入；沒有匯入私人存檔，也沒有新增遊戲測試入口。

| 尺寸 | 成長任務 | 指定城市／溢出 | 征服正式計時 |
|---|---|---|---|
| 320×568 | [截圖](320x568-growth.jpg) | [截圖](320x568-overflow.jpg) | [截圖](320x568-victory-clock.jpg) |
| 360×640 | [截圖](360x640-growth.jpg) | [截圖](360x640-overflow.jpg) | [截圖](360x640-victory-clock.jpg) |
| 390×844 | [截圖](390x844-growth.jpg) | [截圖](390x844-overflow.jpg) | [截圖](390x844-victory-clock.jpg) |
| 430×932 | [截圖](430x932-growth.jpg) | [截圖](430x932-overflow.jpg) | [截圖](430x932-victory-clock.jpg) |
| 568×320 | [截圖](568x320-growth.jpg) | [截圖](568x320-overflow.jpg) | [截圖](568x320-victory-clock.jpg) |
| 640×360 | [截圖](640x360-growth.jpg) | [截圖](640x360-overflow.jpg) | [截圖](640x360-victory-clock.jpg) |
| 844×390 | [截圖](844x390-growth.jpg) | [截圖](844x390-overflow.jpg) | [截圖](844x390-victory-clock.jpg) |
| 932×430 | [截圖](932x430-growth.jpg) | [截圖](932x430-overflow.jpg) | [截圖](932x430-victory-clock.jpg) |

另附 390px [快捷提醒](390x844-quick-reminder.jpg)、[重新載入](390x844-reloaded.jpg)、[勝利條件](390x844-victory-conditions.jpg)、[帝國霸權](390x844-hegemony.jpg)、[正式終局](390x844-terminal.jpg)，[桌面任務](desktop-growth.jpg)／[桌面勝利](desktop-victory.jpg)，[減少動態任務](reduced-motion-growth.jpg)／[減少動態勝利](reduced-motion-victory.jpg)。

八組手機尺寸均驗證觸控左右滑動、固定更多 48×58px、一般按鈕原尺寸、左右箭頭、第一／最後快捷操作、原更多內容及 `tasks` 偏好相容、隱藏／重新加入、頁面高亮、領取兩項真實完成任務、重新載入後領取與偏好保留。任務提醒 2→1→0，戰報仍為 1 且保留閃爍；只展開黑暗或城堡分類時分別掛載 14／20 張卡片，沒有水平溢出。

完整尺寸重測曾在 568×320 的導覽滑動斷言失敗；原錯誤與重跑保留於 `browser.json.reruns`。延長腳本等待原生平滑滑動穩定後，568×320／932×430 再次通過；沒有修改產品導覽元件。較早驗收腳本亦曾遇到原生 details toggle 與箭頭隱藏的等待競態，已改成等待實際卡片與箭頭狀態；不得將這些腳本重試描述成全程首次通過。

重現方式（Playwright／Chromium 為外部驗收環境工具，不加入產品依賴）：

```sh
node scripts/prepare-journey-goals-fixtures.mjs /tmp/journey-goals-fixtures
npm run build
npm run preview -- --host 127.0.0.1 --port 4180
node scripts/verify-journey-goals-browser.mjs /absolute/path/to/playwright/index.mjs /tmp/journey-goals-fixtures /tmp/journey-goals-browser
```

## 限制、風險與待驗

- 舊存檔沒有可信歷史證據的已完工建築、訓練與已消失行軍，不會從現況反推完成。這避免虛構歷史或把征服現成建築算作親自完工；後續正式事件正常認定。
- v94 §16.3 小計列誤植已記錄，使用者明示數量及逐列內容為準，未改正式規格。
- 手機驗收使用瀏覽器模擬；玩家 Android／iOS 真實觸控、瀏海安全區、系統字級、背景恢復及實際長期存檔仍待實機驗證。
- 測試覆蓋原生合成舊存檔及離線／Recovery；未取得玩家私人長期存檔，不宣告其驗收完成。
- 既有浮動設定鈕在部分手機位置會遮住少量卡片內容，頁面可繼續捲動；保留原導覽及設定架構，交由實機驗收確認。
- 不合併 main、不部署 Pages、不啟動 B10／B11。交付後停止，待 GPT-6 中控審查及玩家實機驗收。
