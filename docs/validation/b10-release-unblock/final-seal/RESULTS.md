# B10 最終合併封版驗收

本批從 `e50baaeb00b5af15d35d37ed5056be2a2bf50d68` 修正舊格式新局入口，沒有再做效能／架構／AI施工。**最後交付HEAD、本機原始完整Gate的實際PASS/FAIL、原始摘要SHA256與同HEAD GitHub CI，以 [PR61本批最後交付](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/61) 首段為唯一即時驗收記錄。** 完整Gate在最後文件提交後執行；本頁不拿定向PASS預告完整PASS，也不在測試後再改HEAD。若其中任一硬Gate未通過，仍是MERGE HOLD。

## 實際修改與資料安全

- `FormalHome.tsx`：不相容且取得安全替換憑證時，以開始新遊戲為主要入口；保留可選原始備份與重讀。未知讀取失敗仍禁止覆寫。
- `Start.tsx`／`GameApp.tsx`：文明、名字、種子、速度、離線設定後，顯示明確確認框：「建立新戰役將取代目前活動戰役。舊版歷史資料不會自動轉換。」取消不發Start；不需要先備份。成功收到正式switched後才進遊戲並清除錯誤及畫面草稿。
- `campaignStorage.ts`／`useGame.ts`：明確版本宣告與一般Schema／讀取錯誤分開；憑證來自持鎖Worker，不以UI檢查推定安全。
- `runtime.worker.ts`／`persistence.ts`：替換憑證綁定精確原活動列、Authority checksum、branch與writer epoch。交易內重新確認來源checksum、Authority／Root／身份索引、Writer CAS及沒有pending/retryable命令。來源或Writer變更後舊確認失效。
- 僅使用者確認後，在原T2交易內移除該不相容活動戰役的Recovery／戰報引用，建立新世界、權威、帳本、Inbox分支及Recovery。不清空IndexedDB，不刪除／寫入歷史namespace，不改DB／Schema／Save Format。失敗全部回滾，不能宣稱成功。普通命令T1／T2／T3不拆分。
- 相容存檔的原新遊戲與Recovery行為保留。此路徑不猜測修復未知DB格式、checksum／Authority損毀或未完成命令；保留資料及錯誤入口。
- 既有未合併Release Notes新增一則繁中玩家說明，PR受控JSON同步；沒有修改已合併摘要、package基準或v95／96／97主規格。

正式玩法程式為 `bfdc252021b3cceffbd53ce8edcf208281fd9252`；後續 `69cba6381fc28514d1248926de8395f324a9e756` 只補測試／診斷，`38295df3d32c0ca1dcd21496304f1e67b82abac4` 封存有限證明。新證明在本目錄compatibility.json，舊 `../compatibility.json` 原文保留；既有successor、反竄改、原負載與期限沒有放寬。

## 新局與直接驗證

| 項目 | 實測結果 |
|---|---|
| 不相容新局、取消、過期憑證、舊Writer、checksum／Authority／索引損毀、未完成命令 | 21項定向PASS |
| 新局UI／原命令等待／Runtime回歸 | 合併前一輪123 PASS，再補1項過期來源確認測試；共124個不同案例已覆蓋 |
| 新局T2故障 | 12個實際寫入點注入QuotaExceededError，全資料列回滾；相同確認可在故障移除後安全重試 |
| 原生Chromium154.0.8037.57 production GameApp／Worker／IDB | 5組全部PASS，見measurements.json |
| 原生只有歷史DB | 不備份直接設定新局；取消所有新DB資料列不變；舊DB逐字不變；成功後新舊共存並可重載 |
| 原生活動戰役不相容：桌面／390×844手機視窗 | 明確確認後開局、設定名字／種子884422／25X／離線0h正確；取消Hash不變；舊錯誤消失；重載成功 |
| 原生多分頁 | 第二頁被Writer Web Lock擋住，沒有未授權Start入口 |
| 原生損毀 | 主按鈕禁止覆寫，原活動列Hash完全相同 |
| 原生新局儲存失敗 | world-write注入後拒絕，全表Hash完全相同；不是假成功 |
| 必要successor／反竄改／部署策略／Projection／Preview Gate | 17個命令全部PASS，原四項bounded反竄改測試保留 |
| Typecheck／Build／Pages／Release Metadata | 執行記錄與最終HEAD以PR本批首段為準；不得用指令清單冒充PASS |

production UI測試使用當時281110b建置，正式內容bfdc252／預覽版0.31.26；之後僅測試與文件。原生測試不是Android真機。記錄只含合法合成100勢力世界、結果及Hash，不提交存檔、原始trace、dist或node_modules。

