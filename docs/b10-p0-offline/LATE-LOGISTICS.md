# 後期物流計算：固定路線與商隊名額

- 起訖座標、地圖尺寸、地形未變時，重複出貨可重用原 A* 方向、路徑及距離。快取只保留一個地形，至多 128 條路線且總計不超過 16,384 個座標；未命中仍跑原 A*。每筆商隊取得獨立路徑快照。
- 權限、庫存、入庫預約、科技、固定／奇觀／手動名額，以及有效事件時間仍各自計算。入庫、回程、易主、來源 ID 與既有存檔格式不變；不改 AI 何時出貨或奇觀補給量。
- 市場忙碌商隊、用途總額與單條路線占用由同一次掃描計算。用途可用量本身已受市場上限扣除忙碌量約束，可去掉重複的市場上限掃描。
- logisticsPerformance.test.ts 對照方向、水域成本、地形與尺寸切換、無道路結果、快取逐出、路徑獨立、物流科技、出貨和返回。另用 904 筆在途資料比對既有配額公式，含舊式未標用途資料、已移除路線與市場縮減。
- Node 24.22.3，同機固定地形（384×384、seed 90217），32 條有方向性的路線輪流重複至 1,280 次，包含冷啟動：原 A* 約 3.21 秒，優化約 0.076 秒，距離及路徑長度檢查值相同。此數據**只代表路徑微量測，不是整局離線補算的加速比例**；未用玩家存檔或 Android 真機測量。路線皆不重複時不預期同等收益。

```sh
npx vitest run src/game/formal/{logisticsPerformance,playerLogistics,logisticsOwnership,wonderAutoSupply}.test.ts
LOGISTICS_ROUTE_BENCH=1 npx vitest run src/game/formal/logisticsPerformance.test.ts --reporter verbose --disableConsoleIntercept
```
