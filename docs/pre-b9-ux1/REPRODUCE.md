# 重現方式

npm ci；執行 node scripts/verify-in-isolation.mjs full（不要在工作樹直接跑全部Vitest，舊測試會覆寫歷史docs）。Build時設定GITHUB_ACTIONS=true及GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin，再執行Pages及Release檢查腳本。

原生驗證用 Chromium、Playwright、Production preview，沒有加正式測試捷徑。evidence/browser-runner.mjs 接受 ux1、preview URL、輸出目錄。UX_PLAYWRIGHT_MODULE指定已安裝的Playwright入口；UX_PUBLIC_FIXTURES指定PR #21既有 scripts/p0c-master-browser.mjs 在基準main產生的公開合成 fixture JSON（P0C_FIXTURE_ONLY=1，保留99 AI）。此檔用來驗證舊版阻擋，不可換成新contentVersion。原始私人存檔不得使用或提交。瀏覽器輸出只提交結果與畫面，歷史archive留本機。

測試直接送Worker的設定命令帶入與useGame相同的語意前提stamp；真實版本衝突會另外保留REJECTED，不偽裝成功，不改timeout。滑條／拖曳／匯出／新局入口均透過真實UI操作。
