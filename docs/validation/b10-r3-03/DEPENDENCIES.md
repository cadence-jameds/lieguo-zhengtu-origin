# commandReceipts 引用契約（R3-03）

基準：PR55 `4e56b69d1af107ee454213d0276f06a2ca10976f`。分類：A 全歷史；B 精確 ID；C issuer/fingerprint/disposition；D 摘要／永久事實；E 展示；F 歷史版本。此矩陣依直接呼叫及函式內容建立，尚未刪除任何正式收據。

| 模組／引用 | 分類 | 真實依賴／不可省略的語意 |
| --- | --- | --- |
| reducer.submitOrderDraft / replayReceipt | B/C | 同 ID issuer／fingerprint 衝突；原 committed revision 與 rolled-back；重送不產生效果 |
| reducer replayClonePolicy / cloneReplay* / finishFormalAdvance | A/F | 草稿隔離；AI receipt revision 於整批收尾正規化；不可分享可變 receipt 而污染先前世界 |
| worldDraft.cloneWorldDraft | A | 特別防非 plain receipt／額外欄位；舊檢驗拒絕條件不可被新 cache 跳過 |
| runtime.worker command/query/finish | B/C/F | 已提交結果查回、收據 revision 正規化、T2 同時保存 Ack 與世界 |
| persistence.authority / commit | A/C/F | 所有 campaign 身份聯集、既有收據不可遺失、序號／revision CAS、完整 authority 比對 |
| persistence.reconcileReceipts / switchInbox | A/C/F | 回復聯集與 rolled-back；回復時既有排序按 CommandId；Inbox 與當前世界狀態可能不同 |
| persistence.loadAnchored / checkpoint | A/F | 舊 checksum 綁完整世界；authority divergence 必須 Recovery；驗證回復點不能暗用目前 head |
| persistence.exportStoredSave / saveCodec | A/F | quick/full 均保存完整世界 receipts；舊 envelope 不含 Inbox 終局拒絕結果 |
| schema appliedReceipts / unique / revision checks | A/C | 先建立 applied issuer 集合；即使 duplicate malformed rows 仍保留舊拒絕行為；再檢查全域唯一及 revision |
| combatSchema / research / age / military / logistics / settlement（schema） | B/C | 活躍軍隊、事件、付款、貢獻來源的精確 applied issuer 身份 |
| wonderSchema / wonderConditionSchema | B/C | 建造源命令 payload、host、付款／運輸／修復 fingerprint |
| breakthroughSchema / modernCatchupSchema | B/C | 付款／資格／專案來源、跨段 ID 參照；不能只保留 recent tail |
| growthTaskSchema / growthTasks.appliedCityCommand | B/C/D/F | 已領獎可引用非常久以前的 fingerprint，包括 Recovery 後仍存在的 claim；非純 UI 歷史 |
| buildingDetailData.castleSource | B/C/D/E | 現存初始城堡工地的建立者；舊資料缺少文明快照時需 issuer 回溯 |
| extinction.craftsmanForConstruction | B/C/F | 原 applied receipt 與精確 craftsman/city payload 共同授權；失去記錄會撤銷合法工程 |
| battles.evacuateCitySurvivors | A/C/D | **第一個**符合原 owner 的 applied receipt，否則第一個 applied receipt；不是任意 ID 查詢，順序影響正式撤退軍隊來源 |
| autonomy.hasReceipt | B | 已有增量 Set；以最後 receipt 物件與長度偵測失效；不能讓舊分支 index 漏出私有草稿 |
| autoLogistics.recordAutomatic | append/C | AI 自動物流也產生正式命令身份，必須進同一帳本與 T2 |
| governance.applyGovernance | D | 用收據長度增量判斷命令是否接受，決定 spent；不能換成只計玩家命令的長度 |
| governanceAdmission.governanceBase | A/C/D/F | 最新 applied governance 與 malformed fingerprint fallback；相同 revision 的先後保留原迭代語意，防 ABA |
| governanceAfterCatchup / orderAdmission | B/C/D/F | ID 已用、玩家後續操作、catch-up 新命令及配置衝突；不能盲改 expectedRevision |
| worldStream / applyWorldPatch / useGame | A/E/F | 現有 Wire/structuredClone/完整差分仍是 full receipts；R3-04 前需完整相容投影，不能送不完整 tail |
| developer.session / B5Lab | A/B/E | inspect 完整歷史與 prefix 查找；即使非主遊戲也不能靜默改成部分資料 |
| generator / fixture | empty | 初始空集合；不能用新戰役名義清除既有 campaign 去重證據 |
| R3-02 Preview Worker | D | 不傳 receipts；工匠／資格 context 共用正式規則，保持獨立唯讀能力 |

## 必須先落地的跨模組契約

1. 純同步 Schema／Reducer 需要「已驗證、綁 manifest 版本」的精確讀取介面；不得把 WeakMap／當前 head 當完整性證明。Schema 的解析複本與 structuredClone 都會失去純記憶體綁定。
2. 歷史順序不是可任意更改的展示資料：撤退來源、governance ABA 及 Recovery 排序都可影響正式結果。
3. Original outcome、目前分支 disposition 與 Inbox 的展示 Ack 必須分開；不能覆寫舊紀錄或以一個全域 mutable disposition 代表所有 checkpoints。
4. 無世界效果的拒絕結果也必須進可攜身份證據。僅遷移 world.commandReceipts 會遺漏 Inbox；舊 portable 檔案本身無法重建未攜帶的拒絕結果。
5. 新格式的拒絕結果提交若推進 manifest 而不改遊戲 revision，Runtime 的保存世界引用也必須原子更新；不能只修改帳本 head。
6. 舊格式匯入要有「完整來源可證明」或明確拒絕策略，不能用看似完整的收據清單冒充所有已持久命令結果。
