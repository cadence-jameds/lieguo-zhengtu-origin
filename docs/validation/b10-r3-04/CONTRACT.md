# R3-04 唯讀展示契約（待審）

基準 PR #56 `1737d14a8f210fb2d33eb5dadbde18c3bb375586`；獨立 stacked Draft，Base `feat/b10-r3-03-command-ledger`。不修改 DB v3、Save Format 1、Ledger Format 1、正式規則、Scheduler 或 T2 寫入。上游 #54／55／56 保持原分支與 Draft。

## 資料流與 Schema

Runtime 已提交世界 → `WorldProjection`（Verified Ledger 綁定、增量來源證據）→ `WorldStream` v2 → `PresentationStore` → React selectors。PresentationWorld 的 kind 為 presentation、presentationVersion 為 2，不能作為 FormalWorld／Reducer／Persistence 輸入。共用純讀函式接受 WorldRead 聯集，權威專用欄位必須先縮窄。

明確選取城市、軍隊、勢力、研究、大型工程、物流、定居、殖民者、總督、動態據點、外交帝國、任務、戰鬥、時鐘與展示規則輸入。排除 Ledger、commandReceipts、completionReceipts、Events、AI autonomy、fixture、政治 RNG counter；任務保留 facts/completed/claimed，排除 settledCities/autoShipments 來源集合。城堡文明與治理最後寫入證據由 Verified Reader 衍生。動畫只接收原 UI 使用的最後 128 筆戰鬥效果及完整 cursor，不刪除任何權威收據。地形只在 Snapshot 或真正變更時傳送。

## 原始點擊與 Admission

useGame 在 useLayoutEffect 記錄 React 已提交的展示版本，issue 不從尚未顯示的 Store 或 Worker 新世界補造原始意圖。來源含 campaign、branch、writer、session、revision、projectionSequence。T1 核對來源，保存原始 Payload／Revision／Context；Runtime 仍依既有可靠命令規則重新驗證並建立獨立 execution envelope，不覆寫原始行。

治理 fingerprint 保留原最高 committedRevision、同 revision 第一筆原始順序的最後寫入身份；ABA 不能穿越。Worker 冷啟動／分支重建掃描已驗證歷史，普通提交只觀察新增身份。城堡文明使用永久城市狀態或精確身份查詢。軍隊路線 fingerprint v2 用事先準備的靜態地圖 SHA-256，覆蓋原地形與山脈全部值；其餘原語意欄位不變。v1 Pending 仍依原指紋驗證，v2 不在 T1 掃描或雜湊全歷史。

## WorldStream v2

Header：protocolVersion 2、campaignId、branch、writerEpoch、sessionId、baseRevision、nextRevision、baseSequence、projectionSequence、snapshot/patch。序號涵蓋同 Revision 的無世界效果結果；T3 丟失留下序號缺口。實體 Add/Update/Remove 附 ID 與 base/nextVersion；順序變更另傳 order；區段各自版本。普通 Patch 不含命令身份歷史。未變實體保留參照，刪除版本項目即移除，不累積 tombstone。

Store 驗證整包版本、形狀、身份與必要參照後才發布；失敗不變更現有畫面。不連續、舊分支、舊引擎、不支援協定、重複亂序均拒絕。只要求展示 Snapshot，最多三次自動恢復，一次一個請求，三秒期限；仍有手動重新同步入口。不得重送／取消正式玩家命令。有效 Patch 重設自動恢復預算；Snapshot 本身不能支撐無限失配風暴。

終局 Ack／Status 的既有權威 Revision 亦作為同 campaign 畫面下限。若最後一份世界訊息遺失，250ms後仍未收到對應畫面即啟動上述有界追補，不等待下一Tick（含滅國／終局凍結）。多筆Ack只合併最高下限，不延後首次期限；低於下限的Snapshot不能清除異常。正常隨後到達的世界訊息取消追補；不同campaign與舊Ack不改畫面。此處不變更任何正式命令Revision，只重取唯讀畫面。

## React 與保留成本

useSyncExternalStore 統一展示來源；同城畫面 Selector 只依該城、所屬勢力、總督與真實全局規則輸入失效。世界時間影響資源展示時正常更新。招募輸入維持元件本地狀態。地圖／主畫面 memo；不同 branch/writer 的城市表單、地圖、情報與 Preview 重新建立。Preview 使用最新全局展示版本，只讀專用 Worker，不受局部畫面快取阻擋。

冷啟動來源重建仍 O(歷史)，普通展示 diff O(目前實體與展示區段)，不是 O(命令歷史)。全 Snapshot 仍傳完整現況與靜態地形；城／戰鬥／外交等區段未細拆到每個純量。Persistence 的編碼、完整驗證、匯出匯入、Recovery 仍可能處理完整歷史，由 R3-05 後續處理。本批不動權威原子契約，不保證所有 Android 皆無 50ms 長任務。
