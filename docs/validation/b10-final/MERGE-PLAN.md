# 經本機驗證的六階段整合方案

**本輪只驗證方案，沒有執行 GitHub 合併、改 Base、轉 Ready 或部署。** 六個既有 PR 保持 Draft。下列每個實際合併動作都要等使用者另行授權；目前 main 的 Pages workflow 會部署合入的版本，因此「授權合併」還必須明確處理該自動發布流程，不能把本報告當作部署授權。

## 固定來源與實驗結果

最新 main：`443f170b277f71ee26a34ee3b5017687a98e01ab`，正式版本 `0.30.75`。完整 Stack：`8d40f63c5efbd08ee252f533719d5f58fc95b3dd`，功能分支預覽版本 `0.31.4`。

本機以 `git merge-tree --write-tree` 與 `git commit-tree` 建立不更新 refs 的模擬 merge objects，保留每個原 PR HEAD 作第二個 parent；依目前 main 順序加入 #54～59。每一步的結果 tree **完全等於該階段原 HEAD tree**，沒有衝突或內容遺失。使用正式 `checkNotes`、`createMetadata(..., strict:true)`，六階段均只有一份新增正式 release note，重算結果相同。沒有 cherry-pick、rebase、force-push 或改寫原提交。

| 順序 | PR | 在目前 main 上逐階 merge 後的預期版本 |
|---|---|---|
| 1 | #54 Durable Player Commands | 0.30.76 |
| 2 | #55 Async Construction Preview | 0.30.77 |
| 3 | #56 Command Ledger | 0.30.78 |
| 4 | #57 UI Projection | 0.30.79 |
| 5 | #58 Persistence Optimization | 0.30.80 |
| 6 | #59 AI Scheduling | 0.30.81 |

這是目前 main 的六次 **first-parent 整合單元**，不是 feature branch 的逐次開發提交計數。#59 現有擬合併 CI `df1a008…` 的 `0.31.0`，來自以 #58 功能分支作第一 parent 的另一條歷史。三者都有確定來源，不應把其中一個版號人工寫回 metadata 或 package baseline，也不能假定整個 Stack 合完必定是 0.31.0。若 main 在審核期間增加任何可玩提交，須重新執行模擬，不能沿用此表。

Repository 允許 merge／squash／rebase；本輪實際驗證的安全路徑是 **Create a merge commit**。不對其他合併方式宣稱已驗證：squash 會失去原上游祖先關係，rebase 會改寫現有 SHA，會增加重新套用既有提交、Gate anchor 及 Base 判斷的風險。

## 實際授權後逐階執行

1. 重新向 GitHub 核對六個 HEAD、Base、Draft、main 與 CI。若任一來源改變，停在該階段重新審查；不可用舊綠燈放行新 HEAD。
2. 先處理發布 Gate 與 main 自動 Pages workflow。不得因 PR 技術可合併而默認已授權公開發布。Android、冷載入、容量及既有 HOLD 均須保留決策。
3. #54 保持 Base `main`。對實際擬合併 tree 執行 strict Release Metadata、Successor／反竄改、完整隔離回歸、Production Build／Pages／Worker identity 檢查，核對 CI merge SHA。
4. 經授權以 merge commit 合入 #54。**保留其原功能 branch／HEAD**，不要提前刪掉仍作 stacked Base 的分支。
5. 將 #55 的 Base 從 #54 功能分支改為 `main`；核對新 main 包含 #54 原 HEAD，`main..#55` 的內容差異只有第二階段。更新 PR 的 Base 說明，不改原功能 SHA、不把已存在提交 cherry-pick 到 main，也不人工改 release notes。
6. 改 Base 後的 metadata／CI 不是先前那一次，必須重驗最新擬合併 SHA；依前述授權流程以 merge commit 合入 #55。
7. 依相同步驟處理 #56、#57、#58、#59：上游 merge 成功後，才將下一個 PR Base 改成 `main`，核對已合入的原 HEAD 為祖先、該步只有一份新增 release note、無重複 patch 或內容缺失，重跑 CI 再等該步合併授權。
8. 最後驗證 main tree 與完整 Stack production source 一致，發行產物的 app／Runtime／Preview／SW metadata 同源。文件 PR 在 #59 合入後才改 Base 至 main；純文件變更不新增遊戲版本。

合併本機模擬已證明每階段 tree 無衝突、strict metadata 可生成；**沒有證明未來改 Base 後尚未執行的 CI 已通過**。未執行的操作不可寫 PASS。

## Bundle Identity 與更新機制

正式建置由同一 `.release/metadata.json` 注入 UI／Runtime／Preview，SW 用唯一 `sw-release-<commitSha>.js` 回覆自己的 version／contentSha。`version.json` 不進 precache，以 no-store 核對；啟用前等待 durable save，核對候選 SW 自身身份，失敗保留原頁。

main 的 0.30.75 → 0.30.81 是遞增。若某測試裝置曾在**同一 Origin** 安裝功能分支 0.31.4，後來切到模擬合併的 0.30.81，數字更新判斷不會把降版當新版；須使用隔離測試 Origin，並由使用者決定實際發布渠道，不能為迎合測試安裝狀態人工升版或修改既有 first-parent 規則。本輪 localhost 的 PR58 0.30.99 → PR59 0.31.4 更新測試屬同一實際 source 的功能分支建置，與尚未發布的 main 方案分列。
