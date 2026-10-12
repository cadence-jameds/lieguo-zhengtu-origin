# R3 真實瀏覽器驗證紀錄

環境：Node24.19.0、Vite8.0.13、本輪獨立恢復repo；Cloud Chrome cdp真實瀏覽器。

實際嘗試：vite綁0.0.0.0因uv_interface_addresses錯誤退出；改用127.0.0.1後143ms啟動成功。透過正式Browser API建立新tab並導航http://127.0.0.1:5173，Chrome回報net::ERR_CONNECTION_REFUSED。讀取troubleshooting並檢查錯誤頁DOM時，Browser URL policy阻擋錯誤頁protocol。未繞過政策、未切換rawCDP/其他瀏覽器表面、未更新Sites或公開此repo。

結論：MANUAL PENDING。沒有取得遊戲頁面、實際操作、FPS、手機viewport或可驗收截圖。不能把Canvas proxy／happy-dom測試當成真Chrome或GPU效能PASS。本地production build与正式数据渲染测试可执行，浏览器项按玩家附件允许在R4明确追踪，不宣告UI Gate PASS。

待驗收：新局→世界地圖→縮放→全部AI與玩家同時行軍→AI vs AI／Siege雙劍→正式終戰移除持續標記→城市治理→手機觸控／reduced-motion→大量單位FPS及切換延遲。
