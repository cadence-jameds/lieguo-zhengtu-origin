# UX-1 施工基準與安全設計

基準main148f699ebf38c9ca77d665049d7aa4901e2cf83c（PR21已合併）；正式版本0.30.55。main CI39454274452、Pages39454274384均成功。本輪不觸發或操作Pages部署。

新戰役使用contentVersion `lieguo-formal-b5.2-time2`（內部B1 fixture為b1.2-time2），獨立DB `lieguo-formal-stage2-time2`。舊DB `lieguo-formal-stage2-schema1`僅唯讀封存匯出；不驗證後修復、不遷移、不補算、不清除。匯出的historical archive有獨立格式，禁止載入新世界。新戰役仍由正式start流程產生campaignId與99AI；舊資料不混入新局收據／戰報／Recovery。

campaign.configure沿用正式CommandId、Admission、Receipt、CAS、原子Save與ACK。Worker先以舊有效倍率追算到Admission邊界，提交成功後reanchor；失敗保留原世界與設定，重送由Receipt去重。一般設定不開啟資源或保護罩。既有戰術回合的10X上限由原公式保留；共用同一重排函式，保留EventId與剩餘回合比例；其他施工／科研／行軍事件不因改速重排。

離線將私有draft的clockMode設offline，effectiveSpeed改讀一般速度；保留developer.enabled、資源補滿與保護罩。補算完成後回foreground，整段只保存一次完整結果，失敗不發布。背景通知先停止後續ticks，重複away及前景的重複resume皆不再推進；reload／resume讀取已保存的時鐘錨點並只補算其後期間。

懸浮位置／顯示偏好只存在localStorage，不進Formal世界。滑條只暫存，命令成功持久提交才更新目前設定與成功回饋。拖曳門檻6px，pointer capture支援觸控；尺寸變更修正邊界，避開資源列、主要導航及重要來襲警示。保留設定頁替代入口。

UX-2獨立自同一main施工，正式檔案不與UX-1重疊。C4仍HOLD；此更新不包含B9奇觀、文明突破、現代軍事或AI重新校準。

背景邊界以主執行緒的performance.timeOrigin+performance.now送入Worker；Worker限制在已發生的單調時間範圍，立刻凍結後續追算上界，讓尚未開始的前景處理也不能在隱藏後繼續套用開發者倍率。已開始的原子工作完整完成。背景flush把該邊界的wallAt與世界快照一起保存；排在原子提交後的等待時間會在恢復時依一般速度計入，不因佇列等待而漏算。重複away不重設錨點；成功resume／新局／切換後才清除前景上界。
