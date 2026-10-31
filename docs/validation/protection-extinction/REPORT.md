# 新手保護、滅國凍結與自由復國施工報告

2026-10-31（Asia/Taipei）。僅功能分支／Draft PR，禁止合併、部署及刪除分支。

## 基準與範圍

- Repository：`cadence-jameds/lieguo-zhengtu-origin`。
- GitHub 最新 main／PR #52 merge：`9e3233090b634cc38ef280525444a32d0714ae47`。確認為祖先，招募輸入解耦檔案保持原位元組。
- DEMO 唯讀參考：`reference/demo-v0.30.2`，`44728f749044c1a5f1ad4fe47f1eccc391c7d9b2`。
- 正式功能原始碼固定於 `03094c813a666e65d2ec3e5af67acaa36d001978`（引擎為 acc8186，最終手機佈局修正為 03094c8）；後續提交補 successor 與驗證文件。交付 HEAD 以 PR 為準。
- 新完整主規格：[v97](../../b6-v97/河谷戰役_vNext_平衡重構討論_v97.md)。完整承接 v96，原 v96 與歷史 Gate／美術證據不變。
- 不合併 DEMO、不移植 Legacy 引擎、不改軍事平衡／科技／經濟／征途目標／美術；沒有真實玩家存檔或私人截圖。

## DEMO 與 Formal 對照

|項目|DEMO v0.30.2 唯讀行為|本次 Formal|
|---|---|---|
|新手保護|`content.ts` 20 世界小時；`legacyEngine.ts` 城市敵對命令會呼叫 `declareWar/endProtection`|玩家及 99 AI 各 48 世界小時，勢力全部城市共用；依既有離線上限計時|
|城市偵察|視為敵對，解除保護，撤回不恢復|新手／復國一致；移除復國偵察例外；命令接受後一次性通知|
|野外偵察／攻擊|與城市領主敵對分開|正常偵察、實際抵達與情報送達保留；不解除勢力保護|
|受保護目標|敵對派遣與到達檢查|命令、抵達、每次戰鬥／圍城重驗；受保護結算不再扣除補給兵或人口|
|敗北畫面|既有敗北背景、讀戰報／流亡復國／結束／匯出／載入／新局|沿用背景及 Formal UI，顯示《列國征途：始源》，補返回首頁與兩種二次確認|
|世界暫停|Legacy 敗北模型／時鐘|Formal reducer、合作 replay、Runtime Worker、離線補算及存檔共同維持凍結|
|選址|256×256、可輸入 XY，未指定可自動尋找|384×384，地圖指標／鍵盤、XY、三候選快捷預覽；命令必填精確 XY，禁止自動替換|
|復國數值|400 人、10 民兵、糧木600／石400／金300、6h 保護|400 人、0 軍、四資源各600、48h 保護；文明／時代／完成科技／戰史保留|
|結束本局|直接送出 `end_realm`|二次確認送出 `player.end`，保留存檔與戰史；此快照禁止再次復國|

## 正式狀態、順序與保存

1. `protectionKind/protectionUntil/protectionEnded` 保存種類與一次性提前解除原因；開發者保護罩使用獨立 `developer.shieldUntil`。拒絕命令拋棄私有草稿，不改保護或通知。
2. 最後失城事件先完成戰鬥、唯一 final receipt、戰報與既有滅國清理，再持久保存 `extinction.defeat={at,ended,battleId?}`。有真實戰鬥時引用其 final receipt；合成非戰鬥情境不捏造戰報。
3. 同步與合作事件迴圈在該事件結束後停止；不執行排序在其後的同時刻或未來事件。保留原事件 ID、時間及排程順序。原有亡國研究／工匠／殘軍清理仍依 Formal 規則，未新增因「暫停」而刪除其他事件的捷徑。
4. `resumedAt` 只標記復國當下仍待處理的同時刻邊界；Schema 僅於凍結／復國邊界允許軍隊／戰鬥 deadline 等於當前時間，禁止過期事件。時間前進後移除標記。
5. Worker 暫停時不排 tick、不推 AI，不外推時鐘；UI 回首頁不解除暫停。`away/resume/load/import/restore/export` 保持暫停。復國原子提交成功才重新錨定實時鐘；失敗不發布部分世界。
6. 離線補算只計實際抵達的世界時間；滅國後實時經過量不補算。沿用單一 Worker 佇列、玩家命令優先與既有 IDB 原子保存／checksum／Recovery。
7. 復國只接受明確 X、Y；Worker 重新使用 Formal 地形、城市、野外據點及正式建城預約檢查。非法位置拒絕，不改資源、時間、revision 或存檔。
8. 保留原 IndexedDB 名稱，不清空資料或備份。新 native content 為 `lieguo-formal-p0c10-time3`，ruleset 為 `v97-p0c10.1`；不新增舊版本保護／敗北存檔遷移。舊版原始資料仍可由既有備份入口保全。
9. `player.end` 不刪存檔／戰報／回復點。既有使用者明確匯入／回復時的同局未來歷史整理及 durable dedupe 語意維持；不把該既有流程改成自動清庫。

## 測試矩陣

完整新功能測試：`src/game/formal/protectionExtinctionP0C10.test.ts`、`extinctionWorkerP0C10.test.ts`、`src/game/presentation/extinctionP0C10.test.tsx`。實際數量及原始輸出見 [checks.json](checks.json)。

