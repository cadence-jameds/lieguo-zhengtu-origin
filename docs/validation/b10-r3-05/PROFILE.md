# R3-05 初始正式路徑分析

基準 PR57 `dfa574a4de24fe9069df2a90d3edae6a64f191da`。正式程式修改前已量測，工具直接呼叫 Runtime 使用的 FormalPersistence、LedgerStore、SaveCodec；驗證專用 Vite transform 計時不修改磁碟上的正式程式。全部合成資料，沒有玩家存檔。

環境 Node22.23.4、Linux、CPU quota2、8GiB、預設heap；Chromium154 真 Dedicated Worker／原生 IndexedDB。Node fake-indexeddb 的單樣本 CPU profile 另列，不能當原生速度。首輪每操作僅一筆診斷，不是 p95 或驗收；後續同環境多樣本原始摘要另交付。

## 先確認的瓶頸排序

| 正式操作 | 原生總時間 ms | 實際拆解與優先順序 |
|---|---:|---|
| 60k Recovery | 8921.2 | writeLedger 5792.2，其中 LedgerIdentity getMany 4564.7；checkpoint 帳本完整驗證1496.5 |
| 60k 冷載入 | 5901.6 | LedgerIdentity query 3078.1，帳本完整驗證1520.5；history/result鏈逐筆讀取約574 |
| Quick／Full 匯入 | 13530.9／11766.1 | 三個 writeLedger 共8239.2／6390.0；重讀共享區段、60k點查詢及已存在內容重複 canonical 比對 |
| Quick／Full 匯出 | 8675.1／5766.6 | 兩個 Root 的完整驗證4330.2／3067.9，共享區段重讀，transport canonical/checksum及大型字串配置 |
| T1／T2 | 9.1／88.7 | 小批身份點查，T2 world schema兩次32.5、encode25.4；普通提交不是首要長歷史瓶頸 |

Nested timings重疊，不可相加。初版計時器對return Promise的函式在finally提早停止；以上只使用整個操作、完整await的writeLedger／verifyLedgerArchive及DCore操作，不使用該初版readLedger／receiveCommand等不完整函式數字；工具已改為等待完整return後記錄。原生IDB內部 structured clone 包含於讀寫時間，沒有假裝能精確單獨量出。

Node同業務路徑：Recovery10034.9、coldLoad4269.9、Quick/Full import16584.6/15460.2ms。整組CPU葉節點GC約11.99秒、structuredClone約9.72秒、fake-IDB key conversion約8.50秒、canonical約7.53秒；這是整組含start及匯入匯出的profile，不是單一Recovery分解。GC觀察次數／時間包含於原始診斷摘要，不能把測試框架key conversion當原生IDB成本。

## 決定施工範圍

1. 大批精確身份查詢改用既有campaign範圍與有界批次，保留所有issuer／fingerprint／original／disposition比對與損毀修復。
2. 一個一致讀取交易內重用相同checksum區段，避免多個checkpoint／head重複IDB clone；冷啟動仍驗證實際讀到的全部內容。
3. 對嚴格JSON資料使用可證明與既有canonical比較等價的直接比較，避免生成多份長字串。checksum算法與格式不變。
4. 曾評估移除世界clone；原回歸證明來源revision須獨立以正確選取Recovery點，因此保留原副本。最後世界驗證／checksum及T2同一原子交易保留。
5. 匯出匯入先重用既有區段與Root，不新造帳本或格式。100MiB上限保留，失敗不改舊權威。

每項先故障／損毀測試再比較。任何交易外準備都不是權威，正式提交仍檢查writer／revision／root；本批不為取得速度拆分正式T2、不動AI／Scheduler／Projection協定。
