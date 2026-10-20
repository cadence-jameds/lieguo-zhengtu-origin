# C4 長局瓶頸追查（2026-10-20）

固定起點為 PR21 `9f08fd63d8e7928add4048ff5f7c3aa2d1048fc7`，main `06c4cb93779f1f679bb77470515fd8aee1c42de9`。沿用 Draft PR21，不改已完成功能及 AI 權重。

## Phase A／B 初始追蹤

沿用上輪自然演進 checkpoint、相同五類合法 UI 操作及玩家前置，不改 AI 決策／事件。168h 手機10X、96h桌面10X各10筆；168h50X桌面／手機各5筆；新局桌面10X 5筆。35筆 durable 成功、0失敗。原始各筆 CommandId 時間軸見 `evidence/before/`，僅壓縮 JSON 空白，不移除慢樣本。這是固定來源的隔離插樁診斷，不是正式ABBA；巢狀時間不可直接相加。

初始隔離建置先因 Node spawn sandbox 權限、archive 不含.git的release prebuild、診斷helper的this型別而中止；均在隔離副本修正，原紀錄留在research，不改正式驗證規則。使用已凍結metadata直接執行tsc及vite；初始副本metadata沿用舊commitSha/dirty欄，來源身分以git archive head和各原始檔雜湊為準，不以那份版本標籤冒稱正式production。後續preparer已修正診斷標籤為來源head/dirty=true。

168h最慢新樣本為研究命令 `command:890152b9-3115-4b36-a387-41490a49856e`：ACK1490.5ms、含診斷傳輸的DOM觀察1824.9ms；點擊至Worker接收6.3ms、接收至處理0.1ms、純時鐘追算252.0ms、正式命令156.5ms、save1074.0ms（其中encode447.3ms、authority241.7ms）、ACK後worldPatch107.0ms。追算／命令／encode內各一次完整驗證，分別104.0／95.9／151.5ms。沒有到期AI事件，不能把這筆歸因AI決策。IndexedDB transaction lifetime1073.4ms包含驗證／序列化／crypto與請求，不是純磁碟寫入時間。所有開始／結束、父span、物件個數及checksum bytes均在raw。

另一筆168h建造命令接收後等待前一個背景保存182.3ms；該背景工作總長1475.3ms，其中大部分在玩家點擊前，不能把整段當指令延遲。初始96h桌面10X最大902.1ms；168h桌面50X最大1351.5ms、手機50X最大1243.1ms；新局最大411.3ms（精確值依raw）。**未重現歷史8613.2ms成功極值、96h舊p95退步或上輪提交前逾時；不能為它們指定唯一原因。**

世界城市數皆100、AI records99；168h自然存活81，不復活／減少AI。新局／96h／168h Receipt 約0／7038／13266；canonical存檔約0.2／2.84／5.28MB（依各筆bytes）。世界規模與存檔歷史成本同步增加。兩次native structuredClone會重新複製長fingerprint字串；Zod完整驗證仍做三次；IDB讀取current、備份/current及authority寫入也攜帶全部歷史。首批GC只收集CDP數值事件，缺少單調鐘與epoch對應，僅可提供巢狀GC統計，不能聲稱某個GC導致某筆命令。performance.memory是main JS heap，不能冒稱Worker heap或整機CPU。沒有強制GC或上傳Chrome raw trace。

診斷回傳payload可能延後DOM觀察；React layoutCommit為真實commit標記，ACK後餘量不是純React CPU或精確paint。正式驗收必須另用未插樁production與相同環境。

## Phase C 候選

針對已量測的兩次大型複製，候選僅讓純primitive Receipt另建獨立records，長字串不可變故可共用；其他所有分支仍deep clone，異常Receipt走原full clone；最終完整Schema、Checksum、Receipt驗證、IDB交易、CAS及ACK均不變。先驗證隔離／拒絕／99AI Replay等價，再做有界前後比較。若改善有限，不啟動完整矩陣，改交架構選項決策。

