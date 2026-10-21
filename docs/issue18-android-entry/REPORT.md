# Issue #18 Android 更新入口 Hotfix

基準 main：a9cac1822abc29ee0e1772646f73b4bbca598f41。PR #22 已合併，main CI 39546062283及Pages 39546062255均成功，正式為v0.30.56。施工位置 /workspace/lieguo-issue18，分支 fix/issue18-android-update-entry-20261021，獨立 Draft PR #24。PR #23仍為Draft，遠端HEAD d41473fd9a8e138d0efdc2ef593e6ac0196b63d9未修改；本機UX-1工作樹亦未修改。

## 根因、已知範圍與真機限制

原始GameApp以busy／updating／loading／error控制按鈕，並非world=null本身會停用更新；在ready且確實沒有戰役時，原本的no-campaign分支已可運作。FormalHome卻對所有world=null（包含讀取中、錯誤、不相容及其他尚有資料的情況）顯示「尚無本機進度」。因此玩家那句提示不能證明沒有舊資料，也不能由此判定是哪個停用flag。

原生Chromium實際讓Formal Worker在空世界處理sync，收到「請先建立正式世界。」：busy=false、updating=false、loading=false、error=true且三個正式資料表皆空。這能重現同樣的停用按鈕與誤導提示，確定error分支可以造成此症狀。但沒有玩家裝置DevTools／runtime trace，不能聲稱玩家實機就是此觸發，也不能斷言與前次InvalidStateError同根因。Hotfix新增可見的停用原因與data-update-gate代碼，供真機逐項核對。

另在真實IndexedDB交易abort驗證發現：保存沒有成功、沒有啟用或導航，但先前開始的metadata檢查會在更新失敗後覆蓋錯誤文字。0aa02e1原始追蹤及負向單測均保留。加入更新嘗試序號，舊檢查不得覆蓋新嘗試；失敗結果優先於背景刷新，直到玩家明確檢查／重試。保存錯誤以繁中顯示，內部Promise仍保留實際錯誤供診斷，沒有偽造成功。

## 最小修改

- campaignStorage.ts：只讀正式資料庫的current、備份、戰報與authority存在性；所有資料表皆空才能判定empty。缺少current但仍有備份／收據時為stored。無法讀取不視為空。metadata不支援另列incompatible。沒有load、修復、遷移或刪除。
- updateEligibility.ts：保留busy、loading、locked及updating阻擋。活動戰役的error仍阻擋；只有經讀取確認空資料且沒有使用中世界時可直接更新。
- useGame.prepareUpdate：每次啟用前重新讀取空資料證據，重查即時狀態及待受理指令；有活動世界則走原有sync，等待相同requestId的durable ACK。狀態切換、讀取失敗或新出現的戰役均拒絕。
- GameApp／FormalHome：空資料使用「載入新版」，不承諾不存在的保存；區分讀取中／資料存在但未載入／版本不相容／其他引擎錯誤，提供保留資料的重讀與原始備份。更新期間暫停新的遊玩操作。
- 原始備份為lieguo-recovery-archive-v1，逐資料庫保存原始表列，不能當正式world匯入，不包含尚未成功落盤的狀態；沒有改寫舊存檔。FORMAL_DB_NAME若於PR #23改名，仍檢查歷史正式namespace以防舊資料被誤當不存在。
- useAppUpdate保留PR #19的版本/contentSha核對、有限重取同scope註冊、save-before-re-register、等待啟用及重複點擊防護。沒有unregister或Cache Storage清除。

Formal Worker、Persistence、正式Reducer／Scheduler／Save Codec／World時鐘／AI／存檔版本均無程式差異。沒有移入PR #23的速度、離線、強制新局或齒輪功能。

## Before／After驗證

