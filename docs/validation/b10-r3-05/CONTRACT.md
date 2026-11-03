# R3-05 Persistence 契約

以 PR57 dfa574a 為基準，維持 database `lieguo-formal-ledger-v1`、Dexie3、save `lieguo-formal-ledger-save-v1`、Ledger／Manifest格式及100MiB上限。Schema、SaveCodec、Reducer、Scheduler、AI策略與R3-04展示協定不變。

## 資料與信任邊界

冷載入讀取正式DB實際bytes、驗證Manifest／區段／結果／Snapshot、核對全部Identity與Authority後才能交給Runtime。512筆keyset page降低native clone峰值，每筆只訪問一次；首筆包含空字串損毀key，不能因分頁而漏掉異常身份。缺失、額外、issuer／fingerprint／原始結果／receipt差異仍拒絕正常載入，必要時依原策略選擇可驗證Recovery。

交易內LedgerReadSession綁定實際IDBTransaction和DB實例；只重用本次一致讀取已取得的raw row，不是證明。下一交易不得重用，即使root相同。讀到的所有資料仍須驗證。read session只在該操作存在，沒有跨版本無界內容快取。

Verified Ledger仍只有原驗證／準備程序能建立。以不可變、帶checksum／正式Root的完整已驗證版本作對照，只有本次實際讀出的**每個欄位、陣列項目與欄位集合**完全相同才能重用證明。不只比較Revision、checksum標籤、物件引用或最新Head。未知undefined欄位也不能被canonical equality忽略。沒有該版本證明時完整執行既有Schema／digest／索引建構；任一差異走完整驗證並按原規則拒絕損毀。冷Worker沒有記憶體證明，無法跳過驗證。

## T1／T2／T3

T1原本的精確身份點查、Durable Inbox、原始Payload／Fingerprint、FIFO、writer epoch、branch、CAS及逾時恢復不變，不等待歷史分頁掃描。少數Identity即使超過256筆仍分批精確bulkGet，不掃描無關長歷史；全面修復或需要至少半數結果時使用keyset pages比對期望完整身份，保留未知／缺失／損毀索引修復行為，不清空歷史。

T2仍是原本單一rw交易，表集合不變。世界、Authority、Inbox、Identity、Segment、結果、Manifest／Head、Recovery、戰報與metadata全數成功或全數abort。預先持有的Verified proof不是提交；交易內原writer／revision／root檢查保留。不可變區段bulk讀寫只合併請求，仍逐一比對實際既有內容並保留故障注入點；任一故障回滾整個交易。沒有交易外部分發布、權威暫存或第二套帳本。

T3 Ack／畫面失敗不更改原始結果。讀取進度限20階段；觀察者失敗不能被誤判為存檔損毀並觸發Recovery。R3-04最後Ack高於畫面的有界Snapshot追補保持原行為。

## 編碼與相容性

checksum仍SHA-256、相同canonical編碼。digest按有界文字片段轉UTF-8，再提供給既有SubtleCrypto；避免大型canonical文字與Byte Buffer同時長期保留。正式輸出字串、欄位、順序語意、metadata、Root和100MiB檢查不變，舊R3-03/04新版存檔不需要Migration。

正式Quick／Full仍包含全部命令身份及原始拒絕結果、Inbox、全部廣告Recovery引用與必要權威。保留超限拒絕，不能產出無法重新匯入的成功檔。長歷史整體匯出仍O(歷史)，未宣稱無容量限制或全串流API。

## 施工中被測試拒絕的最佳化

嘗試省略world clone使來源revision也被stamp，影響匯入Recovery點篩選；既有0/1k/10k/30k/60k五項斷言攔下。已恢復原clone，原測試不變後通過。這不是最終行為，不以玩法或測試變更規避。

基準連續多組重型原生測量曾在30k OOM，保留失敗並改成每個history size獨立瀏覽器、逐筆保存數據，前後使用同一工具。沒有提高heap、記憶體、timeout或減少歷史數量。Node/fake-IDB、原生Worker微基準、真GameApp冷啟動與Android分別列報。
