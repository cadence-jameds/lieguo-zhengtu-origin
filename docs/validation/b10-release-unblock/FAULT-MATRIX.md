# 故障與資料安全矩陣

原子故障測試同時比較世界、Authority、RuntimeMeta/fence、Inbox、結果、索引、Manifest/Head、Checkpoint、戰報，不能只驗最終城市名稱。Node 使用 fake-indexeddb；原生 Chromium 另外對真正 IDB 交易注入 `DOMException('QuotaExceededError')`。這是故障注入，沒有宣稱把實體磁碟填滿。

| 邊界／風險 | 保護與驗證 |
|---|---|
| T1 前／fence-write／inbox-write | 交易前不是 Durable；失敗無持久成功回覆；水位及 Inbox 同時回滾，原 ID 可安全重試 |
| T1 完成、T2 前 terminate／關頁 | 真正 Worker terminate、新 Worker 取得 writer 後精確找回 Pending；50 筆快速接受維持 FIFO |
| T2 report-write、backup-write、world-write、authority-write | 各點獨立失敗；所有表完全等於交易前；原意與原始 draft 不被修改 |
| T2 metadata-write、result-write | fence／世界／結果同一交易；失敗仍 Pending，不回假 Ack |
| T2 ledger-segment/result/index/manifest/head-write、retention-write | 清理也回滾；沒有部分正式結果或被刪的 Pending；解除注入後同 ID 只正式執行一次 |
| T2 成功、T3/Ack 遺失 | 查詢與相同 envelope 重送回原近期結果，不再改名、扣款或出兵 |
| issuer／fingerprint 衝突 | 同 Campaign＋CommandId 立即拒絕，不推進接收水位；即使已是原結果也不能替換 Payload |
| 近期窗口清理 | 精確 1,024 玩家＋1,024 自動結果；未完成操作不按容量刪除；退休結果不回虛構原 Ack |
| 已清理的真正玩家 ID | Node 測試先正式 T1/T2，再以同合法 epoch 的 1,100 筆累積結果淘汰，保留其他 Pending，重送拒絕且世界無效果；原生另外實際逐筆 T1/T2 超過 1,024 次 |
| 序號缺口／別名／溢位／epoch | 僅正規編碼安全整數，嚴格遞增接受；小於水位未知 ID 拒絕；writer／branch／incarnation 不可混用 |
| 舊 writer／多 client | 原生兩個 Persistence 實例 CAS fencing；GameApp 另外驗證真正 Web Lock。新舊 DB 版本用同一把 lock |
| Recovery／匯入後舊封包 | 接收端 incarnation 不隨快照倒退；舊分支不能新接收；已 Durable 操作精確解析為原結果或明確 needs-confirmation，不跨分支執行 |
| 較舊備份的 terminal Inbox | 原生 1,025 次真 T2 發現：Recovery 加入確認結果擠出最舊結果後，匯入舊備份不應復活其 terminal Inbox。修正 `reconcileReceipts` 將已驗證、但刻意排除的來源收據記為 retired，同一原子交易清理其 Inbox；不偽造 Ack、不改動快照世界效果。最初原生 FAIL 保留，新增精確 Node 回歸及原生重跑 |
| 回復舊 AI／治理／戰鬥事件 | 兩個回復點的 pending-event replay reservation 保留已用身份，事件消耗後回收；自動 logistics 的 persisted project sequence 不倒退 |
| 領域 proof 缺失／損毀 | Schema 驗證付款、研究、治理 stamp、城堡來源、現存實體引用；已知 rolled-back receipt 不可由殘留 fact 重新授權 |
| Root／Manifest／Segment／Identity／Authority／水位損毀 | 完整校驗／精確索引驗證，拒絕受損載入及匯入；保存原資料；無猜測式自動修復 |
| 匯出缺少Authority 綁定的 Recovery／世界 binding 過期 | 明確拒絕不完整匯出；不能默默略過點位、宣稱完整備份 |
| 舊 DEMO／R3-03 格式 | 新 namespace／版本拒絕，明確提示重新建戰役，不刪舊 DB、不暗中 Migration |
| 任務／一次性標記 | 最小領域權威跨 Recovery、超過四個近期戰役仍保留；不能重新領獎或開啟一次性資源 |
| Preview／Projection 故障 | 既有 R3-02 request/generation/revision 防護與 R3-04 sequence／有界 snapshot 追補保留；不影響已進 Inbox 的正式命令 |
| 暫停／滅國／復國／終局 | 沿用正式 Reducer／Scheduler，保留同時刻剩餘事件及合法復國例外；31 組原世界對照與既有回歸驗證 |

產品契約已正式更改：任意久以前的原始 Ack 不再保證可查；舊身份只能安全拒絕。這不是「所有舊命令都被證明失敗」；UI 必須查閱現有世界後由玩家明確建立新 ID，不能自動改寫原意或重送成新命令。

所有最終執行數量與 FAIL／SKIP 以主報告及摘要為準。本矩陣描述測試的安全意圖，不代替執行結果。
