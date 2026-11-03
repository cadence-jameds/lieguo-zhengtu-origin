# R3-06 Runtime 排程契約

基準：PR58 `c370ff8a492de8711e764a82c8f1d43efef1a00e`。正式 DB3／Save1／100MiB、Ledger／Persistence／Admission／Projection／Preview 來源未改。不是另一個權威或新的遊戲時間模型。

## 四種順序

1. JS 服務機會：同一 Runtime Worker 在完整事件之間讓出；已知命令結果的唯讀查詢可獨立服務。
2. T1：原 `intakeQueue` FIFO，原始 Payload、Fingerprint、Revision、Branch；只有交易成功才 Durable Pending。
3. 世界時間：原 `EventScheduler` 時間與 tie-breaker，所有到期事件完整執行。AI 策略、數量、頻率、RNG、候選與 score 不變。
4. 正式命令：原 foreground FIFO，先必要補算與原意重新驗證，再原 Reducer／T2。玩家不能越過已到期世界事件。

## 有界工作預算

`RuntimeWorkBudget` 只計數未完成的 T1 Promise（成功／失敗均解除）。一般 slice 要求8ms；有 T1 壓力時2ms後請求讓出，timer pause要求2ms。開始新的私有草稿前要求4ms開口，讓已到達 IPC 有機會交給 T1。timer、單一事件與OS排程均可能超過要求，沒有8ms硬保證。

只在完整事件後 yield；不拆戰鬥、AI 或原子事件。每輪仍前進完整事件，不等待所有 T1 完成，持續玩家接收也不會永久停止事件。每個玩家命令仍補算必要世界時間；普通tick不能越過前面的請求。私有 replay固定同一 target，不因yield重新延長補算範圍。未新增可續跑第二草稿或生產 Worker。

## 查詢與切換屏障

`commandQuery`／`commandList` 為唯讀序列，查正式持久結果與最後已提交世界；不讀私有 draft。已知ID不等不相關T1；未知ID只等待查詢抵達時已在前面的intake尾端，避免錯報未接收。查詢不改寫或重試命令。

每次查詢跨await後檢查世界／writer是否已發布新版本，最多重讀3次，持續變動則顯示可重新查詢的notice。參照僅用來發現並行發布，不作Ledger完整性證明；Persistence原驗證照常執行。同Revision更新結果也會發布新的world來源，因此不能讓延遲Pending覆蓋較新的終局Ack。

Load／Resume／Away／Start／Restore／Import／Reset保留foreground FIFO屏障：前方獨立查詢先完成，屏障抵達後查詢排在屏障後。載入、建立、Recovery、匯入先在局部變數完成Admission Map與writerContext，才同時採用新world與writer。不能把新世界標成舊branch。

## 純勝利必要條件

無快取的 `hasVictoryCityShare` 每次依目前勢力／帝國成員與城市所有權計數。沒有陣營達45%城市時，原征服70%及霸權45%條件均不可能成立；可略過人口、軍力與hostile計算，但仍執行原candidate清除、事件discard與狀態轉換。

需要完整條件時，人口每城算一次，保留相同數值、加總順序；每勢力帝國只查一次；hostile候選只保留原條件可成立的帝國，順序不變。正式勝利公式、持續時間、完成處理原文不變。沒有改AI搜尋空間。

## 原子邊界與失敗

T1、T2、T3及其所有原故障點未改；私有草稿完全完成後，原Writer／Revision／Root CAS和同一IDB rw交易才使世界、Authority、Ledger、Inbox、戰報、Recovery成為正式結果。切換／外部writer接手後舊CAS拒絕；沒有較早提交的片段。

T3或Ack丟失仍查原結果；同ID不同issuer/fingerprint仍拒絕；終局／rolled-back不重開執行。預覽Worker終止不能取消正式命令。UI不重新接收完整收據。

## 對照與保護

Reference為兩份PR58正式原始碼，SHA256固定且successor逐byte核對；Reference與Optimized使用獨立Vite module graph。其餘AI、Scheduler、Persistence、Schema、Admission及UI來源由精確successor保護。

逐事件完整trace、每筆AI／玩家命令與Ack、RNG cursor、sequences、最終world／reports／Ack canonical SHA256全部一致才PASS；60k另比對完整有序歷史hash。JS耗時與yield次數不是確定性欄位。測試端插樁不進入產品建置。

現有合法速度為1／3／6／10／25；5X不合法，不為測試新增玩法。Release patch進位依2026-11-03使用者明示核准，未配置規則仍拒絕超99，與主規格版本無關。
