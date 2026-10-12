# 列國征途：始源 v0.30.11

本版接續 v0.30.10 Formal，修正首頁、新遊戲及手機／電腦呈現與 DEMO 的落差。正式世界為 384×384、100 勢力、432 野外據點；玩法 authority 維持 Formal/v84。

啟動、驗證、離線推進、佇列取消及已知待驗證事項見 [README_V0.30.11.md](README_V0.30.11.md)。可玩包操作見 [README_PLAYABLE.md](README_PLAYABLE.md)。

歷史 README 移至 [docs/archive/README_pre_v03010.md](docs/archive/README_pre_v03010.md)，其中 DEMO 地圖尺寸、外交、戰鬥與存檔說明不適用目前 Formal 入口。

Node.js 22.13 以上：npm ci；npm run dev；npm run typecheck；npm test；npm run build。正式輸出在 dist/，Sites 使用既有 project_id。遊戲存檔由本機瀏覽器 IndexedDB 保存；換來源或換裝置時請由遊戲設定匯出／匯入 Formal 存檔。

本輪自動測試通過。真實瀏覽器效能、畫面 A/B 與人工 Smoke 尚待驗證；不宣稱 Astra Gate 或 Player Smoke PASS。完成 v0.30.11 後停止，不進入 B5。
