# C4 最終比較：HOLD

正式目標：玩家確認操作至合法處理、IndexedDB durable commit與畫面更新全部在1秒內。新候選仍超標；功能安全／CI成功不代替C4 Gate。

## 固定來源與方法

- Before：PR21 `cc4f332dbdb6691275138d0ded88160200fb34ce`，production content `a002ff21398e08a2410eee4077957c549d57b238`、0.30.64；cc4相對A002為文件／測試，正式程式相同。這次before是原PR21，不是repository main06c4cb9。
- Candidate：`ba11a66694a9190074c035f87ce0501d7744dd77`，production content同SHA、0.30.66。兩版皆未插樁Production Build、正式Worker與原生IndexedDB；來源與artifact identity保存在各result與source manifest。
- 0／96／168h × 1440×900桌面／390×844手機模擬 × 1X／10X／50X；每個世界／介面先before→candidate→candidate→before，每pass每速度15次，共24pass、1080次。每組每版原規劃30有效；改名／建造／訓練／研究／派兵各6次。原driver summary仍有舊版eight-per-family文字，原件保留，[更正說明](evidence/latency/HARNESS_ERRATA.json)以實際rows為準。
- 168h手機1X候選一筆提交前等待逾時，原組29有效；只對該組追加四個五類命令ABBA pass，共20次，before40／candidate39有效。其餘組各30；沒有重跑整套矩陣或刪去失敗。
- 最終1100嘗試、1099有效、1未納入有效量測；36組均達至少30。全部有效row命令類別正確、committed且原生DB含Applied Receipt；9組世界／速度輸入SHA256全部一致。[完整統計／命令族](evidence/latency/statistics.json)、[primary原始資料](evidence/latency/primary/)、[補測](evidence/latency/supplements/)、[合併索引](evidence/latency/combined-runs.json)。JSON中的legacy `main` key表示本輪before PR21。
- 新局與96h保有99個存續AI；168h自然剩81、仍99份agent紀錄。未復活或減少AI，未改決策頻率或事件。合成輸入沿用原固定seed自然世界；只設定己方生產／資源／人口／民兵／時代等合法測試前置，並非完全未修改的新局。每次操作前正式匯入同checkpoint；不在計時命令內跳事件。
- 起點是實際確認按鈕pointerdown；記錄post、commandReceived、durable ACK、committed DOM斷言後兩次RAF。取max(ACK,render)；DB收據驗證在renderAt之後，不把按鈕反應當保存成功。DOM／兩幀觀察含自動化成本，不等於精確實機paint。
- 同一量測主機交錯依序；正式計時期間無其他本機Build、Regression、瀏覽器工作或獨立AI模擬。保留輕量進度讀取。異地GitHub自動CI／長測另列，不混同本機負載。
- Linux x64、Intel Xeon Platinum8573C、3可見logical CPU，cgroup CPU quota200000/100000（2CPU）、記憶體上限8GiB，Node24.19.0；每pass load/freeMemory及Chromium版本在raw。手機為Linux Chromium touch viewport模擬，未做Android真機或GPU驗收。
- 分位數採nearest-rank `ceil(n*p)-1`，與既有報告一致；偶數p50取下位中位數。各命令族是分層描述，不將少量族內p95當獨立Gate。

## 結果

|版本|有效／嘗試|正式拒絕|提交前／觀察逾時|有效樣本>1秒|成功樣本最大值|
|---|---|---|---|---|---|
|before PR21|550／550|0|0|222（40.4%）|9298.7ms|
|candidate|549／550|0|1|189（34.4%）|8613.2ms|

16／18組p50下降、13／18組p95下降，**尾端改善不一致**。例如96h桌面10X的p95由1152.9升至2298.4ms，168h桌面10X亦由1999.1升至2276.8ms；不把總體比例或單一max降低當成所有情境都改善。

下表n／分位數／max／>1s只計成功有效row；最後欄保留所有未納入有效量測的嘗試。成功max不代表包含未送出的逾時操作之總體最大等待。

