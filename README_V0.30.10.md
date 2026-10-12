# 列國征途：始源 v0.30.10

Stage 2 Player Feedback Fix + DEMO Presentation Restoration。正式起點為 v0.30.9；v0.30.2 僅作呈現基準，規則仍由 v84／Formal 系統提供。

## 開發與建置

需要 Node.js 22.13 以上。

```sh
npm ci
npm run dev -- --host 0.0.0.0
npm run typecheck
npm test
npm run build
```

正式輸出為 `dist/`。既有 Sites project 與網址沿用；`.openai/hosting.json` 是此 Site 的部署設定。Native v0.30.9 存檔沿用既有資料庫與 Formal schema；不支援將 DEMO 存檔轉為 Formal 存檔。

## 本輪變更

- 首頁、六文明新遊戲卡、文化姓名骰子、11 個駐軍兵種線、世界時間位置與城市概況。
- 0／1／6／24 現實小時離線推進（預設 24），經 Formal scheduler 補算，原子存檔並顯示摘要。
- 建造與訓練各最多 3 筆待辦，永久人口里程碑解鎖第二條併行 lane；取消施工／排隊會由 Formal command 處理退款與事件重排。
- DEMO 地圖 chunk／scenery cache、漸進渲染、分離背景與 overlay；TownScene／OutskirtsScene 使用既有 DEMO 場景布局接 Formal 資料。
- 其他勢力目前為中立灰色；帝國版圖無 B6 資料；不新增偵察、攻擊或 B5 功能。

## Evidence 重建

設定 `CORE_METRICS_FILE`、`PARITY_EVIDENCE` 可由對應測試輸出 JSON／離屏素材；具體環境變數見 `src/game/formal/metrics.test.ts` 與 `src/game/presentation/mapVisualEvidence.test.ts`。

```sh
CITY_PARITY_EVIDENCE=/absolute/output/city-scenes DEMO_BASELINE_ROOT=/absolute/lieguo-v0.30.2 npx vitest run src/game/presentation/cityParityEvidence.test.tsx
python scripts/render-parity-evidence.py /absolute/output/world-map
node scripts/check-formal-map-worker.cjs /absolute/output/world-map/map-near-scene.json
python scripts/build-playable.py /absolute/output/Playable1_v0.30.10.html
```

## 驗證狀態

完整回歸：74 個 test files，463 項通過、1 項原有測試因缺少外部 late-game fixture 跳過；型別與 production build 通過。最後的地圖偏好防護及 A/B 檢視頁資產路徑修正另有 targeted regression。

當前環境未取得真實瀏覽器畫面、FPS、frame time、long task 或手機手勢結果。離屏圖與 Node worker 計時僅供結構檢查。CityScene A/B 檢視頁的像素比例／圖像 footprint 尚待瀏覽器驗證，山脈 Formal M 地格遮罩的邊界觀感也仍待檢視。

本版本不是 Player Smoke PASS 或 Astra Gate PASS。B5 尚未開始。詳細退款、相容性、驗證與待辦請見本輪交付的 Report／Parity Matrix／Smoke Checklist。
