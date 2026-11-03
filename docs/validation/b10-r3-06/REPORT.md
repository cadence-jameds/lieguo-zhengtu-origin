# B10-R3-06 技術交付報告

Draft PR [#59](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/59)，Base `feat/b10-r3-05-persistence-optimization`／PR58 `c370ff8a492de8711e764a82c8f1d43efef1a00e`，Branch `feat/b10-r3-06-ai-scheduling`。最終HEAD、完整隔離結果、Build／Pages／Release／最終CI與實際時間soak結論統一刊於[固定交付結論](https://github.com/cadence-jameds/lieguo-zhengtu-origin/pull/59#issuecomment-6601386114)，此檔不以定向或舊HEAD的PASS冒充最終完整Gate。

正式遊戲程式最後修改 `803b174db5d2be0adef24b94b22782856ae365b9`；前景量測來源 `8a8737cb296963bd50519a0e813ad24317a13fbe`，後續唯一遊戲差異為離線options轉交，前景路徑不變。離線最終量測來源803b174，before均為PR58 c370ff8。最終原生流程與153項定向回歸驗證803b174遊戲程式。沒有改main、上游PR、部署或下一階段。

## 真正瓶頸與施工

[初始profile](PROFILE.md)在正式修改前完成。原30秒測試把AI延後30日：先重播72,000個逐城小時經濟事件，保存故障後必須重播相同邏輯。單次72,001事件其實只有1個AI決策，不是99AI決策36秒。`reconcileVictory`72,004次／8,798.9ms，`campStatistics`6,427.1ms；每城人口重算、無帝國仍遍歷100陣營的hostile判斷才是主要重複成本。Scheduler不到250ms，未改其排序。

- `formal/victory.ts`：每次重算城市／帝國所有權必要條件；沒有陣營達45%城市時，70%征服與45%霸權均不成立。仍清除原candidate與事件；正式公式、持續時間、完成處理不變。需要完整條件時人口每城算一次，hostile只遍歷原條件可成立的帝國，順序不變。無版本不明的快取。
- `formal/reducer.ts`、`runtimeWorkBudget.ts`：固定target的單一私有replay；只在完整事件邊界讓出。一般8ms、T1壓力2ms slice，請求pause2ms；開始草稿前要求4ms IPC開口。不拆單一事件、不發布draft、不等所有T1完成；既有AI數量、頻率、策略、score、RNG與搜尋空間不變。
- `runtime.worker.ts`：已知持久ID的唯讀查詢不排在AI／不相關T1之後；未知ID等待抵達時的前方intake。查詢跨T2發布最多重讀3次，防止晚到Pending蓋過committed。控制／Recovery保留FIFO屏障；新world和writer完成準備後同時採用。
- `formal/offline.ts`／`persistence.ts`：後續真離線量測發現仍使用舊50ms預算；只新增選填options與型別轉交，Runtime使用同一預算。未傳options的既有呼叫維持原預設。整份檔案以有限逐字替換證明其餘內容完全相同，包括offline plan、clock、cap、所有驗證、編碼、讀寫與T2。

四種順序及正式資料流詳見[CONTRACT](CONTRACT.md)：JS服務機會、T1 FIFO、世界事件時間順序、玩家正式生效順序各自保留。控制操作不搶先發布舊草稿；普通tick不超越前方請求。沒有新增生產Worker或第二權威。

## 確定性及原子性

[31組完整對照](parity.json)：Reference使用PR58三份正式原始碼（Reducer／Victory／Offline），SHA256與原git bytes固定，獨立Vite module graph。每個輸入／輸出都經正式Schema驗證。比較每個事件／sequence／RNG cursor、所有AI與玩家命令及Ack、有序history、最終世界／資源／軍隊／戰報／勝利的canonical SHA256，沒有放寬近似值。

涵蓋0／99AI、兩個Seed、全部合法1／3／6／10／25X、同步99決策、72k事件、現代化／12治理／建訓研、44/45/69/70%邊界、霸權完成、兩帝國99AI奇觀出資及物流、實際戰鬥、離線、滅國／合法復國／終局、24世界小時、60k完整Verified Ledger。5X不是正式合法值，未為測試改玩法。

T1原Payload／Fingerprint／Revision／Branch與FIFO不變；T2仍是原Writer／Revision／Root CAS、世界／Authority／Ledger／Inbox／Recovery／戰報同一rw交易；T3遺失仍查原結果。DB `lieguo-formal-ledger-v1`、Dexie3、Save `lieguo-formal-ledger-save-v1`、100MiB未改。Admission、Preview、WorldStream v2、Ledger／Schema及Scheduler來源保留。

[原生Runtime故障](native-faults.json)包含真正terminate／重啟、私有replay期間Pending查詢、舊Writer被CAS隔離、原ID精確Ack重送／一次效果、99AI25X推進24世界小時與Recovery。另[原生Persistence](native-persistence-regression.json)9流程含全部11個T2寫入邊界、Quota、Manifest／Segment／Index／checksum損毀、匯入匯出Recovery中斷與雙頁Web Lock；[原生UI](native-ui-regression.json)6流程含真正GameApp建造／Preview、Ack與最後frame遺失、重啟、60k與分支草稿隔離。

## 成對原生延遲

Chromium154.0.8037.57／Linux／2 CPU quota／8GiB／React19 development／原生Dedicated Worker與IndexedDB。合法100勢力世界；單筆每組20個fresh browser批次，5／20／50各5批次。七情境每版245批／2,765筆命令；兩版共5,530筆。量測期間未並跑本機重型測試。

起點是`HTMLElement.click()`進入真正React handler，不是實體指標延遲；每批啟動成本排除，第一次AI仍冷。n小的批次尾端值只是本環境樣本，不是手機／桌面SLA。quantile nearest-rank，批次內命令相關，不能把50筆累積p95當單筆p95。

情境 | 筆數 | Before p50／p95 ms | After p50／p95 ms
---|---:|---:|---:
AI閒置 | 1 | 13.9／16.0 | 13.8／16.2
AI閒置 | 5 | 30.3／181.3 | 31.2／192.8
AI閒置 | 20 | 290.8／480.4 | 272.1／434.3
AI閒置 | 50 | 684.8／1,151.8 | 632.1／1,095.1
99 AI／1X | 1 | 95.4／110.9 | 55.7／65.2
99 AI／1X | 5 | 180.0／269.7 | 80.1／220.2
99 AI／1X | 20 | 445.9／636.1 | 385.7／575.2
99 AI／1X | 50 | 798.3／1,253.9 | 720.3／1,180.7
99 AI／25X | 1 | 99.9／110.2 | 56.5／68.4
99 AI／25X | 5 | 150.8／222.8 | 95.3／123.8
99 AI／25X | 20 | 395.5／804.6 | 218.7／343.6
99 AI／25X | 50 | 988.6／1,519.7 | 426.1／1,039.1
大型戰鬥 | 1 | 101.1／105.7 | 55.1／61.2
大型戰鬥 | 5 | 165.5／250.5 | 97.9／130.5
大型戰鬥 | 20 | 374.6／751.8 | 226.5／352.0
大型戰鬥 | 50 | 974.4／1,480.2 | 416.6／966.0
100城建造／訓練／科研 | 1 | 87.5／102.6 | 35.9／41.8
100城建造／訓練／科研 | 5 | 161.8／234.3 | 74.0／135.3
100城建造／訓練／科研 | 20 | 382.5／694.3 | 230.5／400.6
100城建造／訓練／科研 | 50 | 866.5／1,557.4 | 526.6／955.8
前景積欠12世界小時 | 1 | 100.4／109.1 | 51.4／62.8
前景積欠12世界小時 | 5 | 145.2／227.8 | 88.5／119.4
前景積欠12世界小時 | 20 | 392.2／645.5 | 206.2／351.5
前景積欠12世界小時 | 50 | 809.3／1,437.4 | 449.9／803.9
真正Away／Resume／12世界小時 | 1 | 16.6／18.4 | 17.0／21.6
真正Away／Resume／12世界小時 | 5 | 70.0／641.8 | 71.0／153.6
真正Away／Resume／12世界小時 | 20 | 1,391.5／2,874.2 | 232.4／358.3
真正Away／Resume／12世界小時 | 50 | 4,296.3／5,542.3 | 461.2／824.5

情境／筆數 | 第一筆 p95 before→after | 最後一筆 p95 before→after
---|---:|---:
99 AI／25X／20 | 111.7→62.3 | 892.8→370.6
99 AI／25X／50 | 114.2→70.2 | 1,655.2→1,192.9
真正Away／Resume／12世界小時／20 | 20.9→24.5 | 3,421.1→389.0
真正Away／Resume／12世界小時／50 | 34.5→31.0 | 5,643.5→895.6

階段／ms | 高負載單筆 before p50／p95 | after p50／p95
---|---:|---:
DOM handler→Worker收到 | 26.7／35.1 | 1.6／1.9
收到→T1開始 | 0.3／1.4 | 0.4／0.9
T1 API工作／等待 | 73.6／78.2 | 54.3／66.4
DOM handler→Durable | 99.9／110.2 | 56.5／68.4
Durable→正式開始 | 478.8／554.7 | 493.9／594.8
該命令內catch-up | 38.3／96.6 | —／—
正式Reducer | 19.5／25.5 | 20.7／27.2
T2 API端到端 | 67.3／81.8 | 75.9／82.6
T2回傳→Ack送出 | 0.0／0.5 | 0.0／0.1
Ack送出→React終局顯示 | 1.0／1.6 | 1.0／1.4
DOM handler→終局顯示 | 715.2／804.3 | 689.5／835.1


各情境每階段、第一／最後一筆、p50／p95／max／n、終局原因、yield／事件／連續slice、Main Long Task與heap詳見[native-summary.json](native-summary.json)。T1工作包含IDB等待及Worker再次取得CPU的時間；T2是正式API端到端，不冒充純IDB transaction時間。前景sync先補算時，單命令catchup欄位可能為空，等候反映在Durable→execution；不是零AI成本。

兩版每批第1筆committed，其餘快速不同改名仍依原名／原意判為Needs Confirmation：每版245 committed／2,520 needs-confirmation，無無聲遺失或為數字強制成功。每筆Payload名稱保留、ID唯一、Durable FIFO單調；具體回覆原因保留。建造／訓練／軍事等另由原R3-01回歸保護。閒置5筆、真正離線單筆尾端沒有全面改善；不掩蓋小樣本退步。

真正離線初版仍有50筆累積p95約4.5秒；原始結果保留於ignored artifact。依實測才接線離線預算，最終824.5ms，對PR58同方法5,542.3ms；必要事件仍全部執行。

## Node診斷、事件與記憶體

版本／場景 | ms（n=1） | 事件 | AI決策 | 事件／秒 | yield
---|---:|---:|---:|---:|---:
before／first-decision | 58.5 | 1 | 1 | 17.1 | 2
before／simultaneous-99 | 506.8 | 99 | 99 | 195.3 | 37
before／legacy-30-day | 13,932.7 | 72001 | 1 | 5,167.8 | 1510
after／first-decision | 46.6 | 1 | 1 | 21.5 | 2
after／simultaneous-99 | 273.1 | 99 | 99 | 362.5 | 25
after／legacy-30-day | 4,406.8 | 72001 | 1 | 16,338.7 | 479


Node數字是各場景一次診斷，不是p95或原生延遲；inclusive插樁不可相加。詳細calls／phase p50／p95／max及GC見[profile-summary](profile-summary.json)。基準legacy是獨立process，after在兩個較短場景之後；GC callbacks可能含setup延後送達，不能算成精確replay GC改善比例。CPU sample涵蓋Vite／編碼／工具本身。新版本legacy觀察347次GC callback，基準1,238；僅作配置成本線索。

版本 | 抽樣最大used MiB（非峰值） | 強制GC後used MiB | 最終歷史／決策
---|---:|---:|---:
before | 58.38 | 11.21 | 1743／2987
after | 62.80 | 11.16 | 1743／2987


[Worker heap](worker-memory.json)為無插樁CDP `Runtime.getHeapUsage`，每版9點、實際單一Runtime推進24世界小時；非連續峰值。末次強制GC僅診斷retained heap，未用於效能／完整Gate。實際wall時計入target，因此兩版最終歷史／決策數可能略不同，不能宣稱精確節省比例。主執行緒`performance.memory`只是近似值；沒有取得原生Worker GC次數。沒有新快取無限保留世界版本。

8ms／2ms是請求的安全邊界預算；冷AI、路由、戰鬥及finalize單一事件仍可能超過8／16／50ms，不能為達預算拆原子事件。連續slice牆鐘含OS preemption與GC，不是純CPU時間。玩家正式T2仍必須等待所有時間上先到的世界事件，以及當下必要的IDB交易。

## 驗證紀錄及限制

- 最終定向153 PASS／0 FAIL；新增10項含永遠Pending T1下完整事件前進、20／50 FIFO、Pending／Ack競態、切換屏障、真離線私有草稿／T1／單T2。原30秒案例定向8.407秒PASS，只代表定向。
- Successor／反竄改51個negative tests與全部positive CLI、Preview／Projection boundary通過；Typecheck通過。新離線passthrough由整檔精確比對保護，沒有交易通配或提高期限。原有測試檔、斷言、worker數與heap未改。
- PR #59提交958f474的CI [41620880507](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/41620880507)：2,418 PASS／0 FAIL／1 SKIP、Build／Pages／Release PASS；此為離線預算補修前結果，不能代替最終HEAD。最終結果見固定交付結論。
- PR58同本機配置基準：2,405 PASS／Runtime36.72s TIMEOUT／1 SKIP；150k36.44s PASS。原30s／150k120s、2workers、Node22.23.4、default heap維持。最終本機完整結果與實際耗時由原runner產生，不用定向取代。
- 第一輪定向與Typecheck同跑曾有既有20s測試TIMEOUT；安靜153項重跑通過。保留首次152輪151PASS／1TIMEOUT、原生driver早期導航／bootstrap失敗、首次記憶體bootstrap失敗及/tmp複本ENOSPC紀錄。清理僅限本輪已完成的拋棄式副本，未刪原始證據。模組匯入失敗在Vite依賴優化期間發生，沒有進入正式命令執行；相同腳本穩定後重跑通過。
- 最終另以實際wall-clock、offset0進行10分鐘99AI25X／React／命令／tab切換soak，結果和headless實際visibility逐項刊固定交付結論；不把synthetic clock當實際10分鐘。

R3-05獨立發布風險保留：60k cold p50／p95 7.48／11.53秒、795ms Main Long Task、100MiB與必要完整歷史驗證。R3-06 UI回歸單次60k新Worker載入7.245秒、觀察73ms Long Task、Snapshot467,794 bytes且無歷史；非同方法五次冷啟動，不能宣稱原尾端風險已消失。單次互動與時鐘更新仍可能有Main Long Task，完整分布已交付，沒有宣稱所有裝置低於50ms。

Android／真手機背景前景／實體觸控仍未驗；桌面headless不能替代。B5 E1 HOLD、Astra非PASS及實機手機待驗不變。需B10最終stack整合、獨立技術審查、發布前冷載入／Long Task及裝置驗收。保留Draft；不合併、不部署、不自動開始下一階段。

版本進位依使用者2026-11-03明示：「允許0.30.99→0.31.0，之後依同一規則進位」。未配置規則仍拒絕超99；三項新測試且舊拒絕測試保留。本機feature first-parent多次功能提交產生0.31.4，GitHub擬合併single功能提交產生0.31.0，均由同一規則生成，非手動改baseline／package或主規格。

## 九項最終答案的判定

1. 本機30秒與完整Gate：固定交付結論列原runner的真實PASS／TIMEOUT及秒數，不能由此處定向8.407秒推論。
2. T1：高負載單筆p95 110.2→68.4ms；20筆804.6→343.6ms；真正離線50筆5,542.3→824.5ms。部分閒置／單筆尾端無改善，非SLA。
3. 長事件：減少重複Victory計算；單一不可分AI／戰鬥仍可能長，不承諾每事件8ms。
4. 等待AI：正式時間上先到的事件必須等；T1在完整事件間優先持久接收，T2不提前成功。
5. 確定性：31組事件／命令／Ack／RNG／世界／有序歷史完整hash一致，非近似資源比對。
6. Worker／同步：無新增生產Worker；同Worker只加有界yield與只讀查詢。控制／CAS／T2維持，可能有timer及查詢重讀成本。
7. 99AI25X：24世界小時／故障恢復／UI回歸通過，實際10分鐘soak以固定結論的真實結果為準。
8. 整合：stack、Android、實體觸控、長期裝置／冷載入／Main Long Task仍需B10最終驗收。
9. 技術放行：依最終完整Gate／CI／soak決定；核心一致性失敗必須BLOCKED。工程測試通過也不代表合併、部署或正式發布驗收。
