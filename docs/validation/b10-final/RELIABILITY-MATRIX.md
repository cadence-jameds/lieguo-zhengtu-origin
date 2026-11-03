# 玩家命令與資料安全：驗證對照

來源固定為完整 Stack `8d40f63…`。下列「自動驗證」指本輪最終來源的完整隔離回歸（2419 PASS／0 FAIL／1 SKIP），以及報告列出的原生重驗。不能轉填為 Android 實機 PASS。原生 PWA／關頁的最終執行狀態另見 REPORT 與 `production-sw.json`；不以此表預先宣告尚未執行的項目通過。

| 需求情境 | 自動驗證與必守結果 |
|---|---|
| 1. 連續點擊建造 | `durableRuntime` 的 99 AI／25X 混合快速指令、UI command／Preview 測試、`runtimeSchedulingR306` 的 20／50 FIFO。每筆保存自己的 ID、Payload 與語意；前提改變時明確確認，不強迫全部 committed。 |
| 2. 建造＋招募 | 同一正式 Runtime 快速混合建訓研／治理／出兵／物流；T1 可在補算完成前保存，正式 drain 仍 FIFO，扣款及排程最多一次。 |
| 3. 科研／治理／科技付款 | `runtime`、`modernFundingIntegration`、科研／治理正式測試與持久命令測試；整個原 Payload 留存，保存失敗不公開候選世界。 |
| 4. 派遣／撤退 | 正式軍事／戰鬥／軍隊生命週期與 `projectionArmyR304`、Runtime 的原軍事意圖驗證；出兵、撤退與 UI delta 對應正式身份，不重送新 ID。 |
| 5. 工匠建堡 | `craftsmanCastleDeltaR4` 17 項含單次消耗、原子 save、Full import、pre-command Recovery；回復後原 ID rolled-back，不再消耗工匠。 |
| 6. 成長任務領取 | `growthTasks` 87 項、`growthTaskIntegration` 11 項含存檔／匯入／Recovery、並行容量、舊 reward vector。永久 claimed facts 與原結果避免重領；不丟失舊版本獎勵事實。 |
| 7. 99 AI／25X 操作 | `durableRuntime`、Runtime scheduling、原生 private replay 故障、真實 600.268 秒 soak；99 AI 實際決策，T1 與世界正式補算分開。 |
| 8. 長離線補算中提交 | `runtimeSchedulingR306` 的 offline 原意／T1／單 T2 測試；原生 benchmark 走真正 away／resume API，但間隔用合成時鐘，與真 wall-clock soak 分開。 |
| 9. 補算中終止 Worker | 原生 Runtime barrier 後實際 terminate／重啟；所有私有世界表不變，Pending 持久可查，重啟原 ID 一次效果。 |
| 10. T1 後關頁 | 持久命令測試驗證重連；Production native case 額外在 Durable 通知後實際關頁、重開同 Origin 查同 ID。桌面關頁不能代替 Android OS kill。 |
| 11. T2 前 Worker 中止 | 原生 Runtime、export／import／restore 實際 Worker terminate；中止前各表快照與重開後一致，原 Pending／原結果保留。 |
| 12. T2 成功 Ack 遺失 | `durableCommands`／`durableRuntime`、native UI；重查精確原 Ack、同 ID 重送不再扣款或產生效果。 |
| 13. T3 通知遺失 | native UI 丟最後 Projection；Ack 高於畫面 revision 時有限唯讀 snapshot 恢復，Ack 也遺失可查原 ID。不得用再次執行補畫面。 |
| 14. 同 ID 重送 | CampaignId＋CommandId 精確永久身份；Original Result 回覆與 branch disposition 分開，不以最新狀態捏造原 Ack。 |
| 15. 同 ID 不同 Fingerprint | strict parse 與 issuer／fingerprint 檢查；T1 前拒絕衝突，不覆寫原 row。AI／玩家身份碰撞亦不能借用別人的成功 Ack。 |
| 16. 多分頁 Writer 交接 | Web Lock、epoch 與 Revision／Root CAS 分層；原生兩頁鎖、舊 writer 交接中 T2 拒絕。即使 revision 沒變，舊 epoch 也不能寫。 |
| 17. Recovery 後舊 ID | Ledger／持久命令／craft／growth 測試；Original Result 不變，當前分支可 rolled-back，舊身份不重新執行。 |
| 18. 過期 UI／治理 ABA | `projectionAdmissionR304` 8 項、scope／governance 測試；保存已提交畫面的語意與最後寫入身份，舊設定 A→B→A 也不偷偷視為原操作仍有效。 |
| 19. 滅國凍結／復國 | `extinctionWorkerP0C10` 7 項、`extinctionB7`、31-case parity；凍結不推進 AI，同時刻剩餘事件保留，合法復國成功 T2 後才繼續。 |
| 20. 正式結束後操作 | 過期 Pending 不使 ended campaign 復活；`durableRuntime`、extinction 與 parity `extinction-ended`。正式終局不被新輸入繞過。 |

## 故障與一致性

有世界效果的 T2 逐一覆蓋 11 個寫入邊界：Segment、Result、Index、Manifest、Head、report、backup、world、authority、metadata、result。無效果的結果保存也覆蓋其七個權威寫入點。故障後所有原表保持一致、Pending 保留、原候選不可公開；重試僅一次效果。Quota／未知永久故障不自動重試，沒有加長期限或放寬數量。

損毀驗證分開處理：

- 不可變 Segment／Result／Manifest 缺失、checksum 錯誤或循環鏈：安全拒絕並保留原資料，warm cache 不能遮蔽。
- 派生 Index 的缺失／錯值／多餘空 key、current snapshot checksum：從已驗證的 checkpoint 原子 Recovery，保留不可變身份及永久任務事實。
- 同 Revision 不同 Root、舊 epoch、跨 campaign／branch／session／sequence 的展示訊息：拒絕或有限重新讀取，不能部分套用新舊狀態。
- Quick／Full、關閉重開與連續 Recovery：保留完整必要 Ledger、原始拒絕結果、原 Payload、Inbox 及 Recovery Roots；不完整資料不可當合法存檔載入。

## 證據範圍

完整自動回歸包括正式規則、資料安全與 React 測試；原生 Chromium 增加真正 IndexedDB transaction、Dedicated Worker、Structured Clone、兩分頁 Web Lock 及 Production SW。表中沒有把 reducer 單元測試冒稱所有操作都經過實機觸控，也沒有把 headless 分頁切換冒稱 Android 暫停或 OS 休眠。裝置驗收逐列保留於 [Android 表](ANDROID-CHECKLIST.md)。