## 最後原始完整Gate

最後文件HEAD固定後執行 **`node scripts/verify-in-isolation.mjs full`**。Node22.23.4、quota `200000 100000`、8GiB、預設heap2197815296、NODE_OPTIONS未設、原2Workers／B9 240秒Hook／150k 120秒／Runtime 30秒與全部原斷言不變。沒有並行瀏覽器／benchmark，也不強制GC。實際結果、B9／150k／Runtime／replayP0明細及報告Hash將寫入同HEAD的PR首段驗收紀錄，與GitHub CI分列，該結果不由本頁的定向案例取代。

舊完整FAIL仍保留：81ea為2487 PASS／1 FAIL／1 SKIP，唯一公開validator mock入口失敗；修正8375後68定向及CI有效，但當時本機未重跑。本批不改寫該歷史FAIL。定向初次誤用Vitest預設5秒、測試query把dialog隱含角色當顯式role、Recovery顯示API欄位假設錯誤等診斷工具問題均已修正；原正式測試／期限未改，初始產物仍保留於/tmp/b10-final。

## Stack與部署決議

重新核對#54～61全部open Draft、未合併，Base依序連接，各上游HEAD CI皆有SUCCESS。Source proof38295df的detached模擬全無衝突、祖先成立、受控Release Notes相同且strict metadata成功；最後文件HEAD的精確模擬結果另列PR首段。沒有修改遠端main或上游PR。

| PR | HEAD（上游保留） | Base | 模擬main first-parent版本 | 已核對成功CI |
|---|---|---|---|---:|
|54|edca2f29805f0cdc4b0f89cd3cd00a8f9a819e39|main|0.30.76|41282458194|
|55|4e56b69d1af107ee454213d0276f06a2ca10976f|#54分支|0.30.77|41296235796|
|56|1737d14a8f210fb2d33eb5dadbde18c3bb375586|#55分支|0.30.78|41426784041|
|57|dfa574a4de24fe9069df2a90d3edae6a64f191da|#56分支|0.30.79|41548741684|
|58|c370ff8a492de8711e764a82c8f1d43efef1a00e|#57分支|0.30.80|41579721205|
|59|8d40f63c5efbd08ee252f533719d5f58fc95b3dd|#58分支|0.30.81|41629201376|
|60|aaaee9d3b9e16f2bad6ee8a96d1ef2902d0c4607|#59分支|0.30.81（純驗證）|41675862692|
|61|最後完整HEAD見PR首段|#60分支|0.30.82|最後HEAD新CI見PR首段|

**使用者取消部署護欄，接受日後合併main自動部署Pages。** deploy-pages.yml與main443f170b逐byte一致，SHA256 `9151a015b0078782570bed390a3dd73c095e11685801db22c45aee8cbea4057f`。正常CI／Typecheck／完整回歸／Build／Pages與Release檢查保留；ci.yml未移除任何步驟。原manual-only策略測試改為驗證此次明確核准的自動部署政策，不刪安全測試取綠燈。

取得**下一次明確授權**才依 #54→55→56→57→58→59→60→61 做merge commit；每步核對新main、實際CI／Pages與版本後再繼續。不rebase、不force-push。分支預覽0.31.26不等同main整合0.30.82，版號由first-parent與已核准進位規則產生，不手動改版。

## 沿用證據與風險

SW六輪30/30（原15/30秒）、31世界、1025防重播、14原子故障、50 FIFO、Worker中止／Ack遺失、Quick／Full／Recovery及99AI/25X十分鐘Soak保留。本次不改SW或普通命令語意，沒有手動重做無關原生項目；新局受影響的持久化另有上述實際原生故障與回歸，不以舊PASS豁免。

Quick 10k／60k／150k均3,034,499 bytes、Full約3,034,596 bytes，100MiB上限不變；150k原測項結果由最後完整Gate實測列於PR。B9記憶體88次測試結案，不再優化。既有T2長尾、冷啟動Long Task限制保留，不能宣稱所有效能目標達成。

Android／其他Chromium／真背景仍NOT TESTED，安排合併後，不阻擋目前單人測試階段的技術合併。B5 E1 HOLD、Astra非PASS仍是既存發布事項。部署護欄未安裝不再是MERGE HOLD。

是否 **READY FOR TECHNICAL MERGE** 由最後同HEAD原始本機完整Gate、新CI、模擬及本批PR交付明確回答；未PASS不能放行。本次始終保留Draft，不按Merge、不轉Ready、不部署，完成後停止，不進B11。
