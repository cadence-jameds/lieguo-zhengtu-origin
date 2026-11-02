# R3-03 正式帳本 v1 契約

此實作接續 PR56 候選，依使用者 2026-11-02 決議取消舊存檔相容。`../REPORT.md`、候選量測、失敗及 BLOCKED 證據保留為歷史，不能視為本批正式接線的驗證結果。本批結果另列於本目錄的交付報告。

## 身份與結果

唯一身份為 CampaignId＋CommandId，Branch 不參與唯一鍵。原始 issuer、fingerprint、正式原始結果不可覆寫。收據核心沿用已驗證的 persistent AVL／不可變區段及 SHA-256 鏈；正式授權由新增的 wrapper、Authority 與真正的 DB 交易提供，沒有使用合成 marker 當世界。原候選實驗的 activation guard 仍只限制該實驗。

- `pending/retryable`：Inbox 已持久接收的原始意圖與有限重試資訊，尚無成功世界效果。
- `committed/rejected/needs-confirmation`：不可變原始結果。Needs Confirmation 使用結構化確認旗標與原始結果狀態，不能靠任意顯示文字推定成功。
- `applied/rolled-back`：某個已驗證版本的收據投影。Recovery 不刪身份，也不修改原始成功結果。
- `duplicate`：重送查詢原結果，不是第二次執行或另一個成功歷史結果。

AI 私有補算內的未提交候選不構成第二個世界；成功收據與沒有成功取代的拒絕結果，於整批 T2 才取得正式身份。這保留既有 AI 決策、派兵前置過濾、資源預算及事件次序；正式已存在身份一律先去重。AI 與已受理玩家操作撞 ID 時，保留玩家原始 Inbox 內容及明確的衝突拒絕；不得把其他 issuer／fingerprint 的成功結果當成該玩家操作成功。衝突拒絕是 UI 對已受理 envelope 的查詢結果，不覆寫 canonical owner 的歷史結果。

## 熱世界與 Verified Snapshot

正式熱世界僅攜 `ledger.format=1`、版本 anchor、本次新增 receipts 與私有未提交 outcomes。Anchor 綁定 Campaign、World Revision、Authority Revision、Manifest Root、Branch、Writer Epoch 及 checkpoint root。提交快照的新增集合必須為空。

完整歷史位於不可變帳本。既有 `commandReceipts` 讀取介面是不可列舉的唯讀投影，不是世界內保存的陣列；JSON、structuredClone 與正式世界存檔不攜帶完整收據。正式讀取入口使用版本化 reader；精確引用使用 AVL。草稿只複製熱資料與本批增量。純遊戲規則 fixture 仍可使用一般陣列，不代表接受舊版存檔。

證明由完整區段驗證或合法前綴追加產生。Schema／clone 可顯式傳入已驗證版本；未知或不符的 root 必須拒絕，不能用目前 head 冒充舊 checkpoint。記憶體快取只加速讀取；載入仍從指定持久 Manifest 驗證完整資料，並比對 World checksum、Authority、head 及精確索引。

順序敏感讀取保留原語意：一般追加保留順序；Start／Restore／Import 與原正式 Persistence 一樣使用 CommandId 排序的既有前綴，其後追加仍按實際順序。Manifest 的 `orderPrefix` 明確綁定此邊界；治理同 revision 的先後與撤退第一個 applied 收據不任意替換。`branchRevision` 固定分支投影的起點，普通 Tick 不推遲舊 rolled-back 查詢的版本。

## DB、T1／T2／T3

新命名空間 `lieguo-formal-ledger-v1`，IndexedDB schema 3，StorageMeta 格式 `formal-command-ledger-v1`。遊戲規則 metadata 與 v97 主規格不升版；新 Ledger／Save schema 與遊戲規則版本分開。

- T1：保存玩家原 Order、fingerprint、原 Revision／意圖前提、來源 Branch、接收 Branch／Writer Epoch、單調 sequence、期限與重試資訊。Created 不等於 Durable Pending。T1 不進 AI 計算佇列，也不讀取完整歷史。
- T2：在同一 DB 交易內寫世界、Authority／checksum／revision、Inbox 結果、收據區段、結果區段、精確索引、Manifest、head、戰報及 Recovery 引用。hash／encode 使用純計算 keep-alive，不在其內巢狀讀 DB。沒有交易外已發布區段；失敗必須全部回滾。
- 無世界效果結果：仍有 T2。Ledger version／root、世界引用／checksum、Authority 與 Inbox 同時更新，但不增加遊戲 Revision、不改變世界效果，也不重設世界的實時保存錨點。Runtime 必須接收這個新引用。
- T3：通知及查詢快取。查詢由 immutable original＋branch projection 衍生；快取修復須檢查 head CAS／writer，失敗不撤銷 T2。舊 Ack 的 UI 防護保持 R3-01 行為。

每個 campaign 的精確索引只使用複合主鍵；完整 campaign 讀取採主鍵範圍，沒有 Bloom filter。重複匯入不重寫未變索引。Recovery 重建的是可驗證的派生索引，不刪除權威歷史。

## 新存檔、分支與舊資料

新格式 `lieguo-formal-ledger-save-v1`。Quick／Full 都攜帶熱世界、去重與原始結果、全部必要區段／Manifest、Inbox 原始意圖、永久成長任務權威，以及可用 Recovery 引用。Bundle 以 hash 去重區段，不能只傳 current tail。Quick 可以省略非必要戰報；不能省略已拒絕命令身份。checksum 同時覆蓋世界與可攜證據；損毀／不完整封裝在寫入前拒絕。

Start／Import／Restore／Reset 在同一交易切換 Branch，終局化所有舊 Pending，並把必要結果寫回所屬 campaign 帳本；不能跨分支自動執行。Reset 清除活動世界／回復點／戰報，保留既有身份與永久事實。Import 不覆寫原始結果，跨檔同 ID 衝突須拒絕；過去的 applied 快照可更新分支投影，但不能重新執行原命令。

舊正式 DB `lieguo-formal-stage2-time2` 與更早 namespace 保持獨立、唯讀；新程式不轉換其中的世界、Inbox 或 Recovery。舊格式明確拒絕並提示建立新戰役，不能無提示載入或覆寫。原始歷史封裝只供保全，不冒充可匯入的新正式存檔。

## 邊界

原 Reducer 遊戲費用、資格、AI 決策、Scheduler 排序及滅國／復國規則不變。UI 仍可取得完整相容投影，沒有提前做 R3-04 協定改造。完整載入、匯出／匯入、Recovery 仍驗證全歷史，部分順序查詢仍需迭代；編碼、保存與空間成本不得冒稱已完成 R3-05。Node／fake-indexeddb、原生 Chromium、Android 必須分開回報。
