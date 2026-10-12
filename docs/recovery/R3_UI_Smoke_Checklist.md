# R3 UI Smoke Checklist

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
