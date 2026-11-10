# R3-03 啟用前最小解決方案（提案，未實作）

狀態 BLOCKED。此文件不是正式規格升版，也不授權略過正式結果、Migration 或原子性 Gate。

## 兩個可重現的阻擋案例

`commandLedgerR303.test.ts` 使用現有 FormalPersistence／Reducer、合成世界重現：

1. 建立命令並 T2 成功，匯出 applied 快照，restore 舊點令 Inbox rolled-back，再匯入 applied 快照。世界該 receipt 為 applied，但保留 Inbox 仍 rolled-back。這證明「原始提交結果」「各版本 disposition」「現在展示 Ack」不能壓成單一全域 mutable 欄位；不是本 PR 新增的正式行為。
2. 資源不足命令已在 Inbox 終局 rejected；quick export 匯入全新 DB 沒有該身份。之後累積資源，同 CommandId／issuer／payload 在新 DB 又可受理並成功。此案例原拒絕沒有世界效果，不能稱作重複扣資源；但確實顯示舊可攜格式無法重建原終局結果。僅搬 world receipts 不是完整遷移來源。

## 必要接線，依此順序審查

1. **不可變原始身份／結果**：CampaignId＋CommandId 唯一，原始 issuer／fingerprint 不變，保存 committed／rejected／needs-confirmation 等原始結果或完整引用。每個 Manifest 另有當前 disposition 投影，Inbox query 依版本產生明確 authoritative result；不可覆寫已發生結果，也不可因 branch 變更重新用 ID。
2. **版本綁定讀取**：定義可同步讀取的已驗證 snapshot，root 同時綁 campaign／manifest／branch／revision。Schema parse、draft clone、structuredClone 邊界需要明確重驗／重綁。禁止用目前 head 或 WeakMap 存在即當舊 checkpoint 完整性證據。完整性驗證仍檢查舊有 malformed receipt 拒絕條件。
3. **保留正式歷史順序與事實**：提供 exact lookup 及順序敏感讀取（撤退第一 receipt、governance 同 revision tie、malformed fallback）；永久成長獎勵、工匠／城堡、付款與事件來源不能只保 tail。先同世界等價對照，再替換正式引用；舊 UI 可暫保完整投影。
4. **正式 T2**：世界、Authority、Inbox 結果、AI／玩家新身份、segments/index/manifest、Recovery root 同交易。無世界效果的終局結果也會改 ledger root，必須原子更新 Runtime 的 root 引用，不能錯用未變的 game revision 當 ledger version。交易內不做可能讓 IDB auto-commit 的任意外來 await；正式故障矩陣全部接線後驗證。
5. **可攜格式與舊來源政策**：新 quick/full 都攜原始身份／結果及所有世界／Recovery 可達 roots/segments。舊 DB 可從完整 Inbox／Authority／backups 補證；外部舊 save 缺少已拒絕身份的事實無法憑空補回。必須明確決定可證來源條件、清楚拒絕／受限接續方式與玩家說明；不能默認完整或盲改原 fingerprint/CommandId。這是待審契約，並未擅自選擇永久拒絕所有舊檔。
6. **非破壞 Migration**：新增 staging 狀態／版本及驗證進度，保留原始 v2 世界、Inbox、Authority、backups。準備根不可當正式 head；全部驗證後在單一權威 CAS 交易切換格式與 writer epoch。舊程式必須拒寫新格式。每一中斷點可重啟／重做，配額不足保留原件；未發布孤兒只於確認不可達後回收。先驗所有新舊 save 及 30k／60k 正式 roundtrip，再啟用。

完成上述最小契約、正式接線及所有硬 Gate 前，不刪 world.commandReceipts，不使用實驗 marker 代替世界，不宣稱 R3-03、R3-04 或 R3-05 效益。
