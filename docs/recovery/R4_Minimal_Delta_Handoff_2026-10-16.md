# GPT-6 中控交接：PR #3 R4 最小 Delta

本輪施工分支為 `stage2-r4-integration`；最新 commit 以 PR #3 頂部與提交紀錄為準。完整技術與規格矩陣見 [Delta Report](R4_Minimal_Delta_Report_2026-10-16.md)，原始機器證據見 [本輪目錄](../validation/r4-minimal-delta-2026-10-16)。

- 起點 `7258b126a7fc33303b24a861e8ac4fd0be54a8d0`，先整合 `0769b778fb42bb6e95d590f5a98a16ca3aef0872`（PR #12），再保留 owner 合併 PR #13 的最新 main `76d68db5ac4da0bdd87656ded56434e564cb1877`。玩家已明確授權新增 D5。
- D1：移除戰後工匠自動撤離；成功失城時清算城內工匠、斥候、輜重及未出發拓殖隊。保留合法在途任務、原 B1 受領保護、主戰結算、已完工建築與普通施工；失權外文明城堡依賴取消且不退款。
- D2：玩家已核准 **水域 2 倍陸地時間**，已實作加權 A* 及軍隊快照；水域不可建城、山脈不可通行／建城、河流維持原規則。既有在途 deadline／EventId 不重算。
- D3：工匠及 persistence／資格測試使用含常規戰鬥兵的合法前置；不把 fixture 修正當作 Runtime 流亡資格已修復。
- D5：同／異文明合法工匠建造城堡 Lv1 四資源為 0；正常前置／工期、普通建堡及 Lv2～Lv15 成本保留。AI／總督報價及 UI 同步；取消無零成本退款套利，舊已付款工程保存原快照。兩個 production UI 例驗證付款／重讀／原生離線完工及單次消耗。
- D4：無衝突整合 main；PR #11 七個關鍵檔逐位元保留。原生 browser 證明 command transaction 先完成再 committed ack、duplicate 對應一筆正式 job／receipt／authority。

請獨立核對 report、source-delta.patch、source-manifest.json、summary.json、完整 regression、修復前 FAIL、browser／Recovery 與 performance 證據。初次完整回歸 **1249 PASS／3 FAIL／1 SKIP** 、D5 後 1268 PASS／1 FAIL／1 SKIP，及 observer／環境失敗均保留，最終完整回歸 **1269 PASS／0 FAIL／1 SKIP**、72 專項、5 個 native browser cases 及 typecheck／build／Pages PASS；不覆寫歷史。

**仍為 R4 HOLD，未宣告 Astra Independent Gate PASS。** B5 E1 Lv15 是 OWNER WAIVED，原歷史 HOLD 仍保留；不要再次要求相同人工驗收。實體手機及其他本輪未執行的歷史項目也沒有被改寫為 PASS。

**P0-C 仍未施工**：純斥候／純攻城器／無常規兵流亡 Runtime 資格、混編斥候排除與既有違規存檔的原子相容清理留待後續。v94 五筆佇列、80 任務與 PR #9 亦未在本輪擴張施工。

本輪只更新 PR #3 施工分支。沒有 merge PR #3／#9／#12，沒有更新 main／release、Pages 部署或啟用 auto-merge。**提交完成後 STOP，等待中控安排獨立審查。**
