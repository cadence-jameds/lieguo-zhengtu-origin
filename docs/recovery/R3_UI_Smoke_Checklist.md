# R3 UI Smoke Checklist

## 2026-10-13 Browser Delta 最新狀態

見 [Delta Report](../validation/r3-delta-2026-10-12/REPORT.md)：治理6組速度／負載矩陣共36次套用＋停止、商隊／拓殖／工匠實際移動、流亡「流」（含一般labels off）、六文明外城堡、Raid瞬時效果、Save／Load／Recovery去重、未偵察敵情遮蔽、手機viewport可信touch拖曳／pinch及reduced-motion已取得真實Windows Chrome證據。市政廳舊文案已改，治理合法前置未變。

實體手機、長期GPU／FPS、完整復國流程仍需人工驗收。這不是 Astra Gate PASS；以下表格及2026-10-12段落保留原基線與歷史結果。

| 情境 | 自動驗證 | 真實瀏覽器／實機 |
|---|---|---|
| 正式384、100勢力、432據點 | PASS，100個真實Formal dispatch及typed IDs | MANUAL PENDING |
| 全AI path位置、45°方向、连续插值 | PASS，正式路徑／時點與唯讀shaderassertion | MANUAL PENDING |
| cache／culling／LOD | PASS，100条路线重复10frames只100次miss，越界遮罩 | GPU/FPS／視覺密集度PENDING |
| AI vs AI主戰／Lv15 Siege | PASS，正式進入siege，後續回合徽記保持，final消失 | E1人工PENDING，不能替代Lv15實機 |
| 城市／野外Raid終戰效果 | PASS，actual receipt位置、停止／重播去重／reduced | MANUAL PENDING |
| 商隊／拓殖／工匠 | PASS資料與cache，實際departure／各typed ID | MANUAL PENDING |
| 市政廳／治理頁 | React/happy-dom命令接線PASS | 桌機／手機觸控PENDING |
| 六文明外城堡、流亡「流」、復國入口 | 已接入，B4/B7資產／正式引用KEEP | 人工圖像辨識／排版PENDING |
| 敵軍情報權限 | PASS，地圖基本marker无精確兵種數量／HP／科技 | 人工訊息漏出PENDING |

此Checklist只区分自动断言与人工实测，没有Astra Gate PASS。

## 2026-10-12 本地瀏覽器補驗收（以上表格為原基線紀錄）

最新證據見 [Windows Chrome驗收報告](../validation/r3-local-2026-10-12/REPORT.md)：正式384／100勢力／432據點、新局、桌機城市／地圖／拖曳／縮放／XY、正式AI自主偵察行軍、受控100軍隊、AI對AI Lv15 Siege跨回合雙劍及自然final移除、保存重讀已取得真實Chrome證據。短時RAF採樣與cache／LOD有紀錄，但不等同長期GPU/FPS驗收。

治理委任、正式付款與施工、1X方針套用及停止成功；50X密集事件場景方針套用發現版本衝突拒絕，另有市政廳舊文案。390×844手機viewport可信觸控拖曳／雙指縮放通過；實體手機、完整reduced-motion、商隊／拓殖／工匠、六文明／流亡／復國、Raid特效與完整敵情權限仍待驗收。沒有Astra Gate PASS，未開始R4。
