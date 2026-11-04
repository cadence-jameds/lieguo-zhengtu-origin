# 正式歷史依賴替代矩陣

永久詳細流水帳由本批使用者決議取消。下表是正式業務依賴，並非把 commandReceipts 置空或保留隱藏全量歷史。

| 原依賴 | 正式來源 | 保留邊界 |
|---|---|---|
| CommandId、Issuer、Fingerprint、原始 Ack | Durable Inbox + 每類 1,024 筆近期結果 + 持久 Replay Fence | Pending 不清理；已退休身份拒絕，不承諾永久 Ack |
| 治理 ABA／點擊前提 | commandFacts.governance 與 minimumGovernance | 城市當前最後設定來源；Recovery 保留原排序語意 |
| 工匠、城堡文明 | 城市永久文明欄位、工匠資格與最小來源 type/city/craftsman/issuer | 有效領域實體與城堡來源 |
| 建造、軍事、科研、物流來源 | commandFacts.evidence + 領域 queue/army/project/payment 引用 | 僅世界圖仍引用的來源；沒有原始 Ack／完整參數 |
| 奇觀、維修、突破、現代化來源 | 相同最小領域來源讀取介面 domainReceipt | 現存專案、付款與資格證據 |
| 任務領獎 | growthTasks.claimed + 最小領獎證據 + 帶校驗的 Campaign Authority | 每戰役最多 80 項已領獎領域事實；跨 Recovery／切換保留 |
| 撤退軍隊建立來源 | 每勢力第一筆／字典序最小有效來源 | 勢力數量；維持原普通追加／Recovery 順序語意 |
| 總督是否真正接受命令 | commandFacts.effects 差值 | 單一安全整數，不保存完整歷史 |
| 回復舊事件後的自動命令去重 | 僅兩個回復點中尚待處理事件的 replayReservations | 事件消耗後清理；覆蓋 AI／治理／戰鬥與移動產生的鏈 |
| React／地圖／Preview | 既有 PresentationWorld／WorldStream v2／唯讀 Preview Context | 不傳 commandFacts、近期詳細結果或永久歷史 |
| 正式 Reducer 同批去重 | 近期精確索引 + 私有批次 pending delta／reservation | 目前原子批次可能暫存較多結果，提交後回收；不是永久累積 |

仍保留 `commandLedger`／`Ledger*` 內部名稱，以重用既有完整性與交易接線；其正式實作已換成完整小窗口，不引用舊候選 Persistent AVL。舊候選腳本與測試保留為歷史證據，不代表新版正式模型的驗證。

命令的 source 身份仍是正式領域資料，不能以近期結果退出窗口為由刪除它。新格式不接受舊格式，不做 Migration。資料庫與匯入入口的拒絕不會刪除舊 namespace。
