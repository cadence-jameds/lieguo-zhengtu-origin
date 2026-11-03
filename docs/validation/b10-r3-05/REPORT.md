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

以下均為同環境前後比較，單位ms，p50 / p95。正式效能來源為 `eae7af8`（量測HEAD `ccbb384`）；之後僅修正Dexie匯入初始化邊界，演算法不變。最終HEAD另以完整回歸及原生故障流程確認。

| 歷史 | Recovery 前→後 | T1 前→後 | T2 前→後 | reopenLoad 前→後 |
|---:|---|---|---|---|
| 0 | 161.8 / 217.2 → 135.1 / 142.2 | 8.0 / 15.6 → 11.0 / 17.5 | 53.4 / 72.6 → 57.1 / 64.9 | 66.0 / 80.6 → 51.0 / 53.2 |
| 1000 | 296.9 / 316.4 → 209.5 / 244.5 | 7.9 / 11.5 → 8.5 / 11.7 | 59.6 / 81.4 → 56.8 / 74.3 | 152.7 / 185.0 → 113.2 / 142.5 |
| 10000 | 1559.7 / 1694.2 → 736.0 / 759.7 | 8.2 / 10.4 → 8.8 / 12.9 | 53.8 / 67.5 → 54.7 / 87.9 | 917.2 / 932.8 → 548.1 / 591.7 |
| 30000 | 4413.9 / 5149.5 → 1936.2 / 2194.2 | 7.3 / 11.6 → 9.1 / 12.8 | 50.9 / 57.2 → 55.9 / 79.4 | 2729.9 / 3147.3 → 1722.1 / 2196.3 |
| 60000 | 8806.9 / 9627.0 → 3632.2 / 4031.9 | 6.9 / 9.9 → 9.3 / 12.3 | 53.0 / 63.0 → 55.6 / 67.0 | 5437.8 / 7039.5 → 2988.9 / 3264.6 |

原生暖操作T1/T2/query/rejected/needs-confirmation各20次，Recovery及匯入匯出各5次；start只有1次診斷，不當百分位驗收。完整0～60k樣本及inclusive分解見 [native-perf.json](native-perf.json)。60k Recovery p95改善58.1%，達本組30%目標；普通T2沒有明顯改善，53.0/63.0→55.6/67.0，沒有宣稱所有操作都加速。無效果rejected T2為42.8/50.8，needs-confirmation為42.6/50.1，仍有完整身份。

| 60k 操作（各5次） | 前 | 後 |
|---|---:|---:|
| Quick Export | 6596.3 / 8514.9 | 1524.6 / 1876.9 |
| Full Export | 6508.0 / 8740.2 | 1830.1 / 2132.0 |
| Quick Import，模組溫熱 | 13603.5 / 16018.2 | 5148.3 / 5243.5 |
| Full Import，模組溫熱 | 14009.9 / 14503.6 | 5344.6 / 6408.5 |
| Quick Import，真冷Worker、固定舊版檔案 | 17940.7 / 18648.5 | 11976.1 / 12619.3 |
| Full Import，真冷Worker、固定舊版檔案 | 17819.4 / 20004.4 | 12119.5 / 12685.1 |
| 真GameApp冷啟動至城市可操作 | 8324.2 / 9117.8 | 7475.2 / 11525.2 |

冷匯入另計fetch/UTF-8 decode；完整0～60k樣本與固定檔案SHA-256見 [native-cold-import.json](native-cold-import.json)。正式Quick/Full限制仍100MiB；本60k合成Quick約44.3MB，不和不同fixture的舊46MB宣稱精確壓縮比。

**冷載入p95與Long Task目標未達標**：真GameApp每組5次，60k median約改善10.2%，p95反而退步26.4%。Main Long Task最大由125ms到795ms，不能宣稱避免50ms長任務。完整樣本／Main heap／cgroup採樣／載入進度見 [native-cold.json](native-cold.json)。額外單筆Main CDP診斷可操作約7.56秒、最大111ms，未重現795ms；sampled CPU多為等待（6.27秒）、React JSX開發模式（155ms）、CityScenes（56ms）及GC（40ms）。這只是單次診斷，不能證明原離群值原因或替代失敗樣本。未修改R3-04展示架構來迴避結果。

Node/fake-IDB全流程單次細分診斷見 [node-profile.json](node-profile.json)：elapsed74.47→33.00秒，整個工具程序maxRSS2,348,816→1,641,904KiB，觀察GC3803次/8419.95ms→1198次/4305.89ms。不是原生裝置p95，也不是純Worker retained heap。schema、canonical/checksum、JSON parse/encode、顯式clone及IDB各階段保留inclusive計時，不能相加當獨立耗時；Native Worker GC/內部structured clone無法獨立精確量測。

