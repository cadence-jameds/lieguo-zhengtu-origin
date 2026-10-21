# UX-1 驗證與交接

基準 main：148f699ebf38c9ca77d665049d7aa4901e2cf83c（PR #21 已合併；正式 0.30.55，原 main CI/Pages 成功）。
最終正式程式樹 766813be8133e4d5218b6d1a4255f6eaf57d58f2；本機 09531434124c1adc169e8fcf8b9f32ae47e52dbc 與 GitHub 0366ef0756ed8da8f24e5cdb5f707ae98c6dba87 為相同 Git tree。API 提交作者不同，未改寫原施工 checkpoint／main。

## 已完成驗證

- Typecheck、Production Build、Pages 路徑/PWA scope、Release Metadata/Worker identity 一致性通過。最終本機 Production build 指向 0953143，dirty=false，版本由原自動化計算（未手改版本號）。
- campaignTime + quickSettings：18 通過、0 失敗。25 種一般速度／離線組合、非法50/200X與6/24h拒絕、一般與開發者速度優先序、離線封頂、事件識別與戰鬥節奏、99 AI 1/25/100X 決定性、舊局阻擋、備份保留、CAS／Checksum／Receipt／重試／Recovery 及3個寫入故障點原子回滾。
- 受影響 Worker／戰鬥持久化／開發者隔離／既有 UI：88 通過、0 失敗（首次固定倍率舊測試修正後）。
- 最終 Admission／Worker／玩家 FIFO 回歸：88 通過、0 失敗。新增設定／保護罩／權屬前提核對、並發與陳舊指令拒絕、AI 追算後開發者設定可合法提交，故障不暴露草稿，Receipt 單次。與前一組有重疊，不可加總當獨立測試總數。
- 原生 Chromium 正式 Production bundle：1440×900 桌面、390×844 手機模擬，9 組案例通過、0 失敗、0 pageerror。滑鼠／觸控拖曳不開選單；滑條暫存、取消、durable 套用；320×568縮放修正、重載位置、隱藏／重現；5種速度及5種離線上限；開發者50/100X與一般3X恢復；重複 away/resume 不重複補算；新局保存／載入／Recovery。每局保留99 AI。
- 原生離線：桌面1558ms離線按3X推進4674ms；手機1266ms按3X推進3798ms。開發者100X沒有用於離線。詳見 chromium/result.json，不把這些短期測試當C4長局效能結果。
- 舊 namespace 放入原公開合成舊存檔、備份：精確繁中阻擋訊息出現；歷史匯出 envelope 與原始 checksum相同；建立新 campaignId 後，舊快照仍逐欄相同，新世界0舊Receipt。原始存檔/匯出檔均未上傳。

## 保留的失敗與修正

第一次完整隔離回歸為1435通過／44失敗／1skip，原始JSON保留。初次兩套完整測試並行造成原有長測／短輪詢期限失敗；另有測試使用已廢止的一般50X、開發者200X、離線6/24h與舊局自動遷移預期。改用核准設定與負向舊局測試，沒有放寬期限或刪除案例。第一次定向重跑曾省略 full 的全域30s設定而使用5s預設；該診斷亦保留，不能與正式 full結果混算。

實際修復：離線 clone 導致零時間推進revision未遞增；手機／桌面新開關點擊區域；開發者設定碰上AI事件追算時反覆版本衝突。最後一項只將 developer.configure 納入現有語意前提核對，保留 developer設定與保護罩 stamp、權屬、前景寫入/branch fence及最終Reducer/CAS，不改AI頻率、事件順序或C4核心。

初次原生腳本沒有使用UI的playerBase且重試ID前綴格式錯誤，對應拒絕完整保留；修正測試驅動程式後才記錄最終9組通過。新版UI真實失敗有先負向重現後修復，未使用force點擊、假ACK或放寬逾時。

完整隔離最終驗證由 PR #23 最新GitHub CI執行；保留所有歷史失敗，以最新HEAD結果為準。

## 人工驗收與限制

尚未驗證實體Android、低階GPU、極端長局100X背景切換；不宣稱真機PASS。私人存檔未讀取或上傳。動態戰鬥換速沿用既有tactical cadence（10X上限），其餘事件保留World Time。

UX-2 #22與本PR正式程式修改沒有交集，均從main獨立建分支。原35組AI長測、歷史AB/BA與DEMO證據不重跑、不刪除。C4持續HOLD；本輪功能不表示Gate PASS。未Merge／Deploy／關閉Issue，未開始B9世界奇觀。

## 完整CI發現的舊預期（保留before FAIL）

GitHub CI 39526964454（c010976，job118983822536）：1486通過、4失敗、1skip。3個mountains31案例仍要求舊terrainVersion2自動遷移，已改成Load／Import／Recovery均明確拒絕且saves／backups／BattleReports逐筆不變、world-write=0；仍保留原始城市／據點／在途路徑／時間／Receipt／對角鄰格不變斷言。當前版本的Checksum與偽造山脈拒絕另行保留。

第4項autonomyRuntimeR2c案例用真實performance時間卻假設重複load無時間經過；新正式load會先durable保存前景進度。以固定時鐘分開驗證零時間不再保存／啟用，及非零時間先保存、99AI與事件ID不重複，未放寬timeout。

完全相同的舊測試在隔離副本重現4項FAIL（evidence/ux1-policy-before-fail.json），修正後9項通過0失敗（evidence/ux1-compat-ci-fixes.json）。此提交只調整與核准新局政策矛盾的測試及其確定性時鐘，未改正式程式。全部原始CI數據仍位於該run的regression artifact，沒有抹去舊失敗／Gate。最終完整結果以最新HEAD CI為準。
