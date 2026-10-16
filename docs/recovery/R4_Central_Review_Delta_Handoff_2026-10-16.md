# PR #3｜R4 中控複審後 Delta 交接

受審起點 `a8ae8aa32f1f22421963545694c77913baa46e0f`；本輪整合 main `7c52ab738e1ed8be2416c9e9fb95db32dceb020f`，保留雙 parent／既有歷史，不 force push、不寫 main／release。

詳細修復、原始 FAIL、驗證矩陣與限制見 [新版報告](R4_Central_Review_Delta_Report_2026-10-16.md)，機器結果與 hash 見 [證據](../validation/r4-central-review-2026-10-16/summary.json)。最新 HEAD 以 PR #3 及交付訊息為準，避免在提交內容內自我引用 commit SHA。

請中控依序核對：

1. **C1**：只將明確不可達視為候選失敗，從原行軍終點逐城嘗試正式路徑；不可達工匠安全終止、無退款／獎勵／重複事件。不得瞬移或恢復敵城控制。
2. **C3**：本輪玩家明確核准 A 案。征服當下未出發的全部待命兵死亡，先清除部隊／事件／聯軍索引，再交原滅國 resolver；不生成流亡獎勵。出發 handler 另核對來源所有權。等時事件仍依 priority 38 先出發、40 抵達，已合法出發者不追溯刪除。
3. **規格**：v94 blob `8215b2324beeed230057d3164d5fab1fbbdb644c` 與 main 一致；P0-C-7／8／9 僅整合文件，Runtime 未施工。D5 免費城堡已提前正式授權，保留在 PR #3。
4. **水域決策**：證據 `water-owner-decision.json` 逐字記錄先前核准問答，玩家答案為「2 倍陸地時間」。本輪不改倍率、不代中控自行改寫 v94。
5. **驗證**：21 項新增與 72 項原有相關專項通過；完整隔離 Regression、最終 Worker／原生 IndexedDB、Typecheck／Build／Pages 統計見最終 summary。失敗記錄與 Recovery 高水位測試修正原因保留，不以 CI 或自動測試取代 Gate。

**R4 HOLD。B5 E1 Lv15 為 OWNER WAIVED，不是新阻塞。** 等待 GPT-6 中控複審，之後才安排 Astra Independent Gate。本輪沒有宣告獨立 Gate PASS。

完成施工分支更新及證據交付後 STOP。沒有合併 PR、部署 Pages、修改 PR #9 或開始 P0-C。完整流亡資格／舊違規存檔清理與 PR #15 Runtime 仍交後續 P0-C，不能把本輪綠燈解讀成它們已完成。
