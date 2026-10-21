# 與 PR #23 的整合建議（本輪未合併）

PR #23遠端HEAD d41473fd9a8e138d0efdc2ef593e6ac0196b63d9仍Open/Draft，未修改。交集實際為3個檔案，詳evidence/conflict-paths.json。只做逐段三方整合，不採任一整檔覆蓋。

| 檔案 | Hotfix需保留 | PR #23需保留 |
|---|---|---|
| GameApp.tsx | prepareUpdate callback、資格gate、更新期間busy、Home文案/原因/原始備份 | QuickSettings、CampaignSettings、開發者50/100X、移除B5入口、時間設定與齒輪偏好 |
| FormalHome.tsx | 非空資料不得顯示無存檔、動態更新按鈕及復原入口 | legacyAvailable與舊備份入口、舊局不相容時仍允許正式新局的條件 |
| useGame.ts | 即時status ref、唯讀存在性、prepareUpdate／correlated sync、繁中保存錯誤 | legacyAvailable、visibilityAt、PR #23的時間/離線/Recovery流程 |

新獨立模組campaignStorage與updateEligibility可直接沿用；FORMAL_DB_NAME跟隨正式版本，歷史namespace仍只讀。PR #23新增的legacy匯出不可當world匯入，也不可被Hotfix覆蓋成自動遷移。保持PR #23 World Clock／Durable boundary原樣。

中控先審查獨立Hotfix；若由中控之後合入main，PR #23再依最新main整合3個交集檔，補跑Hotfix81項、Worker/IndexedDB/SW、舊局阻擋與新局建立、快速設定動態換速及必要完整CI。不要因衝突採用整份Hotfix Home而重設PR #23的強制新局入口，也不要採整份UX-1檔案而恢復world=null即no-campaign的舊callback。這是後續核准後的建議，不是本輪已執行的Merge或功能PASS。