|世界／介面／速度|PR21 before（cc4） n／p50／p95／max ms／>1s／未納入有效量測|candidate（ba11） n／p50／p95／max ms／>1s／未納入有效量測|
|---|---|---|
|0h／1440px／1X|30／228.1／392.1／488.1／0／0|30／221.5／401.3／428.7／0／0|
|0h／1440px／10X|30／229.2／376.4／409.5／0／0|30／224.6／360.1／384.6／0／0|
|0h／1440px／50X|30／243.5／463.3／488.3／0／0|30／225.8／415.7／614.3／0／0|
|0h／390px／1X|30／226.8／408.6／409.0／0／0|30／207.4／381.9／720.1／0／0|
|0h／390px／10X|30／224.4／393.8／407.0／0／0|30／214.1／369.1／912.4／0／0|
|0h／390px／50X|30／212.8／354.9／396.7／0／0|30／219.4／353.2／408.7／0／0|
|96h／1440px／1X|30／689.1／1017.5／3074.6／2／0|30／606.2／1365.3／1579.6／3／0|
|96h／1440px／10X|30／717.5／1152.9／1300.6／5／0|30／626.3／2298.4／2474.8／8／0|
|96h／1440px／50X|30／905.0／1896.4／2000.3／11／0|30／851.3／1475.5／1668.9／12／0|
|96h／390px／1X|30／689.7／1086.3／1293.8／4／0|30／575.2／830.2／1083.1／1／0|
|96h／390px／10X|30／728.3／1355.7／1393.7／6／0|30／649.0／1653.1／3953.6／3／0|
|96h／390px／50X|30／925.7／2369.4／4543.1／12／0|30／850.1／1486.7／2386.6／10／0|
|168h／1440px／1X|30／1610.4／3370.1／4376.4／30／0|30／1340.7／3124.4／3124.9／23／0|
|168h／1440px／10X|30／1164.9／1999.1／8491.7／26／0|30／1174.6／2276.8／2279.7／20／0|
|168h／1440px／50X|30／1564.0／2919.7／3198.0／29／0|30／1357.2／2558.6／3326.5／28／0|
|168h／390px／1X|40／1686.1／3213.5／9298.7／40／0|39／1361.8／2913.3／4489.5／34／1|
|168h／390px／10X|30／1477.4／2686.0／4461.7／28／0|30／1156.1／2437.6／8613.2／22／0|
|168h／390px／50X|30／1521.7／2055.6／2106.4／29／0|30／1255.1／2013.8／2370.3／25／0|


唯一失敗：168h手機1X候選第一pass sample5改名，15秒等待條件逾時；最後觀察仍為sample4已committed的army.dispatch，沒有本次rename送出紀錄。歸為提交前切換／觀察逾時，**沒有證據判成正式拒絕，也沒有證據宣稱根因已修好**。保留原raw，補測只為樣本數，不將原失敗改PASS。

候選最大8613.2ms來自168h手機10X建造：postDelay4.0ms、commandReceived約35.8ms、ACK8052.9ms、ACK後畫面觀察560.3ms。可確定主要等待在ACK之前；received→ACK仍混合Worker排隊、事件追算、保存與回傳。沒有該極端樣本完整內部分段trace，不能斷言唯一根因。原生診斷亦顯示in-flight工作等待、完整驗證／複製、checksum及IDB仍占成本；本輪沒有為數字省略它們。

## 分階段診斷與最小修正

診斷只在固定commit的git archive隔離副本插樁，不放進production。[source／插樁檔雜湊](evidence/profile-provenance.json)保留；當時診斷preparer沿用工作環境Release metadata，不能拿embedded version當作source SHA，正式來源以archive head為準。正式ABBA的兩個未插樁產物則使用各自正確的固定head metadata。初版15筆及細分15筆用於找熱點；部分晚期診斷曾與診斷建置／定向檢查重疊，不能當正式ABBA。下表取細分before／after各自第一個1X pass（各5筆，其他工作之前）的inclusive中位數；不同事件追算與GC仍可能影響，不據此推估所有樣本改善。

|階段（ms）|before|candidate|
|---|---|---|
|durable receipt history guard|76.9|5.0|
|global structuredClone累計|132.6|109.6|
|完整schema驗證累計|207.1|215.1|
|encodeSave（含驗證／digest）|159.0|201.9|
|Persistence commit（含上述與IDB）|531.9|508.2|
|Worker handle（含保存後通知）|887.5|853.8|

每筆完整驗證仍3次；累計clone次數包含許多小事件物件，不能直接當完整世界複製次數。巢狀區段不可相加。IDB首筆原生讀authority/current約4.6/9.4ms，backup/current/authority寫入請求53.7/51.7/37.9ms，其中同步提交clone40.6/43.5/24.3ms；請求時間已含提交時間。postMessage合計14.7ms。前後[細分原始資料](evidence/profile-native-detail.json)、[after](evidence/profile-native-after.json)與[初版](evidence/profile-native-before.json)完整保留。

實際改動只有普通save副本與收據比對；完整strict驗證、checksum、IDB交易／CAS、CommandId／Receipt、Replay、Recovery、AI事件及回放順序保留。完整回歸1458／0／1、67安全定向、原生5案相容／Recovery及2案舊資料權限回歸均成功；GitHub完整結果與具體修改見[Delta](DELTA_REPORT.md)。

**C4 HOLD**。長局、較大存檔及高倍率仍有顯著尾延遲；一筆提交前逾時原因未完全隔離。原先1440次ABBA（候選718有效、323超標、10118ms最大）不變，見[歷史報告](../p0c-master/PERFORMANCE_REPORT.md)。不以跨session較小max冒稱本次優化因果，也不把HOLD改Gate PASS。
