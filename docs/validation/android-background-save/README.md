# B10 P0：Android 背景保存與玩家提示

遊戲程式基準是 main `d5a6f544d87c0308c0105075f233bbfa0aeb1329`（已含 #62、#63、#64、#65）；交付前另同步最新 main `8b37f4d85e27f49d3d2a99d7cc9a10297d8d39d7`，新增內容僅為專案介紹／metadata，未改動遊戲程式。主要可玩修改固定於 `d86bce6d86d3e05b786f9046d587426e13760ef6`，診斷相容性追補固定於 `4176cbebdaee698d3ddc2ecb77244cf50615dd1d`；本批獨立 Draft PR，不合併或部署。

## 已確認的根因與錯誤路徑

先新增回歸，再修改程式。修改前，1X／10X／25X 的三個最小重現全部失敗，得到與玩家相同的 Zod 路徑：`["savedAt"]` 及 `["recovery",1,"at"]`，`expected integer / received float`。正式 Chromium 的修改前 build 亦重現，並取得軍團頁面的原始提示截圖。

1. `useGame` 將 `visibilitychange`／`pagehide` 的 `performance.timeOrigin + performance.now()` 傳給 Worker。
2. Worker 在排入 FIFO 前，以最早 `foregroundFence` 保留背景邊界；Performance API 的小數毫秒使 `Date.now() - (received - foregroundFence)` 也帶小數。
3. `away → advanceAndSave → Persistence.save → commit` 把該 `savedAt` 用於 Recovery Checkpoint、Authority Recovery Ref、World Row 及 Authority。
4. `putAuthority` 的整數／非負／安全整數驗證拒絕該值。整個 IndexedDB 交易回滾，原本的世界、帳本與 Recovery 保留；這不代表當次進度已成功保存。
5. 原本 `runRequest` 直接傳遞 `Error.message`，`useGame → GameApp.toast` 再把完整 Zod JSON 顯示為中央大型提示。六秒提示消失或一般 `state` 更新都不構成持久化成功證明。

精確測例：接收時間 `100.625ms`、背景邊界 `99.25ms`、牆鐘 `1700000010000ms`，原值是 `1700000009998.625ms`。修正後使用 `1700000009998ms`；世界時間仍是原公式 `floor(99.25 × speed)`，未提前捨去 Performance 精度。

## 時間規則與資料安全

`persistenceTime` 僅在 `commit` 入口執行一次：先拒絕非有限、負值及大於 `Number.MAX_SAFE_INTEGER` 的值，再 `Math.floor`。不把非法值改成零，亦不向未來進位。Worker 的高精度 fence／target 計算保留；非法的牆鐘結果不再由外層 `Math.max(0, …)` 靜默變成零。

同一次交易的所有保存時間使用同一個局部 `savedAt`，不是分別四捨五入。既有 Zod `.int().nonnegative().safe()`、Checksum、CAS、原子交易、Writer Lock、Ledger、T1／T2／T3、Durable Inbox、Replay Fence、Recovery 及離線公式不改。Persistence 的實際差異只有一行 import 與一行入口標準化；來源 Gate 另逐位元驗證其餘交易程式相同。未變更 Schema、Ruleset、世界或 DB 版本，也沒有修復不相容存檔的新路徑。

## 提示分類及恢復判定

| 類型 | 正式來源與顯示 |
|---|---|
| 成功 | 原 committed／duplicate Ack 的成功提示仍短時間消失；不把 T1 收件或一般投影當成保存成功。 |
| 可重試保存失敗 | `SaveHealth` 只觀察實際失敗；前景 Abort／Timeout 初期顯示「自動存檔暫時失敗，正在重試。」不改原輪詢／重試時程。相同狀態不重複通知。 |
| 手動處理 | 原 CommandFailure、投影同步、首頁／存檔管理的安全恢復流程保留；只對錯誤文字做安全格式化。沒有命令收件匣、正常命令計數或新管理選單。 |
| 持續或不可自動接續的保存失敗 | 連續三次暫時失敗、不可重試錯誤或背景保存失敗保留「目前無法保存進度，請勿關閉遊戲。」及保存／重新讀取、原始備份入口；收合後仍有可重開提示，不會自動消失。 |
| 確認恢復 | 只在真實保存交易（或正式 load/offline 接續、匯入／回復／開始交易）完成後，Worker 發出帶 `committed:true` 的狀態。Hook 要求該完成證據，才清除保存失敗並顯示「遊戲進度已恢復保存。」兩秒是顯示期限，不是恢復判定器。 |

Worker 保留原有 `error`／`notice` 事件及內部診斷內容，保存失敗另外標示 `saveFailure`；Hook 以獨立保存狀態呈現安全文字，不將該診斷重複顯示成普通提示。情報查詢等原本的內部錯誤契約不變。

`saveStatus` 與一般畫面投影／錯誤獨立，一般 `state` 不會清掉失敗。新 Worker 完成正式接續保存後也能解除前一個 Worker 的保存警告；未確認寫入的 `sync` Promise 仍拒絕，不假稱成功。原始備份僅含已寫入資料，不代表失敗中的草稿已保存。

同一筆原始診斷只保留一個普通 Toast；不同診斷即使轉成相同安全文案，也有不同通知事件，不會因文案相同而漏報。重大保存、命令恢復、投影恢復各自保留必要入口。診斷代碼可存在資料屬性，完整 JSON／Stack／路徑不進入玩家文字。字串在來源與渲染端均經過格式化，兩行 CSS 限制只是最後的版面保護。