PR57同環境基準：本機2378 PASS／2 TIMEOUT／1 SKIP（150k原120秒、Runtime原30秒），CI2380 PASS／0 FAIL／1 SKIP。這些結果保留，不把單項PASS當完整回歸PASS。本批最終隔離結果及CI以PR驗證留言為準。

## 驗證追蹤

最終本機定向（23個測試檔、隔離副本、2 workers、原30秒期限）325 PASS / 0 FAIL。新增匯入順序案例確認fixture/schema/codec純依賴不提前初始化Dexie。原生未插樁IndexedDB故障9項PASS：T1 quota、T2 11邊界全abort、Manifest/Segment/Results損毀、derived index/世界checksum、export/import/restore實際terminate、舊writer、雙頁正式Web Lock。

首輪CI run41576115895為2286 PASS / 119 FAIL / 1 SKIP，保留失敗記錄。共同錯誤是LedgerStore新增runtime Dexie import使既有純fixture路徑在fake-indexeddb安裝前捕捉缺失API；已恢復type-only import，透過實際DB constructor取得同一公開currentTransaction getter，舊測試不修改。新增順序測試及既有review/save隔離案例皆在325項內。最終完整隔離與CI另以PR固定驗證留言記錄，未結束前不能稱Gate PASS。

瀏覽器驗證工具首輪依賴預打包reload造成一次module fetch失敗，重試後執行；雙分頁工具曾讓第二頁載入真正GameApp、競爭自己正在測試的Web Lock，改為對兩頁使用同一空白測試route並等待lock callback完全釋放。未改正式鎖或降低斷言。

## 失敗紀錄與剩餘範圍

省略world clone曾導致來源revision被stamp，五項原有匯入／Recovery斷言失敗；已恢復原clone，原測試不改後通過。連續多history size的原生重型基準曾30k OOM，改為每組獨立browser並逐筆保存，前後相同方法、相同配額；原失敗不隱藏。測量工具亦曾未等第二個Blob下載完成而缺失Full fixture，舊codec拒絕HTML回應；修正測量輸出等待，不是放寬正式存檔檢查。

完整歷史冷驗證、匯出／匯入仍O(歷史)，必要byte核對與Root驗證不能刪除；warm證明重用仍比較實際完整資料。Quick/Full依舊100MiB上限，資料長期成長可能超限並明確拒絕匯出；未實作壓縮或新串流格式。永久immutable損毀不自動修復。

R3-06仍負責AI catch-up／victory計算與排程競爭；本批不改AI決策、Scheduler、速度或事件順序。Android實機、長期真quota與純Worker retained heap仍待驗。B5 E1 HOLD／Astra未PASS／實體手機未驗保留；Draft不代表發布驗收。

原生量測另攔下高密度區段bulk clone回退：0974106的60k Recovery p95約7.60秒，對9.63秒基準僅約21%改善，未達30%目標。依實際readLedgerArchive耗時由約0.4升到1.7秒，改為只對稀疏鏈合併讀取，高密度鏈保留逐鏈讀取。25項新增定向與Typecheck通過；原097數據保留，不能冒稱最後來源結果。

## 九項交付答案

1. 60k Recovery：同環境8.807/9.627秒→3.632/4.032秒，p95改善58.1%；與舊R3-04不同批9.58/11.93秒不做精確比例。
2. 60k真冷可操作：8.324/9.118秒→7.475/11.525秒；median改善、p95退步，Long Task仍未達標。
3. 消除多個同版本重複canonical/驗證與同交易共享區段重讀；不是消除全部O(歷史)。暖proof仍逐欄位核對實際資料，冷啟動仍完整驗證。
4. T2維持單一原子交易與Root/Writer CAS；正式故障注入、去重、Ack遺失及Recovery回歸結果以驗證留言為準。
5. Quick/Full仍100MiB；未引入新封裝/壓縮/串流，未來長期成長仍可能達上限，明確拒絕不安全輸出。
6. 150k/120秒：以最終完整隔離runner結果為準，未提高期限/heap或減少資料。
7. Runtime/30秒：以最終完整隔離runner結果為準，未修改AI或Scheduler。
8. 無新DB/Schema/Save Format；舊R3-03正式格式保留，跨source往返另驗。永久不可變區段損毀仍拒絕載入，無自動修復。
9. R3-06範圍仍為AI catch-up/victory與CPU排程競爭；主執行緒開發模式render長任務及Android實機另列限制，不冒稱本批全部解決。

原生未插樁R3-04完整六組正式流程全數PASS，含真GameApp 60k載入、建造預覽/Inbox、丟失Ack/最後畫面、Worker重啟及無transitionId背景Recovery。舊source dfa574a的Full→本批匯入/再Full→舊source匯入均PASS，1001收據及committed/rejected/needs-confirmation原始結果保留且舊ID仍duplicate。[原生正確性與相容摘要](native-correctness.json)。真GameApp量測為Vite開發模式，Production Build/Pages/Release另驗，不外推正式裝置SLA。
