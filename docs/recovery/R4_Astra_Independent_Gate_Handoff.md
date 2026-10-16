# R4 → Astra Independent Gate Handoff

R4 完成後 STOP，等待 Astra 唯讀獨立審查。這份文件是交接，不是 Gate PASS 或發布核准；B9／B10 未開始。分支 `stage2-r4-integration`，base main `d5c0712b2b7ad1cd580999f97918f132d57c8f21`。最終PR head及tree以GitHub commit及evidence manifest核對。

## 待独立抽查

| 抽查 | 工程證據／重現入口 | 剩餘邊界 |
|---|---|---|
| B6 consent、使館資格、2→1→0、失效scope工程邀請 | politicsB6/politicsPersistenceB6/empireDeltaR1及integrationR4；真Chrome帝國／城市公開政治顯示截圖 | 複核發布前UI Delta與同一正式資料是否一致 |
| 聯防原所有權／留守、聯軍正式等待／出發／會師／final | 政治回歸與新聯軍→最後城滅國鏈 | 不以受控高兵力fixture推論自然平衡 |
| B7 engaged extinctionPending、floor25、工匠carrier／轉移／失城重路由／完成才消耗 | extinctionB7/extinctionPersistenceB7及integrationR4 | 獨立抽查同時事件、失城時工程取消與工匠去重 |
| 外文明城堡／衛隊／科技隔離；AI禁止復國；玩家400／600／48h | controlled-chain.json、完整回歸、真Chrome復國 | 六文明完整人工操作／實體裝置仍MANUAL PENDING；歷史R3六文明素材證據保留 |
| B8 lawful intel／12h24h老化／反事實隔離／inactive／正常cost | autonomyR2a/R2b、governanceR2c；3seed公平8h；governance36次Chromeack | 公平8h均未成熟到政治／戰鬥；長期自治分布不可當PASS |
| 原子IDB三store、CAS、Recovery／rolled-back、完整import／history cursor | full regression及controlled-persistence.json；真Chrome匯出/重讀/改名回復/損壞checksum | Recovery新分配ID及流亡位置可因durable高水位改變，請核對此既有契約；不是byte replay |
| R3全owner行軍／AI雙劍／Raid terminal／減少動態／load不重播 | worldDynamicsR3、armyOverlay、browser.json、實際截圖及map dataset | headless軟體環境不能充當實體GPU FPS或玩家目視驗收 |
| B9境界、v92與R3修復保留、release不動 | scope.json、diff及Git祖先鏈 | 既存emergency-modernization工程只作清理fixture，沒有新增B9執行 |

## B5 E1 原 HOLD 追蹤

權威：`docs/b6-v92/河谷戰役_vNext_平衡重構討論_v92.md` §v92-4。Astra對v0.30.39的正式結論為HOLD，唯一BLOCKER是E1真實瀏覽器人工證據不足；玩家M1～M6觀察正常，但 **M3為Lv10→Lv10，不能改寫成Lv15**。玩家施工例外只授權B6～B8／本次R4，不代表Gate放行。

歷史R3真Chrome Lv15攻城與本輪實際Lv15 AI vs AI、Siege11→12終戰、雙劍、讀檔、Recovery、觸控與PWA離線證據可供E1 Delta Review參考。原B5測試台操作清單仍在 `docs/b5-lab-v03033/manual-checklist.md`、v91邊界在 `docs/b5-v91/README.md`；没有代填那些人工checkbox。原先M3要求的特定玩家操作／目視與獨立Delta裁定，尚未由Astra完成。

| HOLD／PENDING項目 | 本輪狀態 |
|---|---|
| B5 E1合理關閉與v0.30.40 UI Delta一致性獨立核對 | HOLD，提交工程證據，待Astra裁定 |
| 原M3 Lv15特定人工情境及玩家目視覆核 | MANUAL PENDING；不得用歷史Lv10或AI自動情境冒充 |
| 實體手機、完整玩家長時間操作、硬體GPU效能 | MANUAL PENDING；390×844 Chromium＋CDP touch僅viewport／真browser automation |
| 已部署舊版→新版SW更新與保存並更新 | MANUAL PENDING；本輪只測fresh本機production PWA install／離線啟動，沒有部署 |
| Day30／168h／360h／720h及成熟政治分布 | MANUAL PENDING，後續獨立Gate／長期校準追蹤，不在本輪提前開始B9/B10/B11施工 |
| 舊版個別使用者晚期存檔再推進6h | MANUAL PENDING；既有 `batch210.test.tsx` 依 `REALM_REGRESSION_SAVE` 啟用，本輪未提供私人存檔，保留原SKIP，未改成無條件PASS |
| Astra Independent B6～B8 Integration Gate | NOT EXECUTED / NOT DECLARED PASS |

## 審查時的固定限制

不得因本PR自動測試通過直接升級正式接受紀錄或關閉E1。Astra獨立review後若需要修正，另由玩家授權或review結論啟動限定delta；本輪不自行繼續。不得更改v92成本／兵種／12回合公式，不merge至release或調用deploy workflow。PR只供review，沒有部署授權。
