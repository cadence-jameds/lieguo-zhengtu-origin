# DEMO v0.30.2 基準證據與 UI 成果找回紀錄

本輪交接日期：**2026-10-19（Asia/Taipei）**。整合目標為既有 Draft PR #21；查核基準 main `06c4cb93779f1f679bb77470515fd8aee1c42de9`、PR HEAD `d79cc579b2a4478a5233d1fa53388ff044308f58`。

**盤點結果：未找到尚未 Push 的正式 UI 程式成果。** 本輪新增 UI 程式檔案為0、UI功能Commit為無。沒有為了產生`feat(ui)`提交而重新開發，也沒有把只有比較報告的項目列為完成。本次可安全找回並交付的是原有 DEMO 基準、驗證與14張原圖，以及可追溯的找回紀錄。

## A. P0-C-9：保留已交付 AI

五策略實作及168／360／720h的35組自然世界模擬沿用原PR；[AI Delta Report](../p0c9/DELTA_REPORT.md)、[原始矩陣](../p0c9/evidence/matrix/)。`aiAttackStrategies.ts`、`aiActions.ts`、`autonomy.ts`逐位元維持d79cc57。效能相容性仍為**HOLD**，不是Gate PASS。

來源未變，因此沒有重跑AI長測或DEMO Chromium全流程。原最終HEAD的[Push CI](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/39190697858)與[PR CI](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/39190802957)為1409PASS／0FAIL／1既有條件SKIP，另有59個定向測試PASS。新文件提交由既有CI再驗證，不將舊run冒稱為新HEAD實跑。

## B. 找回範圍、既有 UI 與證據

### 本地成果保護與查核

完整可機讀紀錄：[inventory-summary.json](recovery-audit/inventory-summary.json)、[protected.json](recovery-audit/protected.json)、[source-copies.json](recovery-audit/source-copies.json)、[Git物件審計](recovery-audit/git-object-audit.json)。開始寫入前，兩個Worktree的status、refs、reflog、stashes、staged／unstaged patch及未追蹤測試已保存在`/workspace/research/ui-recovery-20261019/`；沒有reset、clean、強制覆蓋或刪除成果。

| 位置／來源 | 發現 | 處理 |
|---|---|---|
| 正式工作目錄 | PR分支d79cc57，tracked／staged／untracked均無改動 | 保留原Head與全部AI檔案 |
| 本地分支／stash | `work`為已合併main祖先3d17608；PR分支已Push；沒有stash或額外未Push分支Commit | 未cherry-pick已合併內容 |
| `/workspace/research/p0c9-before-main` Worktree | detached06c4；只有node_modules連結與AI負向測試未追蹤；測試與PR已提交版本完全相同 | 備份測試；不重複提交 |
| `/workspace/reference-baselines/formal-main-06c4cb9` | 386個source檔案全部與main相同 | 這是正式參考副本，不是待整合UI |
| DEMO source／runtime副本 | 各143個source檔案相同，沒有Formal UI補丁 | 不把legacy檔案移入Formal |
| 其餘`/workspace`／`/tmp`可取得目錄 | 未找到額外TSX／CSS／相關UI補丁；已有patch均為Git內的歷史證據或本輪保護檔 | 不重播歷史補丁 |
| unreachable Git commit | `06eccd0`的tree與main完全相同 | 不是遺失UI成果 |
| unreachable暫存root tree | `b30bd41`對目前Head只有3個P0-C-9文件／測試結果差異 | 不從舊暫存tree覆蓋已交付結果 |
| 其他unreachable blobs | P0-C-9報告、CSV與舊矩陣workflow YAML | 不存在新的UI程式 |

`git fsck`另列4個缺tree的歷史物件；它們都是已合併main的PR #19 PWA hotfix祖先，並非未Push UI分支。現行main／PR tree及被比較的source均可讀。本輪不補抓舊歷史tree、不修改Git歷史。原始[fsck記錄](recovery-audit/fsck.txt)保留，不把這個部分物件庫宣稱為完整fsck PASS。

### 已存在且已合併的正式 UI

城市／軍隊／軍團／天下勢力的舊施工已隨PR #9進入main（合併Commit `3d1760864f3b9d9a55108c80225764ef8e3099e1`，功能施工包含`c8cf3ef`）。目前PR #21的`src/game/presentation/`、`GameApp.tsx`與`game.css`相對main均無差異；不能把這些檔案重新列為本輪新增UI。

