# PR #40 第二輪：城市易主後物流配額歸屬

日期：2026-10-27（Asia/Taipei）。施工分支維持 `feat/player-auto-logistics`，從中控固定審查 HEAD `5dde3530a5773ebcb3f56af4fae5febd1286aea2` 繼續；PR Base 仍為 `f78477fc724b1c79816f7a932e0fd856f7a2ffdd`。不另開 PR，不合併或部署。

## 正式重現與補修

重現成立。合成世界建立兩個不同帝國，各有正式籌資中的奇觀；玩家另有市場 Lv15 的物流城。使用正式 `finishConquest()` 征服結算入口將物流城交給敵方 AI，再呼叫原本 `wonderDecision()` 產生提案，以正式命令提交。

修正前，市場實體可用 15 支，AI 原策略提案穀 19,880（10 支商隊），但前任手動配額 2／0 均使正式引擎拒絕：「市場可用商隊不足」。正式征服結算原本已清空一般路線，遺留的 `logisticsSettings` 仍限制手動可用額度。

- [手動配額 2 的修正前帳本](before-manual-2.json)
- [手動配額 0 的修正前帳本](before-manual-0.json)
- [修正前定向重現結果](before-tests.json)：只選中兩個重現案例，2 FAIL；另外 6 個因名稱篩選未執行，不能算已驗。

補修只在 `changeCityOwner()` 加入真正易主時的設定清理：清空前任 `autoLogistics`，刪除前任 `logisticsSettings`。征服、接收都使用此入口；同一城主的呼叫不清除設定。新城主依現有市場與實際在途數量取得可用商隊，之後可建立自己的設定。

沒有修改 AI 策略、配額計算器、出貨／到貨／返程事件、奇觀成本與工期、存檔 Schema、ACK／CAS 或 Recovery 核心。既有在途記錄的 command／shipment／faction／purpose、貨物、路徑、時間、工程預約及事件均保留。

## 修正後證據

- [配額 2 修正後](after-manual-2.json)、[配額 0 修正後](after-manual-0.json)：同一 AI 提案正式 committed；來源穀 100,000 實扣 19,880 後為 80,120，同一命令重送為 duplicate。到貨後只增加 AI 自己帝國的工程池，玩家帝國池保持不變。
- [在途帳本](after-in-transit.json)：征服時保留手動 2／一般自動 5／奇觀自動 8，共 15 支；新城主當時可用 0 支。原一般與手動貨物照常入原目的城，原奇觀貨物 16,000 入原玩家工程池；返程前仍占容量，返程後恢復 15 支。此後 AI 能從征服城正式派出自己的奇觀運輸，不恢復前任自動路線。
- Save／Load、真正 Fake IndexedDB 損壞 current 後 Recovery，分別驗證征服後在途、已到貨返程、全部返程三階段。資料與收據逐項相同；Recovery 依既有機制增加一個 revision，測試明確驗證該遞增。
- 正式線上與 Cooperative 離線補算使用同一批在途事件並得到一致結果；征服後接收、同城主呼叫、legacy 路線設定，以及玩家奪回後建立新配額都納入定向測試。

## 本輪獨立驗證

| 項目 | 本輪結果 |
| --- | --- |
| 修正前正式重現 | 2 FAIL（預期，用以證明缺陷） |
| 修正後定向 | 8 PASS／0 FAIL／0 SKIP，見 [targeted-tests.json](targeted-tests.json) |
| 受影響回歸 | 336 PASS／0 FAIL／0 SKIP（13 檔），見 [affected-tests.json](affected-tests.json)；涵蓋物流、奇觀、征服、易主差分、滅國及持久層 |
| Typecheck／Production Build | PASS，見 [build.json](build.json) |
| GitHub CI | 以本輪最新 HEAD 的 Checks／Actions 為準；完成後在 PR Conversation 記錄 Run URL 與實際完整回歸統計 |

[本輪來源雜湊](source-manifest.json)涵蓋正式引擎、8 項新測試及同一 PR 更新摘要。測試產生的歷史證據 JSON 會還原，不覆寫前輪報告。本輪依限定複審執行定向與受影響回歸；沒有再跑一遍前輪已成功的本機完整回歸，完整檢查由本輪 CI 對新 HEAD 執行。

## 歷史與停止條件

[第一輪報告（固定舊 HEAD）](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/5dde3530a5773ebcb3f56af4fae5febd1286aea2/docs/validation/player-auto-logistics/README.md)及[修改前 PR 說明](pr-40-before-ownership.md)完整保留。第一輪 2,050 PASS／0 FAIL／1 SKIP 與三尺寸 Chromium 3／3 屬於舊 HEAD；本輪不把它們當成新 HEAD 重跑結果。正式 UI 沒有變更，本輪沒有重跑瀏覽器。

Android／iOS 真機、虛擬鍵盤、safe-area 與 100X 完整原生批次仍待驗；既有私人存檔案例未提供資料，未宣稱已驗。歷史 legacy art 紀錄、B5 E1 HOLD、Astra Gate 未 PASS 不變。

未核准分支 `feat/wonder-player-auto-supply-20261027` 保持待清理，未沿用或刪除。PR #40 維持 Draft／未合併，不部署、不關閉 Issue；完成後 STOP，等待中控重新審查與玩家放行。