| 檢查 | 結果 | 證據 |
|---|---|---|
| 原始首頁狀態／直接更新文案 | Before 0通過、3失敗 | before-home.json |
| 保存失敗後metadata晚回應 | Before 0通過、1失敗 | before-late-check.json |
| 更新、資料存在性、原有hook／Worker ACK定向回歸 | After 81通過、0失敗 | targeted-race-final.json |
| 繁中保存失敗顯示與原錯誤Promise | 1通過（上述案例子集，不另相加） | localized-save-error.json |
| 原生Chromium／SW／Worker／IndexedDB | 9情境成功：1個before重現＋8個after驗證；0失敗，0 pageerror | native/result.json、9張畫面 |
| Typecheck、Production Build、Pages路徑、Release Metadata | 通過 | CI及本機記錄 |

原生覆蓋：空資料直接更新不送sync；有戰役的busy阻擋；native讀寫交易暫時卡住時不能提前ACK／啟用；雙擊只有一次sync；durable ACK→SKIP_WAITING→controllerchange→導航；實際交易abort無ACK／啟用／導航；不相容資料及原始匯出與三個資料表逐筆相同；loading解除後才可更新；已失效註冊及元件503失敗後安全重試；新版版本與更新資訊符合目標artifact；手機390×844及桌面1440×900無橫向溢出。

失效註冊原生測試實際收到TypeError。InvalidStateError、候選元件未就緒、等待啟用／逾時、worker變更、docs-only waiting與後續真更新等維持原有useAppUpdate專項回歸；沒有將TypeError或這次按鈕問題改稱已重現Android InvalidStateError。測試中只有隔離localhost profile的單一scope註冊被刻意unregister，應用程式沒有這種操作。

第一輪原生為8成功／1失敗：保存已阻擋但失敗訊息遭覆蓋，已修正。第二輪為4成功／5失敗：測試硬編碼期待正式Hotfix標題，但尚未合併的第二個本機功能commit依既有發行規則顯示「遊戲建置預覽」；改成核對實際目標artifact的version、title與最新note，未改正式發行邏輯、未偽造ACK、未放寬timeout。兩輪原始JSON完整保留；最終9個情境全部重跑通過。早期首頁測試也曾誤將ReleaseLog歷史文案當成操作按鈕，改成核對實際button，歷史Release Notes未修改。

原生對照fixture僅在隔離副本改標籤為0.30.55／0.30.56、內容識別與precache revision，重現玩家版本跨度；最終程式來源固定本機6c3a34fb839e7323afe5969785431bc5dee07916（與GitHub79b321c21ba090bf16ad9aa4c872df9d0c6ea8ec相同程式樹9a08df59eb6b9e2327e2a50cbe456f7aab2cf891）。故障副本只在sync時注入真正native transaction.abort；正式Production dist沒有這個測試程式。未上傳合成存檔本體／歷史匯出檔／私人存檔／原始瀏覽器trace。

初版CI 39560120064：1494通過、0失敗、1skip，Typecheck／Build／Pages／Metadata通過；新增晚回應修正後的完整隔離CI 39561288966為1496通過、0失敗、1skip，所有步驟成功；最終證據提交的CI另以最新HEAD為準。完整Regression只依原有隔離機制及原timeout執行，沒有略過必要測試。CI的merge candidate重用PR受控JSON，候選v0.30.57；本機多個功能commit的未合併預覽為v0.30.58，未手動改版本號，兩者均不表示已部署。

## 真機待人工驗收

沒有Android實機環境，沒有真機PASS。需在Android Chrome確認：玩家原本是哪個busy/loading/error/updating條件；無戰役及有戰役兩條更新路徑；背景／回前景、重開PWA；失敗重試後版本／更新資訊與備份保留。若目前仍卡在舊程式，先備份（若可），檢查新版下載後可關閉同站所有分頁／PWA再重開；不得清除網站資料、IndexedDB、Cache Storage或要求重新安裝。這是供玩家核對的保全步驟，不保證每個裝置一次恢復。

本輪未Approve／Merge／Deploy／關閉Issue／開始B9。C4持續HOLD，既有Gate及歷史證據不變。
