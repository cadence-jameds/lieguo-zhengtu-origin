# R3 真實瀏覽器驗證紀錄

## 2026-10-13 R3 Browser Delta Fix

最新結果見 [Browser Delta Fix Report](../validation/r3-delta-2026-10-12/REPORT.md)。50X／100 軍隊的治理 snapshot 與 Worker admission revision 競態已透過治理專用 compare-and-set 修正；Formal revision／storage CAS、資格、資源與命令去重仍保留。真實 Chrome 六組 1X／10X／50X × 低負載／100軍隊共36次套用與停止成功；舊玩家設定拒絕、重播無重複付款／事件。市政廳舊文案及 labels off 流亡「流」也已修正。

商隊／拓殖／工匠動畫、六文明外城堡、Raid、保存／載入／Recovery 特效去重、敵情遮蔽、可信模擬觸控與 reduced-motion 均補有真實 Chrome 證據。R3相關完整套件1095 PASS／1 SKIP；全套仍有3項已證明原基準存在的legacy art失敗。Typecheck／build PASS。實體手機 MANUAL PENDING，不宣告 Astra Gate PASS。新 commit／Source ZIP／bundle／完整 trace 封存識別見 artifacts/r3-browser-delta-2026-10-13/checkpoint.json。

## 2026-10-12 Windows 本地補驗收

已在分支 `work/r3-browser-verification`、HEAD `4ed0f1073aafbc675b24bf8351818e76a45a76a9` 實際透過 Playwright 1.64.0 控制本機 Chrome 154.0.8037.98，成功開啟 v0.30.49，完成新局、地圖拖曳／縮放／XY、城市工程、正式 AI 自主偵察行軍、受控100軍隊、AI對AI Lv15持續攻城與自然終戰標記移除、保存重讀、治理委任／套用／停止、手機viewport觸控模擬及部分reduced-motion。

29張真實截圖、Console、原始操作（含失败）、兩份trace及測試存檔保存在 [本地驗收報告](../validation/r3-local-2026-10-12/REPORT.md)。Console error／pageerror／requestfailed／HTTP錯誤為0；密集事件下治理設定曾遭版本衝突拒絕，市政廳仍有舊「尚未開放」文案。主要操作已補真實瀏覽器證據，但完整UI／Astra Gate仍未宣告PASS，未修改平衡或開始R4。

以下保留先前 Cloud Chrome 的歷史失敗紀錄；不代表本次 Windows localhost 的結果。

環境：Node24.19.0、Vite8.0.13、本輪獨立恢復repo；Cloud Chrome cdp真實瀏覽器。

實際嘗試：vite綁0.0.0.0因uv_interface_addresses錯誤退出；改用127.0.0.1後143ms啟動成功。透過正式Browser API建立新tab並導航http://127.0.0.1:5173，Chrome回報net::ERR_CONNECTION_REFUSED。讀取troubleshooting並檢查錯誤頁DOM時，Browser URL policy阻擋錯誤頁protocol。未繞過政策、未切換rawCDP/其他瀏覽器表面、未更新Sites或公開此repo。

結論：MANUAL PENDING。沒有取得遊戲頁面、實際操作、FPS、手機viewport或可驗收截圖。不能把Canvas proxy／happy-dom測試當成真Chrome或GPU效能PASS。本地production build与正式数据渲染测试可执行，浏览器项按玩家附件允许在R4明确追踪，不宣告UI Gate PASS。

待驗收：新局→世界地圖→縮放→全部AI與玩家同時行軍→AI vs AI／Siege雙劍→正式終戰移除持續標記→城市治理→手機觸控／reduced-motion→大量單位FPS及切換延遲。
