# 來源、版本與執行狀態

PR #61，Base `validation/b10-final-integration`／`aaaee9d3b9e16f2bad6ee8a96d1ef2902d0c4607`，Branch `fix/b10-release-unblock`。本文件記錄程式與驗證來源；後續純文件提交的 HEAD 由 PR 顯示，不冒充所有實機數字都在文件 HEAD 重新校準。

| 項目 | 不可變來源 |
|---|---|
| 舊容量基準 | PR #60 `aaaee9d3b9e16f2bad6ee8a96d1ef2902d0c4607`／0.31.4 |
| 正式有界 Persistence 原生 0～150k／故障／1025 真提交 | `72e0e45f56d60f46a7e5da28448b6d1897ba161b`，content `3a3ae8dc2e3b60167f1b3e9dfa3e16020f573bd0`／0.31.16 |
| 真 GameApp 25 次冷載入、第二次十分鐘 | `243f68a9307ca1335beb1b023dab22d7d1fbdca4`／0.31.18；src bytes 與 `3a3ae8d` 相同 |
| 最後程式修正 | `bf63a6c6f651cb29eee7dd05c2f79d268a694f79`；僅略過 raw 純 replay 不使用的引用掃描，bounded 世界及 persistence=true 的完整掃描不變 |
| 最後程式＋有限 Gate pin | `1f44074d1d55186dd5210b159401c1dbc580bfd2`／0.31.19，content `bf63a6c6f651cb29eee7dd05c2f79d268a694f79` |
| 最終原生 SW 五組 | before `29ade31`／0.31.8 → after `1f44074`／0.31.19；**4 PASS／1 FAIL**（Install Reject 後 activation timeout） |

最後 raw 修正的三檔定向：**44 PASS／0 FAIL／0 SKIP**，包括 B9-2、CommandEvidence、BoundedPersistence。沒有修改 2000 真物流 fixture、240 秒 hook、30 秒 Runtime、150k 數量或 120 秒期限。此定向不取代完整 Gate。

## 最終執行

第二輪 `1f44074` 本機完整隔離：**2,462 PASS／0 FAIL／12 SKIP，另 1 個 B9-2 240 秒 hook timeout，整體 FAIL**。150k 原 120 秒測項 **7,325.7ms PASS**；Runtime developer catch-up 原 30 秒案例 **9,419.5ms PASS**。原先 `243f68a` 的本機與 CI 同為 2462／0／12／hook timeout，也保留。不能寫成本機完整 Gate 通過。

程式 source `1f44074` 的 GitHub CI [41803649348](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/41803649348) 為 **2,473 PASS／0 FAIL／1 SKIP，整體 PASS**，含全部原有 successor／31 世界／Preview／Projection／Typecheck／Build／Pages／Release。CI checkout merge SHA 為 `298a6f08f642a2c18921f4ce24afa42ad63082c2`；與本機開發分支 first-parent 不同。最終純文件提交的 Checks 以 PR 顯示，不以此 source CI 假冒另一 HEAD 的完整結果。

Typecheck、npm run build、Pages path 與 Release／SW identity checks（1f44074）皆 PASS，0.31.19／content bf63a6c／dirty=false。完整隔離使用原 runner／2 workers／Node 22.23.4／預設 heap，沒有並行本機瀏覽器量測。原生 SW 失敗獨立於 Node／CI，任何後續綠燈均不解除 P0。

## 上游保持

| PR | Branch | HEAD |
|---|---|---|
| 54 | feat/b10-r3-01-durable-player-commands | edca2f29805f0cdc4b0f89cd3cd00a8f9a819e39 |
| 55 | feat/b10-r3-02-async-construction-preview | 4e56b69d1af107ee454213d0276f06a2ca10976f |
| 56 | feat/b10-r3-03-command-ledger | 1737d14a8f210fb2d33eb5dadbde18c3bb375586 |
| 57 | feat/b10-r3-04-ui-projection | dfa574a4de24fe9069df2a90d3edae6a64f191da |
| 58 | feat/b10-r3-05-persistence-optimization | c370ff8a492de8711e764a82c8f1d43efef1a00e |
| 59 | feat/b10-r3-06-ai-scheduling | 8d40f63c5efbd08ee252f533719d5f58fc95b3dd |
| 60 | validation/b10-final-integration | aaaee9d3b9e16f2bad6ee8a96d1ef2902d0c4607 |

GitHub 再確認 #54～#60 均 open Draft、未合併、Base 堆疊未改。main 仍 `443f170b277f71ee26a34ee3b5017687a98e01ab`，仍是舊自動部署 workflow；兩個先行護欄只是可審查提交，沒有假稱已裝進 main。

本機最後另依 CI 原清單執行 27 條 successor／反竄改／部署／世界對照／boundary 命令，加 art board 與 player feedback 保護，整批 exit 0。31/31 世界等價、3/3 部署隔離、Preview 79 模組／0 authority imports／0 storage capabilities／0 render reducer preview calls，Projection 的歷史 materialization=0。這些 PASS 不覆蓋本機完整回歸 FAIL。

本機兩輪均 Node 22.23.4、2 CPU quota、8 GiB cgroup、2 workers、NODE_OPTIONS=null、預設 heap limit 2,197,815,296 bytes，未並行重型測試或瀏覽器量測。完整環境摘要在 measurements.json；memory.events 為累計值，不將既往 OOM 次數誤歸因於某一輪。CI hosted runner 與本機分開，未猜測其 CPU／heap。
