# R4 Delta — 人工驗收與獨立審查待辦

Gate 仍 HOLD。下表均為 MANUAL PENDING，不能由本次自動測試 PASS 代替。

| 待辦 | 要求／限制 |
|---|---|
| B5 E1 原 M3 Lv15 玩家人工驗收 | 玩家親自完成原指定 Lv15 情境，保留操作、戰前／戰後及正式戰報證據；原 Astra 報告與 B5 E1 HOLD 不改寫。 |
| Astra 再次獨立 Gate Review | GPT-6 中控指派後，核對新 HEAD、B1／M1 source diff、原始失敗、27 專項／完整 Regression／browser 與 manifest；本施工者不裁定 Gate PASS。 |
| 實體手機及硬體 GPU FPS | 本輪僅 headless desktop Chromium；不冒稱實體手機或硬體性能合格。 |
| 六文明完整人工鏈與大型多線／晚到矩陣 | 受控最小邊界不能外推全部手動流程。 |
| 已部署舊版 Service Worker 升級 | 本輪未部署、不改 release，不能驗收已部署舊版升級。 |
| 私人晚期 REALM_REGRESSION_SAVE | 未提供該個別私人檔，原 conditional SKIP 保留；不提交私人存檔。 |
| Day30／168／360／720h 長期校準 | 不以短局或延後 AI 的 synthetic fixture 取代。 |
| 歷史已損壞工匠存檔 | 新嚴格 Schema 拒絕非法状態，沒有實作 migration；若要修復此類既有玩家檔，另待中控授權及規則。 |

交付後 STOP。不得 merge PR #3、啟用 auto-merge、推 main／release、觸發 Pages 或開始 B9／B10。
