# B10 合併順序與自動部署（使用者最新決議）

2026-11-10使用者明確取消main部署隔離：不安裝718a71e／dc14401，不建立workflow-only PR。PR61的deploy-pages.yml還原為main443f170b相同內容。main push經既有完整回歸、Typecheck、Build、Pages／Release驗證成功後自動部署GitHub Pages。

技術驗收與detached模擬結果見 [最終驗收](final-seal/RESULTS.md)。取得**下一次明確授權**後才可依 #54→55→56→57→58→59→60→61 順序用merge commit整合；不用rebase。每次核對實際main、HEAD、Base、CI及Release Notes，等該main的CI／Pages完成後再做下一步；合併已接受會自動部署。不得把本批策略授權當成按下Merge的授權。

Android安排合併後實機驗證；目前仍NOT TESTED。PR目前維持Draft，沒有遠端main修改、Ready或部署。下方舊護欄方案只留歷史來源，已被本段決議取代。

<details>
<summary>本輪以前的歷史原文（失敗與來源保留，現行狀態以前文／最終驗收為準）</summary>

# 安全整合與發布隔離

本分支只提交可審查 workflow，不修改 main、不執行 Actions dispatch、不部署、不將任何 Draft 改 Ready。現有 main 仍是原自動 Pages 部署 workflow，故**不能在此護欄先落地前合併任何 B10 功能 PR**。

## 必須先安裝的獨立護欄

第一個隔離提交 `718a71e` 僅修改 `.github/workflows/deploy-pages.yml`，保留 push main 的完整驗證、正式 Build、Pages artifact、Release Metadata；移除 push 的 deploy 權限路徑。後續獨立提交 `dc14401` 補上 shell 精確比對，必須一起安裝。GitHub expression 字串比較不分大小寫，不能只依賴 `if:` 的 owner／token 比對。

可由使用者另行授權，把上述兩個 workflow-only 提交依序 cherry-pick 到 main 的審核分支，檢查完整 diff 只有該 workflow，再完成審核及合併。這個安裝步驟本次**未執行**，也沒有建立其他 PR。先確認 main 上 push 只驗證、不 deploy，才可開始下列整合。

之後依序以 merge commit 保留堆疊祖先：**#54 → #55 → #56 → #57 → #58 → #59 → #60 → #61**。每一步核對實際 HEAD、Base、Draft 與新審查，保留祖先關係，避免 squash／rebase 後堆疊重新出現已整合變更。上游沒有改動的前提下，本機 detached worktree 的模擬結果另記 `merge-simulation.json`；模擬沒有更新 main／origin refs，也不代表真正合併授權。

本機最終 detached 模擬採用 main `443f170b`、兩個護欄提交、#54～#60 原 HEAD，再合併 `1f44074`，全部無衝突且嚴格 Release Metadata 檢查通過。該**模擬**產生 `0.30.82`、合成 merge SHA `7a0a787ce28a8a10fd0fd5c3afbffd45f0f92597`；這不是實際 main／發布 SHA。開發分支產物則是 `0.31.19`／`1f44074`，first-parent 計數不同，不能手動提升 main 版本來對齊預覽版。實際整合時必須重新計算，且目前 SW P0 仍禁止放行。

最終合併產生的 release version／contentSha 必須重新由 `scripts/release-metadata.mjs` 算出，再檢查產物。堆疊分支與 GitHub merge checkout 的 first-parent 路徑不同，版本不必相同；不能手動指定版本或把開發分支版本當作實際 main 版本。

## 日後正式發布

只允許使用者再度明確授權的 workflow_dispatch，由指定 repository owner，在 exact `refs/heads/main`，提供完整匹配的 40 字元 HEAD SHA 及 exact `PUBLISH_B10` token。shell 再核對 repository／actor／ref／token／SHA，Build artifact 仍需通過完整驗證。錯誤 SHA、大小寫異體、非 main／非 owner／push 事件均不得部署。

`node scripts/test-deployment-isolation.mjs` 解析實際 workflow，涵蓋 GHA case folding 與 shell exact guard；不是另一份 workflow 替身。沒有宣稱 GitHub Environment 的人工 approval 已設定；若另加 environment protection，必須由有權限者在 GitHub 配置及實際核對。

技術合併與正式發布分開判定。Android、B5 E1 HOLD、Astra 非 PASS 不因桌面 CI 改變；正式發布仍 HOLD。不得為驗證而發布正式 Pages。

</details>
