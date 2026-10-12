# 列國征途 v0.30.28｜v88 City 與建築資訊頁更新報告

日期：2026-10-08。Baseline：v0.30.27，commit `76c0a3a17d853d48ac43ac12b0fc4ccafa12f3c6`。唯一規格 authority：v88；以目前最新 source 做 delta，沒有回退 DEMO 規則或重做 B2～B4。

## 更新結果

- 20 種建築／固定設施共用 BuildingDetail＋專屬 section。已建與未建建築均能查看資訊；未建頁保留所選空地，使用既有 building.upgrade 正式指令建造。18 格資源田仍用獨立頁。
- 頁面顯示目前效果→下一級、逐項✓／未達、下一級四資源成本、實際施工時間、排隊及剩餘、正常升級／最高等級、合法拆除和取消。下一級新增科技、時代或 City 建築資格明確提示。軍事建築另顯示套用科技後每種兵的實際時間倍率。
- City 正式晉升唯一入口：城市建築＞市政廳。城市概況原按鈕移除；城市中心只保留勢力時代晉升。
- 晉升維持人口10000、住房10000、市政廳Lv5、糧12000／木18000／石18000／金12000及固定6世界小時。獨立專案，條件只在啟動檢查，不因後續人口下降中止。
- City永久倉儲公式：`800 + floor(Σ倉庫基礎容量 × 1.10)`。未完成仍為800＋原總量；固定800不加成。所有既有入庫、自然產出、預約、到貨、拆除／攻城裁切共用同一storageCapacity。開發者近無限資源維持既有優先權。
- 晉升保留Lv11～15永久City資格，後續新工程仍須曾達人口10000及當下住房10000。都市主體在地圖與城郊入口使用正式City階段既有美術，完成後不依人口／時代回退；地圖快取會因City完成旗標更新。
- 市政廳整合晉升狀態／進度／世界與現實剩餘、行政網路X/15及倍率、統治初定、六永久里程碑與兩種第二佇列／四種精銳城市資格。
- 地庫統一名稱，Formal bunker identity不變。地庫不增加儲存容量，保護量規則不變。
- 建築／研究前置及報價提為Formal共用selector，實際指令與資訊頁讀同一規則。施工加速、研究加速、產量加成、人口加成、兵種時間、城牆防禦及耐久均讀Formal公式／catalog／runtime，沒有另一份UI平衡表。
- 一般施工active取消50%、queued100%維持；訓練／科技／City／拓殖各自規則沿用。

## 明確保留的未接線邊界

現有Formal沒有城市治理設定或軍團資料／軍團長容量catalog；市政廳與使館顯示尚未開放，不讀legacy的balanced作正式治理狀態，不捏造使館容量。帝國顯示現有Formal empireId或無。Lv11～15高階政治僅資訊預告，不提供command。市場對外交易、外文明衛隊生產同樣唯讀；城堡來源保存不新增B7工匠團或外文明生產機制，不授予外文明科技。

新增optional castleCivilizationId供已記錄城堡保留來源；正式新施工依建立工程的receipt確認文明，城市易主在原owner下記錄已建城堡。舊存檔沒有來源欄位／建造歷史時仍只能以舊資料現有owner回退，不宣稱能還原更新前已遺失的來源歷史。Formal schema3及既有Stage2契約版本沿用，此輪不是B11凍結；v0.30.27原生Formal存檔可正常載入，沒有DEMO存檔migration。

## 驗證

- 完整Formal回歸：54個測試檔、531項PASS，包含B1～B5、持久化／Recovery、事件／退款、科技／軍事、攻城／偵察／戰報、v87盜賊及既有UI。最後未建資訊頁接線後再跑BuildingDetail＋wallDelta：2檔62項PASS；新增2項，合計533個唯一測試。
- City targeted：多倉庫225組等級組合；無倉庫800、單Lv15為110800、雙Lv15為220800；6h邊界、人口下降、重複拒絕、支付rollback、讀檔、田Lv11、入庫預約／到貨／攻城裁切、保護與產量不變、開發者容量、城堡已建及施工期間來源均PASS。
- UI：20建築×手機／桌機40份HTML；全部共同骨架及專屬資訊、最高等級、晉升唯一入口、18田獨立、研究／徵兵導覽／施工／拆除／未建保留建地接線與已排至最高等級狀態PASS。
- TypeScript typecheck與production build PASS，發布流程將對推送後的同一source再建置封裝。
- 此輪UI證據為DOM互動、HTML及Formal資料檢查；現有環境沒有可用control-browser技能，未進行真實瀏覽器像素／觸控／FPS驗收，不宣稱實機視覺PASS。

## 證據與交付

共用元件：src/game/presentation/BuildingDetail.tsx；Formal投影：src/game/formal/buildingDetailData.ts。測試：cityV88.test.ts、buildingDetail28.test.tsx及既有wallDelta更新最高等級顯示斷言。docs/ui-v03028保存完整JSON／log、40頁HTML、City數據、20頁覆蓋矩陣、v87seed／slot／generation矩陣與既有B5情境重跑。舊版本證據文件還原，沒有把新結果冒充舊驗證。

v88完整文字副本55445bytes，SHA256 `f2685e37d642de5fd8acd2cf53838fd14a530809a3b8900a162e0a1924be5a83`；由已解析的v88檔案取得，保留原規格詞彙作authority紀錄，UI採使用者最新「地庫」命名。

STOP：未開始B6、B7、B8或其他新階段。完整source／report／evidence／hashes／handoff另行打包。
