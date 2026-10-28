# PR #44 科技驗收圖修正

本輪修正驗收產生器與驗收證據。正式 `techArt()` 的 82 項映射原本即全部指向獨立 WebP，沒有引用舊 SVG 作主卡；沒有重生／替換 public 圖片，也沒有修改玩法、數值、ID、存檔或正式 UI。

根因：現代文明專屬與傳統文明科技都屬 category=civilization；舊產生器僅按 category 篩選，再按 age 排序。現代 age=0 排在傳統 age=2／3 前，產生每列六格，卻只宣告四欄。因此第 3、4 欄其實仍是舊圖，而真正的新傳統圖超出畫布。先前的文明圖板及以它作成的驗收結論無效，本報告取代該部分，不能沿用舊圖宣稱通過。

## 正確對照

- [六文明傳統：舊 I／舊 II／新 I／新 II](../boards/civilization-technology-pairs.webp)：每文明只取傳統 age=2／3，排除 modern ID 及 modern-civilization scope；相同 ID 配對。
- [六文明現代專屬：舊／新](../boards/modern-civilization-technologies.webp)：每文明一項 modern-civilization，獨立兩欄。
- [全部 82 項逐 ID 比較與視覺複核](visual-review.md)：六張完整圖板；每格列 ID，不依名稱模糊配對。
- [正式 I／II／III 一](../boards/technology-tiers-1.webp)、[二](../boards/technology-tiers-2.webp)：原配對正確，補列 ID 並重製；沒有正式 III 的項目保持空白。
- [圖板來源矩陣](../boards/board-manifest.json)：每格 ID、old/new、路徑、SHA256 與圖板 SHA256。所有圖板行寬必須與欄頭完全相等；新欄只接受正式獨立科技 WebP，錯誤即中止。

其他兵種、城市、建築、透明底與可讀性圖板已重新執行產生器檢查，未發現同類欄位錯配；與先前檔案相同者不重複修改。產生器改以已提交的 coverage.json 為預設，避免默默讀入 work 的舊快照；需要最新盤點時明確傳入 `work/art-audit/coverage.json`。

## 82 張圖片與實際前端

[逐圖記錄](visual-review.json) 包含每張實際物件、角色、材質與光線觀察、十項分數、來源雜湊與圖板。已實際檢視全部 82 張，確認是深色具象工藝／器物卡，不是符號替代；I／II／III 的工具、裝備與工序有實質區別。現代 15 項按正式世代呈現現代器材，與傳統卡保持相同渲染語言。

自評 18～19／20，筆觸細節密度比母圖偏密（07=1）；攻城及部分工程物件的負重／機械連接仍保留審圖風險（08=1），未宣稱機械工程或獨立 Gate 已放行。這是看圖後的候選自評，**玩家最終美術核准、獨立 Gate、實體手機及慢網均待驗**。既有 B5 E1 HOLD、Astra 非 PASS 等歷史事實保留。

[即時 techArt 盤點](live-mapping.json) 與 [瀏覽器結果](browser.json) 分開驗證：前者讀真實 catalog／映射與檔案雜湊；後者載入真正 Art、techArt、ResearchView 與詳情，不以路徑存在推定顯示正確。39 案全 PASS、0 page／HTTP errors：

- 320／390／1440px 全部 82 張實際卡圖：逐 ID 檢查 img.src、512px 解碼、無 SVG／fallback、無頁面橫向溢出。
- 六文明 × 桌面／手機 × 傳統 I／II／現代專屬：36 個真實科技樹與詳情截圖，使用有效的合成 Formal world，無私人存檔。
- 代表：[390px 傳統 II 詳情](390-civ_zhongguo-traditional-II.png)、[桌面現代專屬詳情](1440-civ_byzantium-modern.png)、[390px 全 82 卡](390-all-technologies.png)、[桌面全 82 卡](1440-all-technologies.png)。未研究的現代科技沿用既有 UI 暗化狀態，原色比較看圖板；沒有為驗收更改正式 UI。

## 檢查與重現

- `python3 scripts/check-art-boards.py`：PASS；檢查六文明傳統／現代隔離、相同 ID、欄數、圖板雜湊、階級圖板，以及全部 82 個新欄對應前端 WebP。
- `node scripts/art-coverage.mjs`：PATH_PASS，82 科技的來源與雜湊未變；其他 catalog 覆蓋亦通過。
- Typecheck、Build、Pages 路徑及 release artifact 身分：PASS。
- 全套隔離回歸由本次 PR HEAD 的 GitHub CI 執行，結果見 PR Checks；上輪 HEAD 結果只作歷史，不冒稱本輪驗證。
- 本輪沒有 Runtime 變更；原 release notes 檔保留，未另添第二份。

```sh
node scripts/art-coverage.mjs
python3 scripts/art-comparison-boards.py work/art-audit/coverage.json
python3 scripts/check-art-boards.py
node scripts/verify-technology-browser.mjs <playwright/index.mjs> <Vite URL>
```

PR 維持 Draft，不合併、不部署，等待玩家審圖。
