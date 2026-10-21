# PR #24 中控最小 Delta：歷史資料保留更新

審查來源：[GPT-6 中控留言](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/24#issuecomment-6312483872)。審查基準 98c8511877cae8ba169178b64d19429c82ad4d2b；main a9cac1822abc29ee0e1772646f73b4bbca598f41 未變；PR #23 d41473fd9a8e138d0efdc2ef593e6ac0196b63d9 Open/Draft，工作樹與遠端均未修改。

## 根因與修正邊界

原探測將當前 namespace 與歷史 namespace 的所有資料合併成 stored/incompatible；即使資料已安全隔離且只供歷史保存，匯出後仍無法更新。這不是無存檔，也不應宣告保存成功。

新增 historical 結果，僅承認 PR #23 核准的 `lieguo-formal-stage2-time2` 當前 namespace 與 `lieguo-formal-stage2-schema1` 歷史 namespace。當前資料庫所有表皆空，歷史任一表有資料，才能顯示「保留歷史資料並載入新版」。任意其他 namespace 差異不能成為放行證據。**main 現在仍使用 schema1，所以其中資料依然屬於當前資料，不能由本修正跳過。** 沒有提前引入 PR #23 存檔版本或世界時鐘變更。

隔離依據：PR #23 的 FormalDatabase/active persistence 寫入 FORMAL_DB_NAME=time2，歷史 namespace 僅由 hasLegacyCampaign/exportLegacyCampaign 使用動態 schema 的 readonly transaction 讀取；新局、reset、Recovery 不以歷史 DB 為目的地。本 Delta 的探測與原始匯出亦只有 readonly transaction，沒有 delete/migrate/upgrade。這個已核准的版本邊界是固定白名單，不能把未知版本資料或損壞 current 當歷史封存。未更動 Service Worker 版本/contentSha 核對或啟用演算法。

| 讀取結果／狀態 | 操作 |
|---|---|
| 活動世界，ready | 相同 requestId 正式 sync → durable ACK；歷史確認不能繞過 |
| 當前 namespace 任一表有列，世界未載入 | stored/incompatible，繼續阻擋；包含 current、authority、僅備份、僅戰報 |
| time2 當前皆空、schema1 有歷史列 | 先確認保留；可取消或匯出原始備份，再更新 |
| 所有受檢資料表皆空 | 原有「載入新版」，不保存不存在的世界 |
| unreadable、loading、busy、locked，或（歷史確認路徑）未取得當前 writer lock | 安全阻擋；不可由歷史確認繞過 |

確認不是永久授權：Home 明確確認才把本次 consent 傳入 prepareUpdate，finally 清除。啟用前重新讀取所有受檢 namespace、檢查即時世界／busy／status 及已取得的 writer lock。確認期間出現 current、活動世界或讀取失敗，停止或改走正式保存，不丟棄進度。UI 的 historical 與 useAppUpdate 回傳值均與 no-campaign、durably saved 分開；等待啟用失敗時仍顯示「歷史資料原樣保留，未執行戰役保存」，不假稱已保存或沒有資料。

## 實際修改與保全

- campaignStorage.ts：白名單隔離邊界與當前資料優先，原始匯出不變。
- updateEligibility.ts：歷史確認入口，保留所有優先安全阻擋。
- useGame.ts：每次 fresh probe、明確 consent、writer lock、historical 準備結果；活動世界的 correlated durable sync 不變。
- FormalHome.tsx／GameApp.tsx：確認／取消／匯出與本次確認生命週期。
- useAppUpdate.ts：獨立 historical 結果文案，不改 PR #19 註冊／Worker identity／啟用邏輯。
- 專項測試與原有唯一受控繁中 note 增補；未新增第二份 note、未手動改版號。

Formal Worker、Persistence、formal 目錄、世界時間、AI、Receipt、CAS、Replay、Recovery 程式皆無差異。原有 FAIL/HOLD、35 組 AI 證據、DEMO、首次 Hotfix 9 情境與舊 raw data 均保留。C4 維持 HOLD。

## 驗證與限制

結果與重現腳本位於 evidence/review-delta/。Before 新增三項負向案例（legacy current／只有備份／只有戰報），原碼為 0 PASS / 3 FAIL；修正後更新安全專項 99 PASS / 0 FAIL（原 81 加 18）。正反例包含兩 namespace 共存、未知 namespace 不放行、當前損壞或不相容、讀取失敗、確認後出現世界、loading/busy/lock、Durable Save 失敗、取消／匯出／重試及不假報已保存。

原生測試使用合成 384×384、100 勢力（玩家＋99 AI）正式世界、真實 Worker／IndexedDB／Service Worker。為驗證 PR #23 namespace 契約，隔離副本只替換 FORMAL_DB_NAME，沒有修改 PR #23 分支或合併其 UI／Runtime。其他來源檔與本地 fce7c30e15c0d2899029b09a6e7fcd22f3703fed 相同；遠端對應 a44d10c62ec04b4aa90edc935495256fca91c657，tree 06de0e9d7c179345bcd4ed9d6dd5f3601f17d94b。正式 main namespace 副本另有負向檢查。fixture 的版本/content 身分改為合成 0.30.55/0.30.56 以測啟用；本機 dirty preview 的原始 release metadata 保存在 manifest，並非已部署版本。IndexedDB abort 注入僅在隔離副本，正式 dist 沒有故障程式。沒有上傳存檔本體、原始匯出、私人資料或 raw Chrome trace。

首次原生 8 PASS / 1 FAIL：保存失敗測試尚未進入 sync，舊 SW 重啟需要的舊 identity helper 在切換測試 server 時被移除而 404，準備失敗已安全阻擋，不能冒稱已測到 durable abort。保留首輪 JSON；測試 server 保留舊 helper 後重跑，仍須核對目標新版的 version/contentSha，未跳過 SW 驗證、未改正式程式、未放寬 timeout。第二輪 5 PASS / 4 FAIL，進一步定位 SimpleHTTP 的秒級 mtime 使不同 sw.js 回傳假 304（兩版本同秒、內容 hash 不同，保留 HTTP 紀錄與診斷）。僅修正測試 server 的條件式回應，實際瀏覽器 SW／Cache／IndexedDB 不清除；最終九情境全跑為 9 PASS / 0 FAIL / 0 pageerror，結果以 final-native.json 為準。

本機完整 Regression 首次啟動受執行沙箱 spawnSync git EPERM 阻擋（尚未跑測試），改用本環境可用的執行權限重啟原隔離指令，未修改 runner 或測試範圍。Pages 檢查首次漏設必要環境值，修正執行環境後原檢查通過，沒有修改檢查腳本。本機完整隔離為 1506 PASS / 8 FAIL / 1 SKIP，原始失敗摘要與 runner 輸出保留；失敗位於未更動的 formal/runtime.test.ts、formal/replayP0.test.ts（逾時與時序斷言），其後單檔重驗不冒稱本機完整全綠。Typecheck、Build、Pages、Release Metadata 與完整隔離結果見 validation.json；最新 PR HEAD 的完整 CI 以 Checks 為準。

Android 實機仍未驗證，不宣稱原玩家停用條件或 InvalidStateError 同根因已確認。與 PR #23 的 3 個交集仍須後續獲授權逐段整合及 UX-1 回歸；本次 namespace 副本不能替代合併版驗收。未 Approve、Merge、Deploy、關閉 Issue 或開始 B9。交中控複審後 STOP。

重驗指令曾因明列 `--testTimeout=30000` 被自動核准審查拒絕，理由是可能放寬既有 timeout；該指令沒有執行。其後改用不帶 timeout 參數的單 worker 定向指令，維持測試各自原有 timeout，不修改 runner、測試或斷言。

未放寬 timeout 的單 worker Runtime／Replay 定向重驗：100 PASS / 0 FAIL，見 runtime-retest.json。與原本完整本機 1506/8/1 分別列示，並未以重驗覆蓋失敗。
