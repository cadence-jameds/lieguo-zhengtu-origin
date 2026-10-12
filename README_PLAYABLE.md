# 列國征途：始源 v0.30.11 Playable #1

Windows：解壓列國征途_Playable1_v0.30.11.zip，雙擊 PLAY.cmd，保留命令視窗。原有 PowerShell 啟動器已更新為 localhost:8771，不需要 Node/npm/Python。Windows 實機啟動結果尚待玩家檢查。

macOS/Linux：在解壓目錄執行 python3 serve.py，再開 http://localhost:8771/。需 Python 3。只綁定 loopback。

單檔：Playable1_v0.30.11.html 已嵌入 179 個美術素材與兩個 Worker；產生與 Worker 綁定檢查通過，實際 file:// 的 Worker／Web Locks／IndexedDB 行為仍待瀏覽器檢查。若直接開檔受到瀏覽器限制，可改用 ZIP 本機伺服器或 Sites。

本機端口由 v0.30.10 的 8770 改為 8771，避免舊 PWA 快取。原 8770 存檔保留；要續玩請從 v0.30.10 匯出，再在 v0.30.11 匯入 Formal 存檔。既有 Sites 網址及儲存來源沿用，v0.30.9 native save 可直接載入；不匯入 legacy DEMO 存檔。

離線世界推進提供 0／1／6／24 現實小時，預設 24。cap 先套用現實離線時間，再乘世界速度；補算結果經 Formal scheduler 原子保存並顯示「你離開後的河谷」。

建造、訓練各最多 3 筆任務；15,000／20,000 人永久里程碑解鎖各自第二條 lane。施工取消等待項返還已付資源 100%，進行項返還 80%；同建築／田地的依賴升級會一起取消。訓練取消依既有 Formal 規則返還未完成部分的 80%，已完成士兵保留；倉儲上限會限制實收退款。

B4_manual_inspection.realm-save 是高階功能測試世界，使用前請先匯出自己的進度；並非正常新遊戲設定。正常開局維持既有 Formal D7 配置。

請依同包的 Smoke Checklist 重新試玩。本版未宣稱真瀏覽器 FPS、手機手勢、Windows 啟動器、Player Smoke 或 Astra Gate 已驗收。偵察／攻擊／外交／B5 尚未實作。
