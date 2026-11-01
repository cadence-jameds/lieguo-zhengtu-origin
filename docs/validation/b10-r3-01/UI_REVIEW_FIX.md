# PR #54 P0 等待／恢復 UI 補修

審查依據：GitHub review 5726753569（2026-11-01）。

- 每個 CampaignId＋CommandId 使用自己的 setTimeout handle；其他列更新不取消／重設既有期限。
- timeout 狀態獨立保留，Pending／Retryable 查詢與 commandList 不會將 blocked 改回一般排隊。
- 權威終局訊息同步取消 timer，不等待 React effect；同批次到期 callback 不可覆蓋結果。權威終局結果清除該列等待異常及 timer。已知終局結果不被延遲 Pending 覆蓋。
- timeout 只更新所屬列；僅最新操作可更新全域提示，舊 Ack 仍受原 PendingCommand fence 保護。
- unmount 清除所有 UI timers；重啟後從既有 Inbox 列重新追蹤，保留原 ID 查詢。
- Runtime、Persistence、T1／T2 及遊戲規則檔案沒有改動。

定向測試 31 PASS／0 FAIL；Typecheck、Build PASS。新增 fake-timer 案例覆蓋 A 停滯而 B/C 更新、超時查詢 Pending、成功／拒絕解除異常、Worker 中斷後 remount 原 ID 查詢。

完整隔離回歸及 CI 以 PR 最新 HEAD 的 Verify／regression-full.json 與交付結果為準；不將進行中的檢查當作通過。原生 Android、production SW 與實機延遲仍待驗；本批沒有宣稱新的瀏覽器實測。

既有精確 successor 只更新實作錨點與已存在交付檔案的明列範圍；原 T1/T2、Reducer、Scheduler、歷史規格及 Gate predecessor 沒有放寬。
