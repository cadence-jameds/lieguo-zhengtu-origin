# R3-05 Persistence（Draft）

Base：PR57 `dfa574a4de24fe9069df2a90d3edae6a64f191da`／`feat/b10-r3-04-ui-projection`。本分支 `feat/b10-r3-05-persistence-optimization`。交付HEAD、最終完整隔離與CI結果以PR最終驗證留言為準；未完成不算PASS。未合併、未部署、未開始R3-06。

## 正式變更

[契約](CONTRACT.md)／[修改前實際成本分解](PROFILE.md)。FormalPersistence仍是唯一Runtime使用的儲存入口；DB `lieguo-formal-ledger-v1`、Dexie3、Save `lieguo-formal-ledger-save-v1`、SHA-256、Manifest／Original Result／Branch Disposition均保留。無Migration或新帳本格式。

1. `ledgerStore.ts`：512筆keyset身份讀取；少數變更保持分批精確點查，只有全面修復／至少半數身份才範圍讀取。未知、缺失、issuer、fingerprint、原始結果與receipt都核對；不清空索引或歷史。
2. `LedgerReadSession`：只在同一真IDB transaction／DB內重用已讀raw區段。對大量一命令一區段的鏈，依所需數量與實際campaign區段數選擇合併讀取，仍按Manifest精確鏈序驗證；小舊checkpoint不讀取大量未來歷史。
3. `commandLedger.ts`：若實際讀出的整個版本與不可變、已驗證的完整版本逐欄位／陣列／shape完全相同，重用該Root證明。不是只看Revision、Root標籤、物件引用或最新Head。冷Worker無記憶體證明時完整驗證；任何差異／未知undefined欄位仍走完整驗證並拒絕損毀。
4. `jsonDataEqual.ts`：用等價資料比對取代大型中間canonical字串；證明重用使用更嚴格的shape比較。不是以這個比較取代checksum。
5. `canonicalBytes.ts`／`canonical.ts`：digest保留完全相同的canonical UTF-8 bytes與SHA-256，以有界文字片段降低大型字串配置。正式JSON輸出、所有checksum與新舊codec相容性不變。
6. `persistence.ts`：Recovery對已隔離／不可變收據重用資料；保留原world clone，避免改變來源revision與Recovery點選取。讀取進度限20階段，顯示觀察者失敗不能誤觸Recovery。
7. Runtime僅將已有read階段進度顯示為百分比；未修改命令排隊、Admission、WorldStream或Preview。

## 原子性與故障恢復

T1快速持久接收、原始Payload／Fingerprint、CommandId、FIFO、Writer Epoch／CAS、有限重試與每筆等待保留。普通T1不做全歷史掃描。

T2仍是相同表集合的一個rw交易，世界、Authority、Inbox、精確身份、Segment、結果、Manifest／Head、Recovery、戰報及metadata一起commit或abort。沒有交易外發布或權威暫存；舊準備結果在同Revision但Root已變時仍被CAS拒絕。批次I/O保持逐區段碰撞比對及全部故障點。T3仍只通知與修復查詢快取，不改不可變原始結果。

`persistenceOptimizationR305.test.ts`對照舊canonical bytes／checksum，測試512邊界、空損毀key、跨交易cache拒絕、實際byte變更／未知欄位、same-revision Root CAS、每個T2寫入故障與唯一效果、Recovery原始結果／派生索引修復、Quick/Full無效果結果、進度失包，以及500筆少數變更不掃描無關歷史。原有規則、Ledger、可靠命令與UI測試不放寬。

原生故障工具涵蓋T1 quota、T2全部正式寫入邊界、immutable Manifest／Segment／Results損毀、派生Index及世界checksum、真正Worker在匯入／Recovery交易中止、匯出中斷、多頁Web Lock與舊writer。永久不可變資料損毀仍拒絕載入並保留原DB，沒有自動修復；完整備份可在獨立乾淨儲存空間恢復。

## 量測方法

Node22.23.4、Linux、CPU quota2（200000/100000）、8GiB、預設Node heap2,197,815,296 bytes；Chromium154，未使用Android實機。沒有增加原有test timeout、workers、heap或減少150k資料。

前後均直接跑正式Persistence／Codec／LedgerStore。唯讀profile transform只加計時，正式來源未寫入profile hooks；fault／互動回歸另以未插樁來源執行。nested階段包含時間不可相加。IndexedDB內部clone包含在實際read/write計時，沒有假裝能獨立精確量出。

- 原生storage：100勢力／99AI已建立／25X，0/1k/10k/30k/60k，各暖操作20次、重型操作5次。此組時間不推進AI；99AI同時補算／儲存競爭由真Runtime互動回歸另驗。
- `reopenLoad`是重新開啟DB、模組cache可能溫熱，**不是新Worker冷啟動**。
- 真GameApp冷啟動每筆用新瀏覽器與新權威Worker，先由另一個已終止Worker寫入相同fixture，記錄至可操作城市；包含必要離線補算與最後T2，另列phase。
- 冷匯入每筆新瀏覽器／Worker／DB，讀相同舊source匯出的固定檔案；fetch／UTF-8 decode、import（含parse／transport hash／完整驗證／T2）及reopen分列。不是重複匯入已在cache中的Root。
- Node／fake-indexeddb只作CPU／GC診斷，不能當原生延遲；主程序RSS／heap含Vite與工具。Native cgroup採樣含server／browser／OS cache，不是純retained JS heap；Main heap亦不代表Worker heap或Android需求。

合成歷史主要128筆packing，另以真正逐命令提交的稀疏區段驗證不再逐一IDB get。沒有將packed微基準假裝為所有未來歷史形狀。

## 數據與Gate

最終數據、樣本數、版本與完整檢查結果隨交付摘要補齊。初輪source 6c95eca的60k原生Recovery3.765/3.921秒，基準8.807/9.627秒；這是早期觀察，不冒稱最後HEAD結果。

PR57同環境基準：本機2378 PASS／2 TIMEOUT／1 SKIP（150k原120秒、Runtime原30秒），CI2380 PASS／0 FAIL／1 SKIP。這些結果保留，不把單項PASS當完整回歸PASS。本批最終隔離結果及CI以PR驗證留言為準。

## 失敗紀錄與剩餘範圍

省略world clone曾導致來源revision被stamp，五項原有匯入／Recovery斷言失敗；已恢復原clone，原測試不改後通過。連續多history size的原生重型基準曾30k OOM，改為每組獨立browser並逐筆保存，前後相同方法、相同配額；原失敗不隱藏。測量工具亦曾未等第二個Blob下載完成而缺失Full fixture，舊codec拒絕HTML回應；修正測量輸出等待，不是放寬正式存檔檢查。

完整歷史冷驗證、匯出／匯入仍O(歷史)，必要byte核對與Root驗證不能刪除；warm證明重用仍比較實際完整資料。Quick/Full依舊100MiB上限，資料長期成長可能超限並明確拒絕匯出；未實作壓縮或新串流格式。永久immutable損毀不自動修復。

R3-06仍負責AI catch-up／victory計算與排程競爭；本批不改AI決策、Scheduler、速度或事件順序。Android實機、長期真quota與純Worker retained heap仍待驗。B5 E1 HOLD／Astra未PASS／實體手機未驗保留；Draft不代表發布驗收。
