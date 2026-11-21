# P1：離線補算不再為每筆命令複製完整命令前提

## 範圍

量測基底是 Draft PR #68 的 `87da678382be88040ddf38a6183e45d5c458e4b5`。效能實作 tree 與 `c2a73e70ca4675d6afe8b8819ac731c6fe3d50e1` 相同，只有 reducer、六項新增測試與玩家更新摘要。既有長時推進本來就先深複製成整批私有 draft。只有離線進入時，且初次檢查可證明 commandFacts 無兄弟領域／內部別名、資料形狀可借用，才不替單筆命令重複複製整張表。正式前景命令與正常前景時鐘推進沿用原複製策略。

命令 handler 仍以原收據與 evidence 查詢。只有私有收據 append 與後續 growth command 步驟成功，才更新整批私有 evidence。借用範圍不跨玩家可見邊界，也不新增 yield。非標準資料或別名依原 clone 路徑；最後的 revision 正規化、prune、完整驗證與原子提交不變。未改 Scheduler、事件順序、AI 決策頻率、規則、持久化格式、世界時間與離線上限，也未做 checkpoint 或跨時間分片。

## 同機 A/B

Node 24.22.3、Linux x64（AMD EPYC），原 Benchmark、`--mode count --hours 4`，seed 90217、100 勢力／99 持城 AI、25×、相同固定起訖。每版各一次，在同一工作機順序執行；沒有使用私人存檔。`fake-indexeddb` 不是原生瀏覽器 IndexedDB；count 模式含計數、順序觀察與少量計時，非零插樁。

| 指標 | PR #68 基底 | 這次優化 |
|---|---:|---:|
| 完整載入／補算／保存 | 80.482 秒 | 26.427 秒 |
| 離線補算階段 | 79.949 秒 | 25.841 秒 |
| 重播事件 | 31,283 | 31,283 |
| 抽樣 heap 高水位 | 787.66 MiB | 687.47 MiB |

這組資料總時間減少 67.2%（約 3.05 倍速度）。原 A/B 執行時最佳化位於工作樹，工具的 HEAD 欄會列出基底；事後以相同 reducer 位元組建立上述實作 commit。既有量測工具的 A/B 產出，事件順序 checksum、最終統計、以及 33 個完整結果 fingerprint 中的 32 個相同，含 commandFacts、完整 Ledger／收據／結果與戰報。唯一例外是 `metadata.appVersion`（0.30.88 → 0.30.89）；用只差這個值的 metadata 物件計算出的 SHA-256 與兩版 fingerprint 分別完全吻合，schema／內容／規則／生成器／地形版本不變。兩版各自完整原子 readback 都通過。沒有把 checksum 當成每筆事件的密碼學證明。

## 尚未驗證

此環境的 Chromium 對本機測試頁啟動仍遭限制（`socket(): Operation not permitted`），未跑原生瀏覽器 A/B。沒有原私人備份或 Android 真機；以上數據不能套到原本的 12 小時、113,924 事件、21 分 45 秒個案，不能保證目前達到 2–3 分鐘。待原生和 Android 使用相同存檔／時鐘重測；玩家命令可靠性以既有 durable/recovery 回歸另驗，不用合成 benchmark 假裝量到了實機 T1/T2 延遲。
