# 特殊資源地塊 UX 修正驗證

基準 main：`87b2877215655e3cc4f050624e1463fcdb1ab9fd`（已合併 PR #22、#24）。獨立分支 `fix/special-field-map-ux-20261021`。PR #23 的 Draft 分支未修改。

## 完成內容

- 七田型不再分類、繪製或提供選項；舊本地偏好的 `seven` 安全忽略。七田地塊及正式 `fieldDistribution` 完全保留。
- 九田紫色、十五田金黃色：**整個菱形地塊半透明填色**，搭配固定 14 CSS px 淺色文字與 3.5 px 深色描邊；沒有矩形文字底框。色塊在政治版圖下，文字在選取光暈上，城市、軍隊與原有標示保持較高繪製優先序。
- 選單唯一說明段落為「特殊資源地塊請放大後查看。」
- 總開關仍預設關閉；九田／十五田可分別切換並保存。本輪沒有修改 Formal 引擎、世界生成、時鐘、AI、戰鬥或存檔契約。

## LOD 與效能邊界

原本以包含城市繪圖外擴的查詢框套用 4,096 格門檻，桌面及手機在 75% 縮放都直接隱藏特殊地塊。本次特殊地塊獨立使用實際視窗範圍，維持逐格螢幕剔除及既有 8,192 項 LRU，查詢框預算改為 16,384 格。全區視角仍不計算特殊地塊，不掃描完整 147,456 格。動態城市／據點／拓殖預約及正式可建城地形判斷保留，不快取動態占用資格。

同一合成世界（seed 92049，玩家＋99 AI）、Chromium、桌面 1440×900／手機模擬 390×844：

| 75% 視角 | 修改前 | 修改後實際訪問／標記 | 快取項目 |
| --- | --- | --- | --- |
| 桌面 | LOD 隱藏，0 標記 | 4,109／60 | 7,982 |
| 手機 | LOD 隱藏，0 標記 | 1,039／12 | 2,052 |

最遠全區視角：0 次訪問、0 次分類 cache miss；預設關閉亦為 0。以下為候選版固定世界，關／開／開／關交錯拖曳，各輪 12 筆 Canvas 繪圖 CPU 耗時（ms）：

| 裝置 | 關 p50／max | 開 p50／max | 開 p50／max | 關 p50／max |
| --- | --- | --- | --- | --- |
| 桌面 | 8.9／22.3 | 14.1／29.7 | 11.5／13.4 | 9.2／17.0 |
| 手機模擬 | 7.5／19.9 | 5.1／12.6 | 6.1／17.2 | 4.3／12.7 |

12 筆輪次的 p95 等於 max，所有原始樣本保留在 after-browser.json。這是有限次繪圖 CPU 採樣，不能視為 GPU FPS、真機保證或 C4 指令完整延遲。修改前中倍率沒有繪製標記，因此跨版本不是相同繪圖工作量，不據此宣稱效能提升。C4 維持 HOLD。

## 驗證與歷史失敗

- 新增負向案例於修改前：5 PASS／2 FAIL；確認七田分類／偏好及中倍率隱藏問題。
- 最終程式 5 組地圖定向測試：18 PASS／0 FAIL。
- 初輪定向測試曾因並行瀏覽器負載觸發既有 overview 測試 5 秒逾時（19 PASS／1 FAIL）；原 timeout 及案例未變，單獨重驗 5 PASS／0 FAIL，後續串行組 20 PASS／0 FAIL。初始失敗與重驗均保留。
- 最終 Production Build（含 Typecheck）成功；Pages 路徑、PWA scope／fallback、Release Metadata 與 Worker 身分一致性通過。Pages 首次命令漏設必要 CI 環境變數，程式在檢查前拒絕；補正環境重驗通過，原失敗保留。
- 原生 Chromium／IndexedDB／Worker 桌面與手機兩組 PASS，無 pageerror：八種 9／15 資源逐一置中、檢查文字、點擊實際格子並核對詳情資源數；七田無標示但實際詳情仍為七田；分類互斥、重新載入偏好與最愛 1/5 保留；帝國版圖疊圖及全區 LOD 正常。
- 新本地偏好總開關預設關閉；原生 CDP 雙指縮放、單指拖曳及不誤開格子對話框 PASS，無 pageerror。Android 實機未驗。
- 完整隔離 Regression 及 GitHub CI 結果見本 PR Checks 與後續補充記錄；未更改測試 timeout 或忽略失敗。

## 證據來源與重現

`screenshots/` 為已人工檢視的合成世界修改前後畫面，沒有玩家私人存檔。`evidence/public-coordinates.json` 提供八類位置及版圖樣本；`evidence/` 保存 browser／touch 結果、測試 JSON、建置及路徑日誌，SHA-256 清單見 evidence-sha256.json。

修改前畫面及 native browser 對應 main SHA；修改後對應本地 source `f1b95fd4b1994df42a81f95b438c6110f872352d`。透過 GitHub connector 保存的相同 source tree `6f2b70f27a5c65b836007bca731850fdac1c2d83` 對應遠端 commit `f1fccf8c9a99c27fab7a5116faf0754d9f28afa8`；檔案 blob 及整棵 tree 雜湊已核對相同，作者／提交時間造成 Commit SHA 不同。文件證據提交不變更程式。

瀏覽器證據由 production dist 以 `/lieguo-zhengtu-origin/` 路徑提供。合成 fixture 由既有公開 controlled fixture 經正式 decode／encode 及 terrain API 製作；測試腳本保存在 evidence/（內含此工作區本地路徑，重跑時需調整路徑、啟動對應 server，fixture.json 未上傳）。沒有公開原始存檔／瀏覽器 trace／dist。

本地 source 含數次功能 checkpoint，建置顯示 v0.30.60 預覽；正式 PR merge candidate 將由既有自動版本機制決定。未手改版號、未宣稱已發布。

## 截圖

| 視角 | 修改前 | 修改後 |
| --- | --- | --- |
| 桌面 75% | [before](screenshots/before-desktop-medium.jpg) | [after](screenshots/after-desktop-medium.jpg) |
| 手機 75% | [before](screenshots/before-mobile-medium.jpg) | [after](screenshots/after-mobile-medium.jpg) |
| 手機 150% | [before](screenshots/before-mobile-close.jpg) | [after](screenshots/after-mobile-close.jpg) |

[桌面 150%](screenshots/after-desktop-close.jpg) · [桌面選單](screenshots/after-desktop-menu.jpg) · [手機選單](screenshots/after-mobile-menu.jpg) · [桌面版圖](screenshots/after-desktop-territory.jpg) · [手機版圖](screenshots/after-mobile-territory.jpg)

等待中控視覺審查及 Android 真機驗收；未 Merge、Deploy、修改 main 或開始 B9。
