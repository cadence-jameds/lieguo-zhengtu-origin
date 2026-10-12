# R3 Browser Delta Fix Report

日期：2026-10-12～13，Windows／Asia Taipei。專案 `G:\Projects\Lieguo`，分支 `work/r3-browser-verification`。原始 R3 基準 `4ed0f1073aafbc675b24bf8351818e76a45a76a9`、v0.30.49 保留；本次為新的 delta commit，未變更版本、平衡或治理解鎖條件。

## 治理 revision 根因與結果

先讀取原 [REPORT](../r3-local-2026-10-12/REPORT.md)、actions.json 及原 trace，再以原程式在真實 Chrome 重現。100 軍隊、50X 場景連續 12 次方針套用僅 2 次 committed、10 次 revision rejected，見本目錄 actions.json 的 `baseline-100-governance`、baseline-runtime.json、baseline-governance.png、baseline-trace.zip。

競態有兩個窗口：React 顯示的 snapshot 與 Worker 收到命令時的 world 已有背景事件造成的 revision 差；即使命令抵達時 revision 相符，Worker 在命令 admission 內先追趕到期事件，也會推進 revision。原本提交仍帶舊 expectedRevision，Formal reducer 因而正確拒絕。UI 的 current ref 也不能代表玩家看到並編輯的那一份治理狀態。僅處理 admission 內 catch-up 仍無法消除第一個窗口，相關中間失敗保留於 intermediate-runtime.json／fixed-trace.zip。

修正以治理專用 compare-and-set 前置處理：

1. 治理頁把實際 rendered snapshot 的 revision 與治理 fingerprint 隨命令交給 Worker。fingerprint 包含 campaign、player、城市 owner、市政廳等級、經濟資料是否存在、治理 enabled／policy／budget／reserve，以及最新已套用治理命令 receipt。receipt 以 committedRevision 選取，不依賴存檔排序；因此 A→B→A 也視為較新玩家設定。
2. Worker 序列化 admission 只在上述前置仍吻合、時間／身份合法且未跨 load／restore 分支邊界時，將同一 CommandId、同一 payload 綁到當前 revision／time。admission 自身追趕事件也採相同的狹窄治理條件。
3. Formal reducer 的 revision、資格、資源、payload 規則、CommandId 去重以及 IndexedDB commit CAS 全部保留。付款／建造等其他 stale 命令仍被拒絕。沒有自動重送迴圈，沒有新建另一付款命令。
4. 玩家治理設定、城市資格或 ownership 有變化時拒絕，發布最新 world／patch，解除 UI busy，顯示「治理狀態已更新，已刷新城市資料；請確認方針、預算及保留量後再次套用。」讓玩家重新確認。

實作：governanceAdmission.ts、runtime.worker.ts、useGame.ts、GovernanceView.tsx。回歸涵蓋背景事件、ABA 設定、branch floor、非法時間、跨 campaign／issuer、資格改變、去重、storage failure 回滾與手動重試。拒絕不得半提交、重複付款或新增重複治理事件。

最終 Production build 在全新 headed Chrome context 驗證如下（final-chrome.json／final-chrome-trace.zip）：

| 速度 | 低負載（初始 0 軍隊） | 密集事件（初始 100 軍隊） |
|---|---|---|
| 1X | 6／6 套用，停止成功 | 6／6 套用，停止成功 |
| 10X | 6／6 套用，停止成功 | 6／6 套用，停止成功 |
| 50X | 6／6 套用，停止成功 | 6／6 套用，停止成功 |

另以真實 Worker protocol 重播相同 CommandId：duplicate，庫存、治理 spent、eventId、nextAt 前後相同；舊治理 guard 被拒絕且新 reserve 設定保留；stale 付款命令仍 rejected。這些 protocol 安全檢查與 36 次真正 UI 按鈕操作分別記錄。密集場景使用正式 dispatch 建立的受控 fixture（1 玩家＋99 AI，以及正式 Lv15 siege），不是宣稱新遊戲自然立即出現 100 支軍隊。

## 其他 R3 修正