## 最終結論（2026-10-20；C4 HOLD）

已完成三個確認瓶頸的安全最小修復步驟：先保存固定9f分段追蹤，再實作Receipt draft複製，最後修正World Stream歷史比較。正式程式只變更 `src/game/formal/worldDraft.ts`、`formal/reducer.ts`、`worldStream.ts`。隔離插樁及原生getter／GC hooks只在scripts與固定archive測試副本；Production沒有logging、測試捷徑或新增隱藏情報輸出。Persistence、Worker、Schema、canonical、saveCodec、UI及三個AI核心檔相對9f沒有改動。

### 來源及提交對應

GitHub API建立的提交與本地固定量測提交具有完全相同的Git tree，因作者／建立時間不同而SHA不同；不得把本地量測冒稱重新對遠端SHA執行。完整對應見 [commit-map.json](commit-map.json)。

|內容|本地固定提交|GitHub提交|
|---|---|---|
|初始追蹤工具與35筆raw|66ff1e949114d727f507e66f4e7135843858a4a4|cbe030ee444305a833cf52644865de4eaabb3bb2|
|Receipt獨立draft|99d9d27340c8d868b42ad11b38f809645f4800b8|6c335fd37be88d9448ee3a4a1d42be4bf225d6e8|
|typed draft及有界AI相容工作流程|7f47f6b184e4890face225577e7bdd963f92f141|9b7f9c5312e1edff8cfab3f62455a6456ede07a9|
|World Stream避免明顯不同長度的歷史序列化|af43822bdc31c9da93d2c504e45680bf89315eb2|95d1c0b0f4247de4c5e9489d4e85a6b35be671d2|

未插樁before artifact為ba11／0.30.66，其所有正式src逐位元等同9f；after為af／0.30.69、dirty=false。診斷after-v1是clone-only的7f，final-v1為af。初始archive舊metadata誤留ba11標籤、final診斷版顯示版本沿用prebuild標籤等限制全部保留；診斷來源一律以trace-source檔案雜湊及固定archive提交識別，不當作Production驗收身分。原生5項安全檢查的testedRelease為af／0.30.69。測試fixture來源33b與受測Production提交是不同欄位。

### 正式修復及負向案例

1. `cloneWorldDraft`僅對嚴格五個primitive欄位的plain Receipt建立各自獨立record。fingerprint字串不可變；其他世界分支仍native deep clone。異常Receipt、額外鍵、Symbol或非plain record回到原完整clone，之後仍由原strict驗證拒絕。公開Reducer的caller不能修改提交中的世界。Replay的原fullCommandClone路徑保留。
2. `worldPatch`對無自訂toJSON且長度不同的歷史直接標記changed，仍傳回完整next歷史；同長度disposition改動與特殊toJSON維持完整比較。既有patch協定及Recovery語意不變。負向測試在9f為5 PASS／1預期FAIL（兩次歷史JSON），修復後連Admission共19 PASS。
3. 不跳過Receipt完整性、最終Schema／Checksum、原子DB交易、CAS或真正transaction complete。沒有改AI權重、事件次序、同時事件規則、存檔格式或Scheduler。

### 17段完整時間軸

[phase-timelines.json](phase-timelines.json)提供固定五類命令、五個情境的before／final共50筆對應數值，每個CommandId有epoch毫秒start／end／ms、job／parent、main標記及單段union。完整版meta、世界規模及所有原始span保存在各result；衍生檔省去重複meta。初始額外重複樣本仍留raw，並非依快慢選樣。另有clone-only35筆與final25筆完整診斷。