已在main的範圍：軍團五分頁、帝國／軍團／領主合法瀏覽、城市治理、外交記事、工匠特殊單位、文明文案、城市佇列占用摘要與手機成本排版。沿用[PR #9整合報告](../v94-ui/PR9_Latest_Main_Delta_Report.md)及[原UI交付報告](../v94-ui/V94_UI_Integration_Report.md)的各自來源與限制；這些歷史報告不代表P0-C-10～13或五筆排程已完工。

### 唯讀 DEMO 來源與既有驗證

- 固定遠端：[reference/demo-v0.30.2，44728f7](https://github.com/cadence-jameds/lieguo-zhengtu-origin/tree/44728f749044c1a5f1ad4fe47f1eccc391c7d9b2/demo-v0.30.2-source/lieguo-v0.30.2)。沒有合併reference分支或搬入legacy引擎。
- [原始基準報告](REFERENCE_BASELINE.md)：保留原文及原日期；其中「本輪沒有提交」與「P0-C-9尚待施工」描述的是當時的基準建立回合。最新AI狀態以本頁A節及PR #21為準。
- [remote-manifest.json](remote-manifest.json)、[integrity.json](integrity.json)、[integrity-final.json](integrity-final.json)：原379／379檔案完整性證據。
- [dependency-audit.json](dependency-audit.json)：原601個相對引用無缺檔；[typecheck](typecheck-final.log)、[Production Build](build-final.log)、[瀏覽器結果](browser/result.json)及[原彙總](summary.json)。
- [evidence-manifest.json](evidence-manifest.json)：本輪封存28份原始證據（包含14張PNG）的bytes與SHA256；逐份與原檔相同。沒有重新截圖、重編碼或改寫原PASS／FAIL。原先不完整依賴的[第一次建置失敗](build-first-incomplete-dependencies.log)亦保留。
- [原檢查腳本](verify-integrity.py)及[原Chromium腳本](verify-reference.mjs)僅供追溯，保留當時絕對路徑；換環境重現須先調整路徑。本輪沒有重新執行它們。

原驗證是DEMO production build、Chromium154、固定seed92049、原生Worker／IndexedDB，桌面1440×900與手機模擬390×844各7張圖、兩流程PASS、errors空陣列。這些圖是**DEMO原版**，不是Formal修改後畫面；手機模擬不等於實體Android。

| 畫面 | 桌面原圖 | 手機模擬原圖 |
|---|---|---|
| 首頁 | [desktop-home.png](browser/desktop-home.png) | [mobile-home.png](browser/mobile-home.png) |
| 開局設定 | [desktop-start.png](browser/desktop-start.png) | [mobile-start.png](browser/mobile-start.png) |
| 世界地圖 | [desktop-map.png](browser/desktop-map.png) | [mobile-map.png](browser/mobile-map.png) |
| 版圖模式 | [desktop-territory.png](browser/desktop-territory.png) | [mobile-territory.png](browser/mobile-territory.png) |
| 領主排行 | [desktop-lords-ranking.png](browser/desktop-lords-ranking.png) | [mobile-lords-ranking.png](browser/mobile-lords-ranking.png) |
| 城市 | [desktop-city.png](browser/desktop-city.png) | [mobile-city.png](browser/mobile-city.png) |
| 軍隊 | [desktop-army.png](browser/desktop-army.png) | [mobile-army.png](browser/mobile-army.png) |

版圖模式圖來自沒有帝國的新局，只證明開關與地形背景；不證明已重現帝國走廊。沒有受控滅國場景畫面。不能以這14張圖宣稱Formal parity驗收完成。

## C. 尚未完成與待裁決

| 項目 | 本輪結果 | 現況與仍缺成果 |
|---|---|---|
| P0-C-10 滅國UI | **Pending：未找到新增正式程式** | 現有RebirthView未新增DEMO敗北背景／完整按鈕流程；受控滅國UI仍待施工與驗收。禁止帶回停止世界、10民兵、自由XY、6h保護等舊規則 |
| P0-C-11 帝國版圖 | **Pending：未找到新增正式程式** | Formal現有半徑5塗層及標籤維持；DEMO半徑8、連接走廊、邊界是已分析差異，尚未套入正式Presentation。政治與城市權屬、384世界保持正式規格 |
| P0-C-12 軍團簡介 | **Pending：尚未移除** | LegionView建立／管理仍有簡介欄位；本輪未找到既有移除碼，依禁止重新開發要求不現寫。後續移除入口仍須保留舊資料／政治命令相容 |
| P0-C-13 天下排行 | **Pending：尚未實作DEMO排行** | Formal既有三分類瀏覽不是DEMO名次／排序／同分處理。DEMO組織評分使用精確駐軍／在途軍力，正式可用資料與評分／權限仍待中控裁決，不開放敵方隱藏軍力 |
| 城市／軍隊UI | **部分已有main成果；沒有新增待Push檔案** | PR #9的佇列摘要、成本排版、工匠與治理保留；本輪DEMO視覺／操作差異僅有比對，未產生其他正式UI修正。五筆容量不在本輪補開 |

**整合阻礙：本環境沒有可供挑選或移入的新增UI原始碼。** 玩家已進一步確認指的是本對話最初「P0-C統一更新＋五筆排程擴容」施工令；該份提示詞是需求／授權，後續DEMO基準彙總則明載`formalProductionChanges:0`。本輪沒有發現其餘UI的實作提交或未提交版本，沒有將舊施工令當作已完成證據。不能用DEMO程式或重寫功能替代找回結果。

本輪沒有程式合併衝突、沒有採用覆蓋版本；main、DEMO reference、Formal engine／world／save／Recovery／Scheduler／Combat及AI三檔維持原內容。沒有新增玩家更新摘要或手動升版，因為沒有新增可玩行為。

## 驗證與停止點

新增檢查限於檔案SHA／PNG格式、連結與JSON可讀性、source tree不變及既有workflow範圍。程式與資產未變，沿用各來源有效的Typecheck／Build／UI與AI測試，不重跑DEMO截圖、99AI長測或新UI smoke；本輪沒有新的Formal UI可驗。既有GitHub CI照常執行完整安全檢查，最新狀態以PR #21 Checks為準。

完成證據封存、Push與PR A／B／C說明更新後STOP。未Approve／Merge／Auto-merge／部署／修改main，未宣告Gate PASS。
