# v92 復工前 WIP Delta Audit

Authority：v92 主規格（319,493 bytes／5,137 lines，全文閱讀）；SHA256 `2bb36aed23595b52b38e15ab5c76be883ec854c57517eaf61187af1f2c43e0e6`。復原／衝突稽核、機器稽核 JSON、B6–B8 恢復指令均已全文閱讀。

正式 baseline v0.30.40：`c8af4ceece88bebecb9c3c0cf93ca6a337186182`，source zip 指定 SHA `1a31aca48f39f77bfb70d8a4f7586684cb45ea6b3a2ae65208f42a687f8ac600`。復工 WIP：`9cc3dbcae0a04747f776903885541014a8953327`，947 tracked files，獨立 bundle 還原後逐檔比對一致；工作樹只有環境 dependency symlink。未 hard reset、未丟棄任何進度；新分支 work/b6-b8-v92 接續原 WIP。

| 章節／契約 | 分類 | 現況與施工處理 |
|---|---|---|
| §5 經濟／庫存／城市個別里程碑 | KEEP | 沿用 B3–B5；政治不授予城市資源、人口或研究權 |
| §6 所有權／征服 | DELTA_FIX | 聯軍必須依 joint.initiator 而非第一抵達者取得存活優先權 |
| §6.4–6.6 滅國／復國／流亡軍／工匠團 | PENDING | B7 未施工，須接入取消研究／佇列與完成戰役後殘軍處理 |
| §7 行軍／援軍／糧耗 | KEEP | 真實 path、軍隊原 Faction 所有權與本方糧耗；不恢復舊取消援軍條款 |
| §8／v91 主戰、攻城、12 上限與去重 | KEEP | 現有 resolver 保留，B6 僅接合法聯軍與最終歸屬 |
| §9 軍團／帝國／友好雙方同意及六小時解除 | KEEP | 已有命令、排程與 UI，保留，不重做 |
| §9 政治 lifecycle／聯軍索引／外交事件 | DELTA_FIX | 移除失效 metadata、強化參照及序號驗證；失去使館仍可離團／拒絕請求 |
| §9 戰報分享／聯防情報 | DELTA_FIX | 加入同軍團戰報權限；警報不因 renderer 公開隱藏兵數／科技 |
| §10 99 AI 同權、錯峰、自主經濟／軍事／外交 | PENDING | B8 尚未開始；需 legal observation → 同一 Formal command，不採 DEMO AI |
| §11 Persistence／Recovery／戰報分離 | KEEP + DELTA_FIX | 沿用原子保存與 Recovery，新增狀態強化驗證及 save/offline 回歸 |
| §12 現代終局 | PENDING | B9 範圍，只保留既有型別／资格接口，不提前實作奇觀或勝利 |
| §13 廢止方案 | KEEP | 無首都／免費AI資源／士氣撤退／8兵占領／政治共享研究 |
| §14 長測／實機 | PENDING | source168/360/720h與手機實測留正式驗證，不把模型或DOM冒充PASS |
| §15 分階段封存與 Gate | KEEP | B6→B7→B8 各自 source/commit/hash/evidence/art/smoke/handoff，B8 STOP |
| v92 軍隊與雙劍 Presentation | KEEP + DELTA_FIX | WIP 已接全部 Formal army path、AIvsAI combat/siege 單點最後層雙劍；補完整路徑cache識別 |
| B5 E1 | PENDING | 原 Astra HOLD 維持；玩家特例授權施工不等於 PASS |
| v92 §7 舊「不設增援駐軍」殘句 | PENDING（文件整理） | 明確被 §7.15／§13 取代，非實作 BLOCKER，不自行改原文 |

BLOCKER：目前未找到需要變更 LOCKED 規則或重置 source 的實作阻塞。上列 KEEP 表示保留策略與已存在成果，不代表完整 Gate PASS。

既有 regression：最後 WIP 59 files／746 tests passed；typecheck PASS；早期 build PASS，但最後 WIP 改動後尚未重跑 build。失敗與修正歷史保留於原 checkpoint。無真實手機／人工瀏覽器證據。
