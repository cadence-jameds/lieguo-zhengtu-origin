# B7 Art Delta Manifest

| 分類 | 接線 | 證據 |
|---|---|---|
| REUSE | 六文明城堡母圖、工匠文字符號與現有card/dialog樣式 | CityScenes→FormalBuildingSprite；BuildingDetail→castleSource |
| ADAPT | 世界「流」short label、selection「流亡軍隊（流）」、合法raid/scout入口 | SpatialIndex.addSite(extinction.sites)→FormalWorldMap query/pick/paint；wildSiteName |
| NEW | 工匠待命／隨軍返回／轉移／施工與文明來源 | ExtinctionView CraftsmanPanel→FormalCommand |
| NEW | 玩家滅國／候選區域／復國 | GameApp→RebirthView→player.rebirth |
| ADAPT | 外文明城堡在施工與完成畫面使用文明母圖；軍隊頁顯示該堡衛隊 | Construction.castleCivilizationId→CityScenes；ArmyView castleSource |
| DEFER | 現代衛隊完整美術／奇觀 | B9整合Gate後 |

所有狀態來自 Formal extinction／Construction／City。沒有 DEMO 軍隊／AI state。使用既有圖片，不生成重做美術。