市政廳舊「治理方針／尚未開放」改為依原合法前置顯示可委任，未滿足時提示市政廳 Lv1。Formal 解鎖规则未改；見 townhall-fixed.png 與 governanceR2c.test.tsx。

真實瀏覽器另發現關閉一般標示時「流」消失：glyph 已收集，但 paintMapGlyphs 整體被 labels 開關擋住。改為繪出已經個別篩選的 glyph；一般文字仍受原開關控制，流亡「流」獨立顯示。原畫面測得 labels off 0 次「流」，修正後 47 次實際 Canvas fillText，見 exile-labels-baseline.json、exile-labels-off-baseline.png、exile-labels-off-fixed.png、final-chrome.json。觀察器呼叫原 Canvas 函式，沒有製造圖像或修改世界資料。

## 補驗收證據

| 項目 | 實際結果及主要證據 |
|---|---|
| 商隊／拓殖隊／工匠行軍 | PASS。使用正式 logistics.dispatch／settlement.dispatch／craftsman.move 及真實 typed IDs。civilian-movement-verified.json 記錄 world time／路徑位置變化；civilian-final-before.png／after.png 與 final-chrome.json 確認三種 Canvas 標記畫面座標實際移動。初始私有 clock 取值錯誤的 civilian-movement.json 留作失敗紀錄，不作通過依据。 |
| 流亡軍「流」 | PASS，含一般 labels off；上述新修正與 regression。 |
| 六文明外文明城堡 | PASS。正式 raid 取得／送達工匠，正式 craftsmen castle 建設；China／Britain／Byzantium／Mongolia／Japan／Frankia 均 owner 與 source 文明不同。foreign-castles.json、六張 foreign-castle-0～5.png 同時驗證名稱、文明圖與兵種。 |
| Raid 瞬時效果 | PASS。正式 resolution:0000000000000001.final／raid-return，沒有 active battle 但 visibleImpacts=1。raid-impact-live-CDP.png 為 Chrome 原生截圖，442ms capture 前後仍為 1；raid-CDP-and-reduced.json。普通 screenshot 捕獲較晚的 raid-impact.png 不作瞬時圖證據。 |
| Save／Load／Recovery 去重 | PASS。Production UI 立即保存、實際下載存檔、reload 載入進度、回復最新 checkpoint；同一 final resolution 保留，load／recovery 各 20 次採樣 visibleImpacts 全為 0。save-load-recovery.json、raid-final.realm-save、raid-load-no-replay.png、raid-recovery-no-replay.png、recovery-trace.zip。 |
| 敵軍情報遮蔽 | PASS。正式敵城 fixture 有 777 militia／111 scout 等明確 sentinel，未偵察時城市 panel 提示未知，出征對話只顯示玩家軍力；enemy-intel.json、enemy-intel-masked.png、enemy-dispatch-masked.png。 |
| 手機 viewport／觸控 | 桌面 Chrome 模擬 PASS。390×844 無橫向溢出；可信 CDP touch（isTrusted=true）拖曳位置改變，雙指 zoom 0.75→1.50；治理套用／停止成功。mobile-touch-reduced.json、20-mobile-map.png、21-mobile-touch-pinch.png、mobile-governance.png。 |
| reduced-motion | PASS。正式 siege 仍 visibleBattles=1，瞬時 Raid impact 被抑制；恢復 motion 後不重播，見 siege-reduced-motion.png、raid-reduced-motion.png、raid-CDP-and-reduced.json。 |
| 實體手機 | **MANUAL PENDING**；桌面 viewport／觸控模擬不能替代。 |

存檔與場景資料透過正式 codec／資料模型準備，回到 UI 匯入及真正 Worker 執行；證據區分受控場景和原報告的新遊戲／AI 自主行為。沒有據此宣稱長期 GPU／FPS、完整復國流程或 Astra Gate PASS。

## 測試及環境

Chrome 154.0.8037.98（Windows 真實 headed channel chrome），Playwright 1.64.0，既有安裝位於 `%TEMP%\lieguo-r3-playwright\node_modules\playwright\index.mjs`。沒有新增專案依賴。原 Vite 127.0.0.1:5173；最終 build 使用 preview 127.0.0.1:5174。final-chrome.mjs 的全新 context 阻擋 ServiceWorker，以確認載入最新 dist（runtime.worker-CPqSkQJI.js）。

