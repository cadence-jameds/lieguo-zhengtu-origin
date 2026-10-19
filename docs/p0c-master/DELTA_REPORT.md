> 本文件保留cc4階段原交付與HOLD／Pending歷史；最新C13方案B已完成功能驗證、C4另有最終比較，請見[最終Delta](../p0c-final-delta/DELTA_REPORT.md)。

# P0-C 統一施工 Delta Report

本輪依玩家最新統一正式施工令，在原 Draft PR [#21](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/21) 施工。先前僅盤點／Evidence-only限制已由最新授權取消。不是重新找回不存在的UI：復原搜尋已結案，城市／軍隊既有PR9成果先回歸，本輪只實作核准差異及剩餘缺口。

## 基準與可追溯性

- main：`06c4cb93779f1f679bb77470515fd8aee1c42de9`。
- 原PR21保全點：`b4faa4e188a4b0a456a4af5b94ade2363bcee247`。
- Runtime受測基準：`ae39092bec61ebf3a52e497bc7f32a9a6c6cf519`，完整tree `4e8227741ee9e3a49d863aeadb723dfef3fde4b7`。其後最小C8導頁修正為 `a002ff21398e08a2410eee4077957c549d57b238`（tree `7db997ccefd4c99b6fc101ee4f24ac56bb41043f`），Formal／Worker／Persistence／Admission／useGame逐位元不變；各驗證明列其受測SHA，不把docs HEAD混同受測版本。
- 工作目錄：`/workspace/lieguo-zhengtu-origin`；分支 `feat/p0-c-9-five-strategy-ai-20261019`。
- Authority：玩家最新核准決議／施工令 > v94與有效補充 > 繼承規格；DEMO僅作指定視覺／操作比較。
- [逐項施工與驗收矩陣](../../P0C_MASTER_DELTA_MATRIX.md)、[本輪42個程式／測試檔案及相對main完整47檔](FILES.md)、[逐檔blob與SHA256](evidence/source-manifest.json)。其中本輪29個正式程式檔、13個測試檔；含原C9後，相對main共32個正式程式檔、15個測試檔。

## 具體變更與提交

|GitHub Commit|內容|
|---|---|
|`6b241dada9b56eb37386d43f6b0977648110e187`|施工矩陣與起始缺口保全|
|`e99a413b1a52eb7f5941be7c5978d2ae8305a92b`|C5流亡資格、C7偵察收件與舊資料處理|
|`f6956f482d4afaebbf0a35af2f0c232c0770146f`|五筆Formal容量、拒絕第六筆、UI與專項驗證|
|`2b6148f6bce11b5ce5b451b438db171b4334ed04`|C1指令提示生命週期、C8全域來襲警報與UI接線|
|`bbe66fc89d3900cc473608e454163aa2d365b7b9`|C10／11 DEMO呈現、C12簡介移除、C13合法領主排行及單一受控Notes|
|`401f2c3174072d1889b98e69f7c4ccdd3bb8a130`|C4追算＋命令合併單次原子保存；保留encodeSave完整驗證與CAS|
|`a7f168ccc6baef381094a043f9e5f2213305cf06`|共享情報權限、相容測試及瀏覽器驗證腳本|
|`c902fde7d20e46d0ef5f90192569a45c11ce95af`|所有容量摘要、拆除、schema統一五筆，補負向測試|
|`ae39092bec61ebf3a52e497bc7f32a9a6c6cf519`|實測找出的派兵無關revision拒絕；公開目標／自有兵力意圖的一次性重驗，真衝突拒絕|
|`a002ff21398e08a2410eee4077957c549d57b238`|C8直接打開目標城市行軍頁，同城重點警報亦有效；不改Runtime|

GitHub連接器建立commit時作者時間與本機不同，產生不同commit SHA；逐提交tree均驗證一致。[本機checkpoint與GitHub映射](evidence/publication-map.json)保留，不改寫或刪除任何舊commit。原鏈在 `checkpoint/p0c-master-local-a1130cd`，派兵本機checkpoint在 `checkpoint/p0c-dispatch-local-130e2fa`；原work／其他worktree不動。正式分支追蹤GitHub HEAD，無force push、reset、clean或merge。無文字合併衝突，沒有以任一版本整檔覆蓋AI成果。

## 遊戲規則與資料邊界

Formal引擎與384×384、政治權屬、路由、在途抵達時間、成本、工期、人口、戰鬥與外交規則保留。五筆是每城各類active＋queued總數，雙平行為最多2 active＋3 queued；曾達15,000／20,000資格永久且每城獨立。保留AI既有下單策略，不要求填滿五筆。schema陣列上限統一5，沒有Save Schema升版。

C5只允許有有效常規戰鬥兵的流亡據點；混編收編排除斥候。舊非法active據點轉為保留身分／歷史的cooldown tombstone，不發獎、不抹除合法部隊、不重複清算。

C7在報告生成、持久化、讀取、查詢、匯入匯出與UI共同保護攻方個人偵察快照。守方保留合法來襲／反偵察結果，沒有攻方返城交付情報。舊誤寄保留報告識別及系統警示，刪除未授權精確payload。共享警報仍依既有權限，不把精確偵察兵力變成友軍免費情報。

C1只在durable終態回報成功，成功提示1500ms；pending、失敗、重複與不確定狀態分開，錯誤可回看。C2前景FIFO／不可中斷邊界保留。C3派兵意圖只涵蓋公開目標身分／權屬／外交、己方選定兵力／科技與路由輸入，不讀隱藏敵軍。仍有前景／分支／campaign fence、CommandId去重、正式reducer再驗證與CAS；沒有無限重試或放行真衝突。

## UI與DEMO依據

DEMO來源固定 `reference/demo-v0.30.2` / `44728f749044c1a5f1ad4fe47f1eccc391c7d9b2`，唯讀 `/workspace/reference-baselines/demo-v0.30.2/source`。原379檔雜湊、Typecheck／Build與14張圖直接沿用 [原基準](../demo-v0.30.2-reference/REFERENCE_BASELINE.md)，不重做整套比對。

|項目|DEMO原行為|Formal本輪結果／核准差異|
|---|---|---|
|C10|滅國畫面、背景及復國操作|採用國土盡失、敗北美術、主要復國入口；保留Formal三個合法候選、400人口／零兵力／各600資源／48h保護，不恢復廢止的選址／舊引擎|
|C11|近城半徑8、有限連接、透明領土／邊緣、首城帝國標示|只改呈現geometry；保留正式政治／384地圖／地形。有限陸地走廊不穿水面／河川或山脈，快取不因無關clock／receipt重算；開關初始關閉及縮放拖曳點選保留|
|C12|指定取消簡介設定|建立／管理／編輯輸入與多餘展示移除；既有description欄位及命令契約相容保留，改名保留舊值|
|C13|DEMO領主按城數、人口排序；組織另有精確軍力公式|已核准的公開城數→人口、同分同名次、ID穩定排列；保留三分類瀏覽、搜尋、玩家標記與詳情。組織軍力公式／精確敵軍權限未核准，**PARTIAL**|
|城市／軍隊|既有PR9場景與操作|保留PR9；補真五筆摘要／滿額資格與active區分，沒有重建另一套城市／軍隊UI|

新增 [DEMO／Formal五城並列結果](evidence/demo-controlled-pair.json)與 [四張對照圖](screenshots/demo-pair/)：兩版放入相同五城座標及帝國分組，含近距離連接與遠離島狀領土。各自保留原地形、調色、尺寸與引擎，其他獨立城市不同。不是同一存檔移植，也不是地形／玩法等價證明。

[27張本輪UI圖](screenshots/ui/)涵蓋1440桌面、390與320px，包含五筆排程、來襲警報、版圖、滅國／復國、領主排行與成本卡。全部PNG逐位元核對上傳blob；[manifest](screenshots/MANIFEST.json)含SHA256。圖來自C902或更早但相同受測UI模組；ae39092只改派兵admission與驗證腳本，不把這些舊圖冒稱該SHA重拍。其後a002ff2修正C8直接進行軍；原3張incoming圖保留為修正前證據（當時只驗證軍隊頁已開，實際停在招募），新增A002的1440／390／320三張incoming-march圖與[6案原生入口測試](evidence/ui-entrances-final.json)，不能沿用舊圖宣稱行軍入口已驗證。合計31張本輪PNG（27 UI＋4 DEMO並列），另保留原基準14張，總共45張。最新原生瀏覽器命令／延遲記錄另行列明Release身分。新增99個存續AI、100城的[地圖CPU240筆補測](evidence/map99-perf.json)，原98存續UI場景的測量保留為歷史診斷，不混稱99存續。

## 驗證與失敗保全

- Typecheck、Production Build、Pages資產與SW scope、Release／Worker identity一致性通過；最新本機產物為候選0.30.64、commit/contentSha a002ff2，沒有部署或手動改版號。[Typecheck](evidence/final-typecheck.log)、[Build](evidence/final-build.log)、[Pages](evidence/final-pages.log)、[Release](evidence/final-release.log)。
- AE完整隔離回歸：**1445 PASS／0 FAIL／1既有SKIP**，[每案狀態](evidence/full-dispatch-final.json)。執行 `node scripts/verify-in-isolation.mjs full`，沒有在正式工作樹直接跑會改寫docs的完整套件。
- 首輪完整 **1427 PASS／11 FAIL／1 SKIP**保留於 [full-first.json](evidence/full-first.json)。失敗包括舊三筆／斥候獎勵預期、提示API相容與既有30秒案例（當時有競爭工作，獨立執行通過，未隔離唯一原因）。依核准規則修正測試資料／預期，保留notice相容；未放寬timeout、刪除必要案例或忽略失敗。C902階段完整1443／0／1亦保留 [full-final.json](evidence/full-final.json)。
- 派兵新負向重現：舊實作9 PASS／1 FAIL；修正及測試fixture的terrain／politics問題各次失敗均保存，最終23 PASS／0 FAIL。[before](evidence/dispatch-before.json)、[中間結果](evidence/dispatch-after.json)、[fixture修正前](evidence/dispatch-final.json)、[最終](evidence/dispatch-final2.json)。原生pilot亦保留main／舊candidate的實際revision拒絕，不以失敗ACK當成功延遲。
- 容量第六筆不扣資源／人口／事件，單雙並行、取消／完工、多城獨立、AI同權、建築／田／牆共用、codec／Save／Replay／Recovery／CAS、工匠城堡與負向六筆schema案例均在完整回歸及 [容量專項](evidence/capacity-schema-final.json)中。
- [原生DB資料權限](evidence/native-privacy.json)兩案PASS：無效純斥候舊據點退出且工匠0；守方物理報告精確intel移除、警示保留。這是synthetic場景，不包含公開私人存檔或情報payload。
- [UI首輪17 PASS／6 FAIL](evidence/browser-first.json)：六項是測試selector／預設城郊定位問題；修正腳本後 [8 PASS／0 FAIL](evidence/browser-selector-retest.json)，覆蓋六個重驗及額外兩組六文明。共23個唯一案例通過，沒有因此修改正式UI來迎合selector。
- 原C9三檔逐位元相同，[manifest](evidence/source-manifest.json)保存blob。原35組168／360／720h證據完整保留於 [C9 Delta](../p0c9/DELTA_REPORT.md)，不冒稱為新SHA重跑。C902的兩seed自然96h相容資料在本目錄evidence的ai-c902 JSON／CSV；均無fault／rejected command。104729有一次自然征服，liveAI變98為合法滅國，初始仍99；這兩組96h普通野外出征為0，不據此宣稱野外正向覆蓋。
- 原生Worker／IDB的多速命令、同ID重送、真衝突、雙軍並發、Recovery去重保存各自受測Release身分。C902原紀錄見 [五案相容](evidence/c9-native-c902.json)；ae39092五案全部PASS，見 [最新相容紀錄](evidence/c9-native-ae39092.json)；混合量測見效能報告。

最新自動 [Runtime matrix](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/39250046582) 已在ae39092完成35組（加plan共36個job）且全部success；35份JSON／CSV已從Actions輸出取回，[完整結果](evidence/ai-ae39092/)與 [逐組索引](evidence/ai-ae39092/summary.json)均保留。每組起始99 AI、無注入兵力／資源／情報、Runtime faults皆0。合法拒絕與自然滅國仍逐筆記錄，不把success誤解為零拒絕或不會滅國。比較policy只在獨立編譯副本替換純selector；traits使用正式性格權重。這次由原有push機制自動執行，未手動重新派發長測。

C8追加修正：`a002ff21398e08a2410eee4077957c549d57b238` 明確傳遞行軍入口、清除舊派遣目標，並以request key處理同城重點警報。原測試只斷言軍隊頁已開，漏掉預設仍在招募的問題。新增互動定向案例及真瀏覽器同城重點／滅國其他入口專項，不改軍隊命令或引擎。最新 [push CI](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/39270201778) 已完整隔離 **1446 PASS／0 FAIL／1 SKIP**，Typecheck／Build／Pages／Release亦通過，見 [CI證據](evidence/ci-a002ff2.json)。AE完整1445案例及35組Runtime結果仍各自保留，固定AE效能矩陣已全部完成，逐筆原始數據保留其真實受測版本。最新本機定向27 PASS／0 FAIL，見[incoming-after.json](evidence/incoming-after.json)；同一測試對AE舊版為0 PASS／1 FAIL，見[incoming-before.json](evidence/incoming-before.json)。首次archive缺.release導致啟動失敗亦保留，補入測試metadata後才取得行為負向，不把環境失敗當產品負向。最終測試只加強真實dialog斷言，正式程式不再變更；最終提交的CI另查。

## C4與未決事項

完整量測方法、每筆raw、p50／p95／max／超過1秒數、CPU與記憶體、main與candidateAB／BA比較，以及地圖CPU繪製成本，見 [PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md)。24個ABBA pass共1,440次嘗試，1,374筆有效、66筆未納入有效量測，36組皆至少30筆有效；輸入雜湊一致。Candidate718／720有效、成功樣本最大10,118ms，main有一筆等待ACK至少15秒仍未確定終態；詳見統計的逾時保留說明。即使功能／資料安全PASS，**C4仍HOLD**，未符合全鏈路1秒即不宣告Gate PASS。

C13保留 [C13-ORG-RANK-PENDING裁決選項](C13_ORGANIZATION_RANKING_DECISION.md)：維持瀏覽、明確核准公開城數／人口新指標，或先核准軍力可公開範圍及公式。沒有偷讀AI私有兵種／戰力。未增加80項任務、不開始B9／B10、不改平衡。Issue #18不另擴充，既有Android更新與durable save ACK／候選Worker身分安全回歸保留；實體Android未驗。歷史HOLD／FAIL、B5 E1 OWNER WAIVED保留。

本輪只推送原Draft PR；main／reference未寫入，未Approve、Merge、關閉Issue、部署Pages或宣告任何Independent Gate PASS。後續由中控分項審查。
