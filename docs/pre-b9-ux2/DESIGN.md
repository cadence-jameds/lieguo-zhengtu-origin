# UX-2 特殊資源疊圖

獨立基準main148f699ebf38c9ca77d665049d7aa4901e2cf83c（PR21已合併，正式v0.30.55）；不依賴UX-1。只修改FormalWorldMap、MapToolbar及新增的Presentation分類／快取模組；不修改Formal資料、存檔、生成、種子、fieldDistribution、拓殖資格、最愛容量或帝國政治規則。

分類只呼叫正式fieldDistribution(seed,x,y)。先檢查官方terrainAt／buildable與SpatialIndex的城市、實際據點及拓殖預約。幾何分類可快取，動態占用每次查核，避免城市易主／成立、據點或預約更新時出現陳舊標記。

視野外不分類／繪製；矩形查詢上限4096格，超過就使用LOD並提示放大，全區視角0格分類。每個map instance以seed/coordinate為key，LRU最多8192筆，不寫Formal世界。七田藍、九田紫、十五田金，細框與小字保留地形及政治塗層；標記不攔截pointer，沿用原地圖點選、完整分布、最愛與容量5。

預設關閉；主開關與三種篩選存在裝置localStorage。隱藏／顯示面板沿用MapFloatPanel的拖曳、手機邊界及關閉方式。與UX-1正式檔案不重疊，可獨立審查。C4仍HOLD，非效能Gate驗收。
