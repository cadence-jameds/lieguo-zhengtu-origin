# v0.30.34｜B5 測試地圖與建造條件顯示修正

日期：2026-10-10。唯一 implementation baseline：v0.30.33，source commit `24558085b59e6e10af1bed321206dbbed805ea0f`。沿用 v90 Formal authority；本輪僅修顯示與地圖快取，沒有開始 B6／B7／B8。

## 修改

- 測試台 map 外框原本有 65dvh 高度，但實際 renderer 未填滿，兩層 absolute canvas 無法提供自己的版面高度。明確讓 renderer 填滿外框，兩層畫布共用同一 viewport。
- 測試台補上 Formal presentation 與手機／桌機 context，沿用既有地圖比例標籤及工具列樣式。配置表單的 label／input／small 樣式限縮至配置區，避免污染地圖定位輸入、比例標籤與內嵌情報頁。
- 原本地形快取只保留一個 campaign；開啟測試台會終止仍掛載的正常戰役地形 worker。現在正常戰役與測試台各保留一組，重置只替換該 context 的快取。每組既有 96 MiB 地形／48 MiB 地景上限不變，最多兩組。
- 建造條件維持單行，僅未達項目改為鮮紅 `#FF0000`、字重 700。已達為既有綠色 `#88C78D`、字重 400。此處舊紅色為 `#E49786`。不改動其他警告與錯誤色彩。

## 驗證

新增手機／桌機各一個 real FormalWorldMap 掛載測試；檢查 viewport、背景／overlay 畫布尺寸、比例標籤定位、工具列折疊與展開，不發出正式軍令。測試 mock 只隔離地形 raster 排程與畫布 API。

新增正常戰役與測試台同時開啟／重置時的地形快取回歸，確認正常地形 worker 與在途 raster 工作保留。既有混合建造條件 UI 測試補檢查計算後顏色及字重，驗證「只有未達粗體」。

本輪執行 developer、地圖、建造資訊頁、scout UI、presentation boundary 等 14 個測試檔，共 118 項；最終結果見交付 evidence 的 regression.log。執行 TypeScript 檢查與 production build。

限制：本輪附件顯示路徑不存在，未能逐圖比對；已依實際 source 修正上述可確認問題。未進行真實瀏覽器或手機人工試玩，DOM／canvas instrumentation 不視為人工驗收。

## 人工試玩待驗收

1. 手機／桌機進入開發者模式 > B5 戰鬥測試台 > 測試地圖，確認地圖填滿外框、比例在左上、工具在右側。
2. 手機展開／收起工具列，放大、縮小、回城、全區及 XY 定位可用；工具不把地圖內容撐開。
3. 原戰役停留世界地圖時開啟測試台，重置測試情境再返回，確認原地圖背景正常並可繼續移動。
4. 進入建造頁，混合條件中未達為 #FF0000 粗體、已達綠色一般字重；全部達標後全部一般綠字。
5. 存檔重讀測試台，在途軍隊與戰報仍來自測試存檔。正式 combat resolver／scheduler／存檔 schema／兵種數值與戰鬥公式未修改。

完成本輪後 STOP。下一輪仍須另外明確授權，不開始 B6。