正式錯誤顯示稽核包含 Worker／Hook、命令 Ack、預覽失敗、投影恢復、治理表單與本機存檔管理。更新流程原本已使用固定安全文案，保持原樣；地圖／情報的低階失敗不直接顯示原始 Worker 錯誤。歷史 DEMO 沒有改寫。

## Production Chromium 實測與截圖

Chromium 154、Production build、原生 Worker／IndexedDB。測試用故障只注入本機伺服器送出的 Worker 測試位元組，不進入遊戲產物；使用真正的 IDB 交易 abort，不偽造「保存成功」。腳本先核對 Worker 確實含有本次時間驗證，排除舊 build。

**9 組情境全通過**，完整數據：[browser-checks.json](browser-checks.json)。

- 1X／10X／25X 各 20 次前景／背景切換，混合 `visibilitychange`／`pagehide`、重複背景事件；有施工、100 名兵力訓練、科研及 99 AI。測試在正式切換完成後立即背景，確保以真正未完成工作開始，不修改工作時長。每次檢查所有持久化時間為安全整數、最新 Recovery／Authority／World Row 一致，結尾再使用正式 load 驗證且未走 Recovery fallback。
- 320×640、390×844、1440×900，城市／城郊、城內、軍隊、軍團、戰報、科技及世界地圖，共 21 份頁面／尺寸幾何記錄。通知上限 280px、在 HUD／底部導航之間、避開齒輪／盾牌完整範圍及主要操作中心。保護與齒輪程式沒有修改。
- 相同 Zod 診斷在關閉後連續 20 次不堆疊或重開；不同失敗仍顯示。關閉採用實際點擊，沒有 force click。
- 一次真實保存 Abort：原世界回滾，既有自動輪詢重試；讀到真正提交的新 revision 後才有恢復通知。
- 持續 Abort：原 revision 不變、警告可收合後持續保留超過普通 Toast 期限；關掉故障後點擊重試，驗證新 revision 真正持久化，才清除失敗。
- 建造提交後立刻背景／重複 pagehide／恢復，再做 Chromium 原生 freeze／active；正式結果只有一份，Authority 可驗證。

| 畫面 | 截圖 |
|---|---|
| 修改前 390px 軍團 | [原始大型技術提示](before-390-legion.png) |
| 修改後 390px 軍團 | [精簡安全文字](after-390-legion.png) |
| 320px／1440px | [窄手機](after-320-legion.png) · [桌面](after-1440-legion.png) |
| 暫時失敗／確認恢復／持續失敗 | [重試中](save-retrying-390.png) · [真實恢復](save-recovered-390.png) · [持續警告及操作](save-blocked-390.png) |

## 技術驗證與來源範圍

新增 39 項測試涵蓋時間有效範圍、精確 fence、所有資料表的回滾、舊 Recovery、正式讀取／匯出／匯入、T1 排在背景障礙之前、重複背景事件、保存健康分類、只有提交才能恢復、相同／不同診斷與收合入口。另保留既有 Worker／Durable Runtime／UI 測試；最終定向合計 8 檔、90 項全部通過。Typecheck／Production Build 已通過。

新來源證明僅接受 21 份固定 payload、三份檔案的診斷相容性追補之精確提交及五份確定性 Gate adapter，所有其他原始碼、美術、PWA、保護、規則與歷史紀錄鎖定原值。舊的來源範圍負向測試及完整性記錄均保留；沒有修改舊測試或期限。新防竄改測試及四組既有來源／防竄改回歸已通過。

2026-11-13 的最終 Production Chromium 複驗再次通過全部 9 組、60 次切換及 21 份幾何記錄；本目錄圖檔與 `browser-checks.json` 已更新，測試程式碼為 `bfd02f14bfe424156afe7138fd10679b3745f397`（後續同步 main 未變更任何遊戲程式）。

[GitHub CI #522](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/43374638340) 在 `bfd02f14bfe424156afe7138fd10679b3745f397` 全數通過：完整回歸 **2616 PASS／0 FAIL／1 SKIP**，以及 Typecheck、Build、Release、原有來源／防竄改／邊界 Gate。唯一 SKIP 為未提供的私人長局存檔。Cloud 本機初輪完整回歸曾因通知協定相容性失敗，修正後已由此完整 CI 重跑通過。另在 Cloud 逐檔定向重跑得到 128 PASS／2 FAIL；兩項 R3-06 一秒輪詢逾時在未修改 main 的同檔對照也為 8 PASS／2 FAIL，CI 完整回歸則通過，沒有放寬測試或期限。

完整 Regression 使用原 `node scripts/verify-in-isolation.mjs full`；GitHub CI 另跑全部歷史／來源／邊界、Typecheck、Build、Release／Worker Identity 與防竄改 Gate。最終 PASS／FAIL／SKIP 數量與 CI URL 追加在 PR 交付紀錄，未把在跑的檢查先宣稱為 PASS。

實際程式修改為 Persistence 入口、Worker 保存結果觀察、Hook 狀態／安全文字、GameApp 通知掛載，以及相關錯誤文字的渲染；新增 `persistenceTime`、`playerMessage`、`SaveHealth`、`GameNotices`。未修改 AI、戰鬥／經濟、倍速、建造／訓練、Schema、PWA／美術、保護或盾牌。

## 未驗證事項

Android 真機 App 切換、OS 殺掉背景程序、手機網址列／軟鍵盤、字型及低階硬體仍待實機。Chromium 的 viewport／事件與 freeze 測試不能代替 Android OS 認證。極端狹小可視區域可能需要捲動通知；持續保存失敗仍需玩家保留頁面並使用恢復入口。原有私人長局存檔缺少時的 SKIP、歷史 HOLD 與獨立 Gate 狀態保持不變，不宣稱正式驗收完成。