|階段|證據及邊界|
|---|---|
|1 點擊→UI送出|pointerdown與main issue／postMessage標記|
|2 主執行緒postMessage|main開始／結束及同步呼叫耗時|
|3 Worker收到|worker.received.command，與相同CommandId對齊|
|4 Worker排隊|receive→runRequest；先前原子保存另有job，僅計重疊等待|
|5 Admission／版本協調|orderAdmission／governanceAdmission span；不存在的分支為0次|
|6 世界追算|advanceFormal／Cooperative，含子clone／schema／事件|
|7 AI及Resolver|advanceOneEvent／handleAutonomy及事件計數；沒有到期事件就是0，不強迫AI增加活動|
|8 Order及Reducer|submitFormalOrder，包含合法性驗證及內部draft|
|9 大型複製|structuredClone、cloneWorldDraft逐次；meta記城市／軍隊／事件／Receipt數，exact save bytes另列|
|10 Receipt歷史|receipt.history；與schema／encode可能巢狀|
|11 完整Schema|validateFormalWorld各次完整區間，不省略最終驗證|
|12 編碼與Checksum|encodeSave、canonical.JSON／UTF8、checksum.crypto；crypto包含非CPU等待|
|13 IDB排隊／讀取|request提交→success；原生getter補充分離result materialization。瀏覽器API無法再可靠拆開儲存排程及純裝置I/O，不編造數字|
|14 IDB寫入／完成|put／add同步submit、request完成、transaction lifetime直到真正complete；lifetime包含CPU／checksum及其他await|
|15 durable ACK|Worker傳回committed，main ACK標記；不提前報成功|
|16 React套用／重繪|main setWorld／layoutCommit標記及狀態訊息；不是精確render CPU|
|17 committed可觀察|合法狀態DOM斷言及兩次RAF；其後驗證原生DB的Applied Receipt，不把自動化觀察餘量稱純paint|

巢狀inclusive span不可相加當總延遲；同階段重疊用union，跨執行緒也不能直接累加。補充 [native-stage-details.json](native-stage-details.json)以12筆建造／研究分離原生IDB result getter：current／authority約6.7～39.4ms（典型約9～39ms），小於整段authority／save，證明不能把整個交易lifetime叫作磁碟延遲。Worker單命令GC區間union約35～76.9ms；CDP時鐘換算不確定度±12.7～36.15ms，main／Worker／threadpool各自分列，不相加、不以重疊證明唯一因果。CPU為整個pass的process delta而非每筆命令CPU；main heap不代表Worker heap，raw保留其可用性及限制。沒有上傳Chrome raw trace。

### 世界規模與確認瓶頸

[world-scale.json](world-scale.json)用相同prepared合成輸入直接計算，修正前段粗略新局0.2MB估值：

|世界時|城市|軍隊|排程事件|Receipt|UTF8 save bytes|Receipt JSON bytes|
|---|---:|---:|---:|---:|---:|---:|
|0|100|0|199|0|507617|2|
|96|100|2|218|7038|2845155|2061684|
|168|100|9|241|13266|5287839|3977719|

99份AI紀錄維持；0／96h存續99、168h自然存續81。長局約75%的保存JSON為Receipt歷史，歷史經重複clone、完整schema、canonical及原子current／backup／authority路徑搬移。直接慢trace中save1074ms、encode447.3ms、三次schema總和351.4ms（encode已包含其中151.5ms，不能再加），另有背景原子提交造成182.3ms排隊。這確認了分散的資料量放大及安全保存成本；不能宣稱已找到歷史8613.2ms、96h舊p95退步或提交前逾時的唯一原因。

### 未插樁有界ABBA（80筆）

[完整統計](bounded-statistics.json)、[逐組表](TABLE.md)、[逐筆raw](evidence/final-abba/)。四組各before→after→after→before，每pass固定五類合法指令，各版本每組10有效。80／80均committed且原生DB有Applied Receipt；0正式拒絕、0逾時、0browser error。相同prepared inputs的九組hash對照見manifest；before與after同機交錯、沒有其他本機建置／模擬同時競爭。nearest-rank分位數，小樣本p95等於max，不充作至少30筆Gate。

