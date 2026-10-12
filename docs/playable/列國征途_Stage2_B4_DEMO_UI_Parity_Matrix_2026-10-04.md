# DEMO UI → v0.30.9 Formal UI Parity Matrix

日期：2026-10-04｜UI baseline v0.30.2｜Runtime authority v0.30.8｜玩法 authority v84

狀態描述實作接線；不代表瀏覽器視覺／操作或玩家人工Smoke已通過。B5+入口保留但明示尚未開放。

| DEMO component / feature | v0.30.9 component / feature | 狀態 | Formal data source | Formal command path | 差異 | 原因 |
|---|---|---|---|---|---|---|
| Home 品牌／獅王圖／重返河谷 | FormalHome + BrandMark | RESTORED | FormalWorld.playerFactionId／factions／time／speed | load → FormalPersistence | 保留 DEMO 排版與文字層級；摘要換正式資料 | 恢復同款產品辨識 |
| 開始新遊戲／載入進度 | FormalHome → presentation/Start → GameApp | ADAPTED | FormalWorld summary；Formalcivilization IDs | start → runtime.worker → createFormalWorld → startCampaign；load → loadSave | 六文明卡片、名字、seed、五種速度；不沿用36領主 | v84 D7為100勢力／384世界 |
| 新局文明徽記 | FormalEmblem／CIV_ART | ADAPTED | Formal civilizationId | start.civilizationId | 明確處理拜占庭／蒙古別名 | Formal與DEMO ID不同，不能索引猜測 |
| 新局離線上限選單 | 未提供可變離線上限選單 | INTENTIONALLY_CHANGED | v0.30.8 runtime request／save契約 | 無 | v0.30.8 沒有 per-campaign offlineLimit 欄位與指令；不宣稱完整離線補算已支援 | 本批不能修改Formal save／runtime authority來引入舊DEMO離線設定；需後續正式補算驗證 |
| Home設定／三配色 | ThemeSettings + Dialog | REUSED | 裝置主題偏好 | 無，僅localStorage呈現偏好 | 三主題元件沿用 | 主題不改玩法 |
| Home快速存檔／完整備份／匯入 | FormalHome設定視窗＋GameApp匯入確認 | ADAPTED | Formal save；BattleReports | export mode quick/full；import → importSave | 實際驗證由Worker完成；先確認再替換 | 保留B1原子切換與DEMO拒絕規則 |
| 版本／更新資訊 | releaseNotes／version.json／檢查更新 | ADAPTED | 目前build版本／同origin version.json | 唯讀fetch；離線單檔直接顯示包版本 | 下載包沒有網站遠端部署通道；可查版本，沒有假造可用更新 | 本輪只交付下載包，禁止發布Sites |
| 桌機Top HUD與資源列 | presentation/Shell | RESTORED | citySnapshot → stock／netProduction | 資源按鈕開Modal；轉物流頁 | 人口／住房與駐軍摘要適配Formal資料 | Formal military與DEMO troops shape不同 |
| 人口／住房／產量／倉儲明細 | Shell + resource Dialog | ADAPTED | citySnapshot；productionPerHour；armyUpkeep；storageCapacity；protection | 唯讀；物流命令由治理頁發出 | 糧食已扣軍糧；統治初定反映於淨產量 | 不可拿legacy production計算 |
| 城市名稱／座標／城市切換 | Shell context-city／city-picker／Heading | RESTORED | spatial.owned → CityId | city.rename；切城只是本機呈現 | 桌機顯示名稱（座標）；手機用原下拉列 | 保留玩家熟悉選城邏輯 |
| 世界時間／速度 | Shell world-clock／mobile status | RESTORED | FormalWorld.time／speed | 無 | 開局後不切換速度 | 沿用Formal命令契約 |
| 雙頂部進度條 | Shell Progress | ADAPTED | ageQueue／researchProjects snapshot | age.start／research.start | 時代與科技可同時呈現；完成自動消失 | Formal durationSnapshot為唯一時間來源 |
| Desktop主導航九項 | Shell NAV + left-rail | RESTORED | FormalWorld／目前選城 | 依各正式頁面 | 原項目與順序保留；不每批改GameApp路由 | 後續B5～B9插回此架構 |
| Mobile HUD | Shell mobile-hud-main／mobile-resources | ADAPTED | 正式選城、資源、淨產量、軍隊 | 與桌機相同Formal命令 | 保留城市／時代／駐軍＋四資源；補小型人口時間列 | Formal所需住房與人口不能消失 |
| Mobile底部導航／更多 | MobileNavigation + Dialog | REUSED | 同NAV／view狀態 | 同各頁面 | 元件逐byte沿用；更多放任務、設定、首頁 | 純UI元件沒有舊引擎依賴 |
| Modal／背景點擊／Escape | presentation/UI Dialog | ADAPTED | Formal snapshots／本機視窗狀態 | 確認後才issue正式命令 | 搬移DEMO dialog行為到不含legacy content的模組 | 原ui.tsx含DEMO content／Start，需斷開authority |
| XY／最愛／地圖浮窗 | MapFloatPanel | ADAPTED | 正式座標／地形；裝置位置偏好 | 無；定位僅camera | 居中、標題拖曳、方向鍵移動、記住關閉位置；擴充視窗類型 | 元件純UI沿用，不保存成Formal玩法資料 |
| 城內／城郊視圖 | CityScenes + artMap | ADAPTED | citySnapshot → cityPresentation | building.upgrade／field.upgrade | 保留16／18 anchors與新增母圖；默認隱藏名稱 | 完整保留v0.30.8美術整合 |
| 手機城市放大／滑動／全景 | CityScenes mobile | RESTORED | 相同正式場景 | 無，切view／縮放僅呈現 | 手機默認放大可滑動；一鍵查看全景 | 沿用既有手機操作方向 |
| 建築／資源田資訊窗 | FormalCityPanel + Dialog + Cost | ADAPTED | B3 catalog／construction／fields | building.upgrade／field.upgrade（含lane） | 卡片成本、工期、缺資源、D2門檻及兩佇列；排隊後下一級正確 | 不能用DEMO成本或queue |
| City晉升／D2資格 | 城市建設頁badge／晉升按鈕 | ADAPTED | economy.milestones／cityPromotionCompleted／housing | city.promote | 新增必要正式功能，沒有另換Shell | v84永久資格與當下住房規則 |
| 科技頁／分類／科技資訊窗 | presentation/DevelopmentViews ResearchView | ADAPTED | TECH_CATALOG；本勢力techIds；researchProjects | research.start／research.contribute／age.start | 67項B4映射維持；現代後續能力明示前置 | D1不擴張到一般科技多城付款 |
| 軍隊／徵兵／訓練取消／解散 | ArmyView + unit modal | ADAPTED | UNIT_CATALOG；city.military；milestones | military.recruit／cancel／disband | 28兵種mapping不變；cost與時間讀正式函式；精銳實際轉換可見 | B4機制直接接回DEMO軍隊骨架 |
| 拓殖 | ArmyView 拓殖tab＋FormalDevelopmentPanel | ADAPTED | settlements／military護衛／正式坐標 | settlement.prepare／cancel／dispatch | 保留v0.30.8全部拓殖功能；地圖可將坐標帶回整備表 | 不可用DEMO建城成本、合法性 |
| 治理／多城總覽／城市運輸 | 治理頁 + logistics mode | ADAPTED | citySnapshot；logistics；autoLogistics | logistics.dispatch／logistics.auto.set | 商隊／自動物流嵌回治理頁 | B3/B4功能保留 |
| 天下勢力 | diplomacy-view／faction-grid | TEMP_DISABLED_B5_PLUS | Formal factions／owned城市數 | 無政治命令 | 可查看正式領主列表；外交／軍團停用 | B6尚未完成，不讀legacy政治 |
| 戰報紀事 | reports-view／details／每頁50則 | ADAPTED | Formal BattleReports | reportPage → FormalPersistence.readReportPage | 城務／科研可讀；戰鬥內容尚未開放 | 保持戰報與存檔分離 |
| 攻擊／偵察／戰鬥編組 | 軍隊與地圖頁disabled入口 | TEMP_DISABLED_B5_PLUS | 目前B4資料 | 無 | 只保留入口，不發無效戰鬥命令 | B5 resolver尚未實作 |
| 委任總督／政治帝國／帝國版圖 | 治理與世界工具disabled入口 | TEMP_DISABLED_B5_PLUS | 目前Formal沒有這些完整政策 | 無 | 明列尚未開放 | B6／B8權限邊界，不恢復DEMO gameplay |
| 任務／新手指引 | tasks-view + objectives | ADAPTED | 自有田／軍隊／城市數 | 導覽至正式頁面 | 唯讀完成狀態；沒有獎勵命令 | 任務玩法尚未實作，不能帶回舊reward |
| 戰役設定／存檔／回復點 | settings cards + restore Dialog | ADAPTED | Formal backupList／save summary | sync／load／backups／restore／export／import | 保持回復前確認與原子更新；原存檔失敗保留 | B1與R1 authority不變 |
| 領主改名設定 | 新局領主名稱；遊戲內不提供領主改名 | INTENTIONALLY_CHANGED | v0.30.8只有city.rename命令 | 無領主改名命令 | 城市可改名；領主中途改名暫缺 | Formal command契約不含faction.rename，禁止借用legacy玩家命令 |
| 流亡／現代化／奇觀／勝利頁 | 保留後續擴充路由 | TEMP_DISABLED_B5_PLUS | B4共用資格與ledger資料 | 無B7/B9新命令 | 不宣稱已完成後續玩法 | 本輪STOP於B4 |
