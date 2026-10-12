# Stage 2 B5 v0.30.23 驗收證據

Authority：v86 > v85 > v84 > source。唯一開工 baseline：v0.30.22；本批不開始 B6。

- refund-targeted：一般施工 active 50%、queued 100%；6 files / 115 tests PASS。
- core-regression：Astra Core 同一範圍擴充 B5；45 files / 440 tests PASS、0 pending。
- boundary-regression：援軍召回、建築/田施工破壞、20%帝都城防及地圖快取；42 tests PASS。
- ui-regression：既有桌機/手機派遣與戰報；4 tests PASS。
- scenarios-and-matrices：Raid/Scout/Siege/Conquest、五速度、固定432 slot、500編成、168 modifier與784 counter rows。
- persistence-and-recovery：真實 fake-indexeddb 交易的4故障注入、export/import、Recovery/R1、50X online/offline equivalence、倉儲貨物回程及資格快照。
- input-integrity：原始ZIP及5份hash宣告完整核對；624 source / 630 package，baseline commit 與624來源檔一致。
- typecheck：npm run typecheck PASS。

production build、發布結果與最終source/package hashes於交付包提供。這是implementation驗收，不冒稱另一輪Astra獨立Gate。
歷史B2–B4證據保留於原路徑；本輪結果只使用本目錄。實機FPS及168h/360h/720h屬B11，未在本輪宣告。