|世界／介面／速度|before p50／p95／max ms|after p50／p95／max ms|before→after >1秒|
|---|---|---|---|
|96h／桌面／10X|614.3／1599.5／1599.5|561.5／1142.0／1142.0|2/10→1/10|
|168h／桌面／50X|1094.3／4827.5／4827.5|971.0／1544.8／1544.8|7/10→5/10|
|168h／手機／10X|1193.9／2349.5／2349.5|786.2／1309.6／1309.6|8/10→1/10|
|168h／手機／50X|885.1／1788.2／1788.2|796.2／1143.1／1143.1|2/10→2/10|

合計19/40（47.5%）→9/40（22.5%），四組p50／p95下降，仍未達每次完整1秒目標。新baseline最慢4827.5ms（ACK3778.6ms、ACK後1048.9ms）；final最慢1544.8ms（ACK1415.5ms、ACK後129.3ms）。兩筆為未插樁，不能為內部段指定精確原因，也不能拿它們取代歷史最大值。最慢CommandId分別為 `command:05318426-5414-4aea-ba73-84324292bf24`、`command:69c6c293-2a75-44cd-980f-022add2a4fa6`。

較早clone-only ablation只有15有效（before5／after10），之後fixture服務中止造成兩次setup連線失敗，沒有送出命令；它不是完整ABBA、不用作接受比較。首次owned fixture建置遇冷啟動context destroyed，n=0；warmup後重試成功。所有失敗／重試log保留，不能解釋成已修復歷史提交前逾時。最終80筆另外完整執行，沒有合併不平衡15筆或刪除慢樣本。

### 安全與相容驗證

- draft／Reducer決定性、Replay、Persistence、Recovery、Runtime安全定向160 PASS／0 FAIL；含同一metadata下99AI同步／cooperative 1h與原native clone逐位元世界等價。
- World Stream／Admission 19 PASS／0 FAIL，負向before 5 PASS／1預期FAIL。新增共9測試；初次draft型別錯誤保留typecheck.log，後續明確FormalWorld型別修正，typecheck／Production Build通過。
- 真Production Worker／原生IndexedDB 5 PASS：三速正常提交、去重、真CAS衝突、reload、AI雙軍／Recovery桌面及手機。未使用fake IndexedDB代替此項。
- GitHub source95d：Push CI39354770273、PR CI39354781320成功，完整隔離Regression **1467 PASS／0 FAIL／1既有SKIP**，typecheck／build／Pages／Release檢查成功。自動取消的舊PR CI39354774861另保留，不冒稱執行完成。
- 因只改clone與patch，保留原35組AI長測，新增有界seed90217／168h／traits自然99AI相容一次（run39354770088成功）。與ba11同seed歷次結果的metrics／autonomy完全一致、168行CSV行為欄一致；raw final hash因release metadata等內容不同而不一致，未記錄normalized 168h完整world hash，不宣稱所有bytes相同。[比較原件](evidence/ci/ai-compatibility-comparison.json)。工作流程遇其他Runtime／AI變更或手動dispatch仍保留完整35組，標準完整Regression未縮減。
- C13、C9、C5～12、五筆排程與Issue4／5／6維持已完成；原DEMO379檔／14圖、歷次ABBA、35長測及所有歷史HOLD／FAIL保留。Android真機／私人存檔未驗。

### 停止點與下一步裁決

**C4 HOLD；沒有宣告整體Gate PASS。** 有界資料支持兩項小修復，仍在高倍率／長局超標。已知下一批較大減少重複工作的方向涉及私有draft所有權或儲存契約，需中控核准；不是已證明除此之外絕無更小優化。停止追加昂貴完整矩陣，沒有以80筆代替新局／96h／168h×三速×雙介面至少30筆的正式接受矩陣。

[DECISION.md](DECISION.md)比較A私有Admission draft與B不可變快照／Receipt ledger，列風險及估計效益邊界；兩者均未施工。原8613.2ms極值、96h舊p95退步與單次提交前逾時仍列未完全隔離。保留最小修復與證據，交中控決策後STOP；不Approve／Merge／Deploy／改main或reference。