| 檢查 | 結果 |
|---|---|
| 專項 regression | 140／140 PASS，regression-final.json |
| 完整 R3 相關及其餘可通過套件 | 163 檔，1095 PASS、1 SKIP、0 FAIL，r3-complete-regression-final.json |
| Typecheck／Production build | PASS，build-final.txt，tsc --noEmit、Vite 8.0.13 |
| 最終 Chrome | success=true，36／36治理套用＋6組停止，命令安全／商拓工／流標記全部通過；final-chrome.json |
| 最終 Chrome Console | 0 error／pageerror／requestfailed／HTTP error。3 warnings：2 Permissions-Policy 不認得功能、1 本驗證 context 阻擋 ServiceWorker，final-console.json。 |

全套 `vitest run` 曾失敗，原始 JSON 仍保留。降低 parallelism／指定生成文件目錄排除 Windows 寫檔干擾後，仍有 **3 項原基準已存在的 legacy art 預期失敗**：batch220.test.tsx 的 Lv4 art threshold；constructionArt.test.tsx 的 56 vs 52 coverage 及舊 farm castle-age path。原 commit 另行 git archive checkout 重跑可重現，baseline-regression.json。這兩個 legacy 檔未改預期／未改平衡；最終 R3 全面套件僅排除這兩檔，沒有宣稱全部測試通過。原基準的 Windows path slash 及 Canvas local triangle 斷言問題則作平台／測試修正，實際改驗 transform 後位置。

最終 R3 指令：

```powershell
$env:BUILDING_DETAIL_EVIDENCE='artifacts/r3-browser-delta-2026-10-13/generated-ui'
npx vitest run --exclude src/game/batch220.test.tsx --exclude src/game/constructionArt.test.tsx --maxWorkers=2 --testTimeout=30000 --reporter=json --outputFile=docs/validation/r3-delta-2026-10-12/r3-complete-regression-final.json
npm run build
node docs/validation/r3-delta-2026-10-12/final-chrome.mjs "$env:TEMP/lieguo-r3-playwright/node_modules/playwright/index.mjs"
```

Chrome 驅動與場景腳本保存在 browser.mjs／scenarios.mjs／final-chrome.mjs；前兩者為本輪交互工具，逐步操作完整保存在 actions.json。原失敗不刪除：錯誤 locator、Vite HMR 打斷、50X recovery 舊 checkpoint 被輪替拒絕（後以最新項目成功），以及 Production 上舊 harness import `/src/game/persistence.ts` 造成的一次 404。該 404 是測試工具錯誤，console.json 與 production-harness-import-error-trace.zip 保留；改以 native IndexedDB 讀取後最終全新 Chrome Console 無錯誤。

## 安全封存

本目錄 manifest.json 列出證據原檔 SHA256（包含不進 Git 的所有 ZIP trace）。原 r3-local 報告與 manifest 維持原檔。大型原 trace.zip 為 355,990,348 bytes，所有 Playwright ZIP 均依 .gitignore 排除普通 Git commit。

新封存目錄：`G:\Projects\Lieguo\artifacts\r3-browser-delta-2026-10-13\`。

- R3_Browser_Delta_Source.zip：新 commit 的 git archive，不包含 node_modules、dist 或 ignored trace。
- R3_Browser_Delta.bundle：本分支 Git bundle，保留原 R3 commit 及新 delta commit。
- R3_Browser_Delta_Evidence.zip：原 r3-local 與本 delta 原始證據（含大型 trace）。
- checkpoint.json、Browser_Delta_Fix_Report.md、SHA256SUMS：新 commit、檢查結果、封存 hash、bundle／ZIP 驗證記錄。checkpoint.json 是建立 commit 後的最終識別來源。

测试生成的旧 docs 已另存 generated-baseline-docs 與 generated-docs-preserved.json，再還原基線文件；未把平衡文件或歷史封存重產結果混進 delta。本地封存沒有推送遠端、沒有更新 Sites、沒有開始 R4／B9、沒有宣告 Astra Gate PASS。
