# C4 效能驗證：HOLD

正式目標是玩家操作至合法處理、durable commit及畫面更新全部在1秒內。小樣本已重現超標，因此保持HOLD；功能／資料安全測試PASS不能代替延遲Gate。

## 已實作的瓶頸修正

原追算與命令分別保存，現在於私有draft完成事件追算、以原意圖重驗正式命令，最後共用一次原子保存／revision。事件及命令沒有省略，失敗保存不暴露draft，也不產生成功ACK。若命令拒絕但有合法追算，只保存追算結果。

Persistence移除重複前置完整validateFormalWorld；最終encodeSave仍完整驗證，之後才進入原子DB交易／CAS。receipt、authority、reports、backup故障及Replay／Recovery安全定向63案與完整1445案回歸通過。

[前置剖析](evidence/profile-diagnostic.json)10筆Node／fake-indexeddb改名診斷中，save共7168.6ms、encodeSave2794.0ms、30次validate2736.8ms、digest1939.0ms；這些含巢狀區段，不能相加當總耗時。這批SHA未記錄，sourceTreeHash有保存，只作定位重複驗證／保存，**不是main與candidate原生端到端比較**。

## 最終原生AB／BA量測方法

- main `06c4cb93779f1f679bb77470515fd8aee1c42de9`，candidate `ae39092bec61ebf3a52e497bc7f32a9a6c6cf519`；兩者都是Production Build、正式Worker與原生IndexedDB。
- 新局、96h、168h × 1440×900桌面／390×844手機模擬 × 1X／10X／50X。每組順序main→candidate→candidate→main，各pass20次嘗試；每版／組共40次，至少30次committed有效量測才符合樣本數要求。每組有改名、建造、訓練、研究、派兵五類。
- 自然世界起始99 AI；0h／96h仍99存續，168h為81存續但99份agent紀錄。自然滅國不補活、不降低活動、不改事件頻率；不要誤稱168h仍99存續AI。
- 為了讓同一世界合法測到五種操作，僅設定己方生產建築／倉儲、資源、人口、民兵與研究時代等公開前提。這是**natural-derived controlled player prerequisites**，不是完全未修改新局。每次操作前明確還原同一checkpoint，避免先做命令消耗資格導致後續比較不同；不在實際待測命令內跳過事件。
- 每pass記錄各speed輸入SHA256與bytes，確認ABBA同資料。存檔只留授權雲端本機，不公開.realm-save或私人資料。
- 起點為實際提交按鈕pointerdown；記錄Worker post、durable ACK與committed畫面斷言後兩次requestAnimationFrame。讀原生DB驗證Applied Receipt放在renderAt取樣之後。畫面完成值包括瀏覽器自動化斷言／兩幀觀察成本，是保守觀察值，不等於精確實機paint時間。
- 成功值取max(ACK,render)；拒絕保留原因與ACK，但不當作成功延遲。保留所有慢樣本／失敗，不丟冷啟動值；分別列成功樣本數、失敗率、p50／p95／max、>1s。main與candidate有效命令分布若因main派兵拒絕而不同，不能直接把總體差值當同分布因果改善；另按命令族列統計。
- 同一主機依序執行，量測時不並行Build、完整Regression或AI模擬；CPU／cgroup quota／記憶體環境與每pass load／freeMemory會保存。手機是Linux headless Chromium touch viewport模擬，不是Android真機／GPU或手機記憶體驗收。

量測正在執行，數字尚未交付；最終raw／統計將追加本文件及evidence/latency。不能把pilot或舊SHA當最終ABBA結果。

## 已完成的定向證據

[派兵修正pilot](evidence/mixed-dispatch-fixed-pilot.json)15次全部committed，三種speed各五類命令；仍有>1s，樣本不足最終Gate。main與修正前candidate的實際revision拒絕保留在本目錄的mixed-pilot紀錄。

[ae39092原生相容](evidence/c9-native-ae39092.json)五案PASS，包含三速改名／同ID重送／真衝突、桌面與手機雙軍並發及Recovery去重。這批不是最終30筆ABBA資料。

## C11 地圖繪製成本

[原始240筆](evidence/map-perf.json)：99-agent受控Formal世界，各view／開關狀態30次鍵盤平移。等待初始assets後，觀察renderer既有data-render-ms；不在每幀重算政治geometry。

|寬度／視野|版圖關閉 p50／p95／max ms|版圖開啟 p50／p95／max ms|
|---|---|---|
|1440 全區|1.0／3.5／14.6|2.4／6.1／6.5|
|1440 近城|0.5／1.2／1.7|1.2／4.4／5.3|
|390 全區|1.0／2.0／3.8|2.8／3.9／4.9|
|390 近城|0.4／4.6／4.8|0.8／1.7／2.0|

這是Canvas CPU指令提交成本，排除初始載入等待，不是手機GPU FPS或完整互動延遲。快取失效／水面／遠離島狀領土／不改權屬另有純呈現測試與並列圖。前兩次測量腳本因selector匹配close按鈕、浮動圖例遮住工具列而失敗，已保存first／second-failure.log；改為精確按鈕並正常關閉圖例，不強制點穿遮擋、不修改遊戲迎合測試。

## 剩餘限制

**C4 HOLD**。CPU／記憶體與各組最終量測尚待彙整；沒有降低99 AI活動、跳事件、放寬timeout、假ACK或宣告Gate PASS。實體Android、GPU FPS與私人長局存檔均未驗。