|需求|證據／覆蓋|
|---|---|
|1 新世界玩家＋99 AI 48h|原生 generator，100 勢力，無新增保護 polling event|
|2 自動到期|48h 前一毫秒有效、到期失效、其後不重啟|
|3／4 新手及復國城市偵察解除|兩種保護、合法收據、一次通知、重送去重與 save/load|
|5／6 野外偵察／攻擊|實際出征、抵達、野外情報返程交付，不解除|
|7 撤回不恢復|城市偵察返程與重新讀取後仍已解除；沒有重啟保護的取消／返程路徑|
|8 拒絕命令|兵力不合法、保護目標及非法座標均原子拒絕|
|9 AI 同規則|AI 城市偵察解除；攻擊保護玩家被拒；原生 99 AI 初始保護|
|10 目標保護|偵察／掠奪／征服 admission、arrival、進行中戰鬥／圍城；兵力、補給兵、牆與人口不受不合法傷害|
|11／12 最後失城／歷史收據|final receipt 先完成，精確凍結於失城時間；不得重播|
|13 事件不推進|同時刻 AI、marker、第二支軍隊、另一場 combat round 及未來事件保留|
|14 刷新／離開／載入／離線|Worker away/resume/load、真實瀏覽器重載／首頁、save/load/import/restore、離線 cap|
|15 手機／桌面敗北操作|Chromium 1440×900、320×568、390×844，報告／匯出／載入／新局／首頁／結束|
|16 地圖及 XY|無自有城市地圖、指標選取、鍵盤選取前輪證據、手動座標及候選預覽|
|17 非法位置及佔位|邊界、非整數、水域／河流／山地、城市、野外含冷卻、實際 AI 拓殖預約衝突|
|18／19 繼續與復國保護|凍結時間復國、0 軍／400 人／四資源600、48h、其後城市偵察解除|
|20 反覆滅國與結束|連續三次復國、文明／科技／時代保留；二次確認結束、去重、重載後禁止復國|
|21 各倍速|1／3／6／10／25X Formal／Worker，滅國100實時小時後復國只計新的一秒|
|22 Schema／保存／B9／v96|完整隔離回歸、IDB rollback／checksum／完整戰報／Recovery、歷史 Gate 與 PR #52 鎖定|

## 驗證結果與原始失敗

- 新功能專項：**35 PASS／0 FAIL**。
- 完整回歸：**2184 PASS／0 FAIL／1 skipped**（引擎 acc8186；最終手機佈局類別修正另以 Typecheck／Build／真實瀏覽器驗證，GitHub CI 再驗最新 HEAD）。命令：`node scripts/verify-in-isolation.mjs full`；所有歷史產出留在拋棄式副本，未覆寫既有證據。跳過的既有可選案例為 `user late-game save remains valid after six more world hours`，本輪未使用私人玩家存檔。
- Typecheck、專案路徑 Build、PWA scope／fallback、release artifacts：**PASS**。
- 原有美術完整性／城市／手機／征途目標／招募 successor 與新的 P0-C-10 固定 SHA／反竄改測試：**PASS**，22 項 successor／反竄改測試。
- 桌面／320px／390px：**3 尺寸 PASS，0 page errors**。見 [瀏覽器結果](browser/browser-result.json) 與同目錄合成情境截圖。沒有橫向溢出。
- GitHub CI：以 Draft PR 最新 HEAD 的 Verify 結果與交付訊息為準；此檔保留本機驗證範圍，不宣稱正式發布驗收。。

首輪完整回歸為 **2146 PASS／32 FAIL／1 skipped**，保留 [原始失敗](full-initial-failures.json) 與原報告 SHA256。其後相關案例 223 PASS／1 FAIL，再修正測試台暫停後的保存／下一事件投影。未將失敗覆寫為 PASS。

[attempts.json](attempts.json) 列出逐輪結果與原始紀錄雜湊，包含：初輪 Typecheck、測試 fixture 的錯誤假設、舊 Gate 拒絕、取消的過時完整回歸，以及專案路徑 preview server 設定不一致造成的一次瀏覽器 timeout、手機地圖誤用桌面工具列造成的一次指標攔截 timeout（已修正）。這些紀錄保留，最後一次結果另列。取消的 run 不是 PASS；前次報告不當作新 run 的輸出。

## 歷史 Gate successor

[compatibility.json](compatibility.json) 與 `scripts/p0c10_successor.py` 固定 main 及完整功能 source commit，逐檔驗證 before／after 與有限歷史 predecessor。只准本輪精確列出的實作／情境變更；沒有目錄萬用 grant。其餘軍事／經濟／AI 決策／科技／任務、招募輸入、美術與歷史紀錄保持原 SHA。既有 Gate 仍先驗證原始紀錄 SHA，再處理有限 successor；未關閉任何 Gate。新增反竄改測試拒絕改 commit、擴大範圍、更新來源／歷史雜湊或刪除 invariant。

## 效能與交付限制

- 新保護只新增勢力欄位，無高頻全世界複製或新排程事件。保護倒數是獨立小元件；不再為此每 250ms 重繪整個 Shell。
- 使用既有地圖／排程器／AI；凍結後 Worker 直接略過 tick。PR #52 的招募表單、預覽及效能證據保持原位元組。
- 當前全部自動檢查不等於歷史 B5 E1／Astra Gate 或玩家驗收。**B5 E1 仍 HOLD，Astra Gate 未宣稱 PASS。**
- Android 實機待驗：Chrome／PWA 背景及系統終止後恢復、Web Locks 多分頁、下載與載入 Android 檔案、觸控縮放／點選、軟鍵盤／瀏海／底部系統列、小記憶體與省電模式。
- 不要求舊版本存檔相容；不會清空 IndexedDB。匯出／新戰役／載入其他檔案仍依既有明確操作流程。
- 未合併 main、未部署 GitHub Pages、未刪除分支；完成後停在 Draft，等待玩家及中控審查。

完整修改檔案清單：[changed-files.txt](changed-files.txt)。
