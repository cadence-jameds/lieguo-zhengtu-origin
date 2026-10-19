# PR21 最終 Delta：C13 公開排行與 C4 保存效率

基準 PR21 `cc4f332dbdb6691275138d0ded88160200fb34ce`。main仍為`06c4cb93779f1f679bb77470515fd8aee1c42de9`。沿用原Draft PR21，沒有修改main、Approve、Merge、Deploy或關閉Issue。

## C13 方案 B

玩家已明確核准帝國／軍團按公開城市數降序、公開人口降序；同分同名次、ID穩定排序。這取代舊版C13-ORG-RANK-PENDING中的方案B待裁決狀態，不恢復DEMO總軍力公式。

正式提交`073d36dde6f8349fc52bf46803ad3427f8e4449b`；程式為`src/game/presentation/factionRankings.ts`、`PoliticsView.tsx`，驗證為`organizationRankings.test.tsx`。領主既有排行保留。成員ID及城市ID以集合去重；先產生全榜名次才搜尋，維持詳情、玩家所屬標示、政治權限及Formal狀態更新。名稱為「疆域／人口排行」，不讀軍隊、科技、資源或私有情報。

定向涵蓋正式組織成立、同意入團／離團、帝國成立／退出、實際征服後城市易主及滅國清退、人口變更、完全同分、穩定ID、重複成員防重計、搜尋／詳情／畫面更新、Save/Load／手動及自動Recovery。首輪5 PASS／1 FAIL係測試在正常備份輪替後引用已淘汰ID；調整測試順序，未改Recovery，失敗原檔保留。最終合併原UI定向13 PASS／0 FAIL；最終原生瀏覽器1440／390／320px的三分類、搜尋／詳情均PASS，9張原圖見[screenshots](screenshots/)，[manifest](screenshots/MANIFEST.json)。首次手機腳本誤找「天下勢力」而實際底部入口為「勢力」，只修selector；失敗log保留。原harness未在page內擷取version，後由全程未重建的dist補記identity並逐檔驗證production blob；結果明列此限制，未假稱當時已page-capture。後續harness已加入version request。

## C4 分階段證據與實作

固定原PR21來源的隔離副本，以正式Chromium Worker／原生IndexedDB插樁，初版15筆及細分版15筆、168h三速五類命令。診斷數據與原始程式頭均保留，插樁不進正式遊戲，不當作未插樁ABBA驗收。部分晚期診斷曾與診斷建置／定向檢查重疊；保留全部紀錄，細分的首個1X pass在其他檢查之前，作定位依據。舊版未記錄SHA的Node profiler仍僅為歷史診斷，沒有用來替代這批原生資料。

初版15筆的inclusive中位數：Worker handle 1105ms，Persistence commit 702ms，完整schema驗證231ms，structuredClone199ms，encodeSave189ms，digest120ms。巢狀區段不可相加。細分首筆：history guard72.3ms；full clone單次最大56.2ms；authority/current原生讀取4.6/9.4ms；backup/current/authority寫入請求53.7/51.7/37.9ms（含同步clone成本40.6/43.5/24.3ms）。Worker postMessage合計14.7ms；另保留實際ACK與畫面觀察時間，不冒稱它等於純React CPU或精確paint。

正式優化提交`ba11a66694a9190074c035f87ce0501d7744dd77`，只修改`src/game/persistence.ts`與新增`formal/saveDraftIsolation.test.ts`：

1. 完整收據五個嚴格欄位直接比較，避免每次對整個歷史各序列化兩遍；沒有省略CommandId／issuer／fingerprint／revision／disposition。
2. 普通save先複製實際會被修改的armies與autonomy分支；所有其他資料仍經原有encodeSave完整strict驗證、深拷貝、原checksum，再進原子寫入。匯入／回復／AI啟動仍用通用完整draft。
3. checksum後的備份、權限、metadata及回傳世界一律引用驗證後獨立snapshot，避免呼叫者在await時修改input造成DB列與authority分歧。

不改Worker優先順序、Reducer、AI權重／頻率／事件、成本、排程容量、Save Schema或Checksum演算法。相對原PR21三個AI核心檔案逐位元不變。

安全定向67 PASS／0 FAIL：五種收據欄位竄改均整筆拒絕／rollback；checksum等待時修改輸入不影響durable world、authority或回傳值；既有CAS、Recovery、保存故障、玩家指令回歸。初次完整套件在多個建置同時執行時主動停止、保留紀錄，第二次本機完整執行在同SHA的GitHub Push／PR完整回歸皆通過後停止重複工作；兩份中止紀錄保留，不把本機中止當PASS，未放寬timeout。正式完整結果採CI的1458 PASS／0 FAIL／1既有SKIP。

## 最終驗證與限制

C13 **功能PASS**；C4 **HOLD**。完整[效能報告](PERFORMANCE_REPORT.md)保存36組p50/p95/max、命令族、CPU/記憶體及每筆資料。1100嘗試／1099有效／1提交前逾時，全部組別至少30有效，輸入hash一致，1099筆receipt完整。候選189／549超過1秒、成功max8613.2ms，p95有5組較基準高，不宣稱全面改善。

正式Worker／原生IDB[五案相容／Recovery](evidence/native-compat.json)PASS，[兩案舊資料權限](evidence/native-privacy.json)PASS。API／CAS／Replay／Recovery等完整隔離回歸採GitHub同production頭 **1458 PASS／0 FAIL／1既有SKIP**：[Push](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/39300364203)、[PR](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/39300451161)、[證據](evidence/ci-runtime.json)。Typecheck、Production Build、Pages／Release通過；本機Pages首次缺project環境參數失敗，正確CI同參數重驗通過，兩次log均保存。一次PR Release Notes JSON尚未同步而CI失敗39300374931，更新body後完整成功，未修改測試規避失敗。最終文件／測試斷言補強提交的CI另以PR最新check為準。

原有workflow自動完成最新ba11的35組168／360／720h自然世界矩陣，起始皆99AI、無兵力／資源／情報注入、Runtime faults皆0：[Actions](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/39300364343)、[35份JSON/CSV](evidence/ai-ba11a66/)。包括traits與既有比較selector policy，僅隔離編譯副本替換比較selector；沒有重新校準正式權重。自然滅國及合法拒絕如實記錄，pure Formal長測不代替IDB安全證據。未手動重派所有長測。

C13目前沒有待決子項；依玩家已核准方案B完成公開疆域／人口名次，既有私有情報權限保留。C4仍不達完整1秒；提交前逾時原因未完全隔離。Android真機、實機GPU與私人存檔未驗，歷史HOLD／FAIL與B5 E1 OWNER WAIVED保留。未修改C1～3、C5～12、五筆排程及已完成Issue的正式程式；只有C13與C4必要delta。未新增80任務、B9/B10、平衡或Issue18功能。原完整1440次／718候選有效／323筆候選超標／10118ms最大值保留於`docs/p0c-master/evidence/latency/`，不覆寫或刪失敗。
