# UX-2 驗證記錄

基準 main：148f699ebf38c9ca77d665049d7aa4901e2cf83c（PR #21 已合併；正式 0.30.55）。
正式原始碼樹：050570f9f1531d126b773c4e80ffbb97f83f9b33；本機 85c769d 與遠端 a4c79fd 為相同 Git tree。

- Typecheck、Production Build、Pages 路徑／PWA scope、Release Metadata 與 Worker identity 一致性：通過。
- 最新分類及既有地圖互動定向測試：9 通過、0 失敗。九種合法文字、城市／野外／流亡／預約／水域／山脈排除、快取及關閉預設有驗證。
- 原生 Chromium：1440×900 桌面、390×844 手機模擬，各一組完整操作通過，0 pageerror。正式 Worker／原生 IndexedDB 載入公開合成世界，保留 99 AI。帝國版圖、XY 定位、七田點選、詳細分布、加入最愛、拖曳、縮放與偏好重載均通過。
- 8 次拖曳樣本：桌面畫布重繪 2.0～9.9 ms、手機 1.0～7.8 ms（含同機測試負載，非 GPU FPS／整體互動延遲保證）。每次僅處理 630～695／176～192 個可見合格座標；總快取不超過 2041／809。全區 LOD 的 visited=0、misses=0，不同步掃描 147456 格。詳見 Chromium result.json。
- 初次完整隔離回歸：1455 通過、16 失敗、1 skip；原始 JSON／log 保留。兩個標示按鈕舊互動測試已配合新增選單修正並定向通過，其餘為原有長測／輪詢期限失敗（同機並行造成負載，未刪除或放寬）。相同正式程式樹的 GitHub CI 39525188689 已通過：完整隔離 1472 通過、0 失敗、1 skip，Typecheck、Build、Pages 與 Metadata 全通過；初次失敗保留。後續證據提交的 CI 另以最新 PR HEAD 為準。

UX-1 與 UX-2 各自從相同 main 建立，正式程式修改無交集。此 PR 不變更存檔模型、生成、種子、政治權屬或拓殖資格。

尚待人工：實體 Android、GPU／低階硬體流暢度；未測玩家私人存檔。C4 延遲 Gate 仍 HOLD。未 Merge／Deploy，未宣告整體 Gate PASS。

## 相同視野開／關成對繪圖量測

同一 Production bundle、合成世界99 AI、固定(100,100)視野與縮放，各裝置以 off/on/on/off 順序、每段8次相同位移拖曳。64個Canvas CPU paint樣本完整保留在evidence/ux2-map-paint-paired.json。桌面各段 p50/p95：關10.8/18.8、開2.3/6.2、開1.4/2.1、關0.4/1.9ms；手機：關0.2/0.4、開0.6/6.4、開0.7/1.2、關0.2/1.5ms。首段有冷快取／同機負載，不能將較快的後段解釋為開啟標示使整個地圖加速。開啟的額外Canvas工作有限，關閉全部visited/misses=0；此量測不含GPU FPS、排程等待或整體互動延遲，也不是C4 AB/BA。
