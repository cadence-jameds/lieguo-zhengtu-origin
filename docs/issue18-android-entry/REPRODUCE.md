# 隔離重現

使用Node22.13+、npm ci；完整測試只執行node scripts/verify-in-isolation.mjs full（舊測試會寫入docs，不得直接在正式工作樹跑整套）。Production Build設定GITHUB_ACTIONS=true與GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin，沿用既有Pages及Release Metadata檢查。

Native runner需要Chromium、已安裝的Playwright入口（R18_PLAYWRIGHT_MODULE）、R18_NATIVE_ROOT、R18_NATIVE_URL及R18_PUBLIC_FIXTURES。後者是原PR #21 scripts/p0c-master-browser.mjs產生的公開合成fixture JSON，不能使用私人存檔。prepare-native.py顯示本次雲端位置與各fixture標籤/identity/revision的唯一改動；需要按本機路徑調整輸入位置。

用serve-native.py準備localhost5218伺服器，依序跑native-runner.mjs。fault-55只在隔離Worker副本收到sync時，以原生transaction.abort注入儲存故障，不能寫入正式src/dist或部署。單一scope unregister只用於隔離profile故障重現。

只提交JSON結果、畫面、fixture manifest與runner；本機生成的.realm-save歷史原始備份不得作為正式存檔匯入，亦不需上傳repo。
