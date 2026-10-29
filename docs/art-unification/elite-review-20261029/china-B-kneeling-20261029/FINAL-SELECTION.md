# 中國精銳最終定案

玩家審查定案日期：2026-10-30（Asia/Taipei）。

**中國最終採用：commit `3798a7f70fd76bfb5143a320a1e3703339a743a0`（`3798a7f`）。**

**內容：B 魚鱗甲＋低姿跪射。** 前腿跨出、後膝落地，披風與連弩形成低而寬的輪廓；保留胸腹、肩甲、護臂與裙甲的圓形重疊魚鱗。玩家已完成本版中國精銳審查，本版為中國精銳最終定案候選。

## 定案素材

- [核准原圖](raw/china-B-kneeling-v1.png)：1254×1254，SHA256 `b7ff3b671ac852511b3a61fd1f118bbfb2ba0b7aac979250c2675d3906993790`。
- [512px 卡面](china-B-kneeling-512.png)／[128px](china-B-kneeling-128.png)／[64px](china-B-kneeling-64.png)。
- [一般／現行精銳／B 原站姿／B 低姿跪射比較](comparison-512.png)／[128px](comparison-128.png)／[64px](comparison-64.png)／[手機直排](comparison-mobile-128.png)。
- [生成當時的來源與 SHA 紀錄](manifest.json)／[原提示詞](prompt.txt)完整保留，沒有重新生成或修圖。

**原 B 站姿僅保留作比較，不作最終採用。** [原 B 站姿 WebP](../candidates/china-B-scale.webp) 的 SHA256 為 `c6c62b22e3a7ea925bcd109436432c1b46a7d206b3d141ff17688209c30d4ba4`；不刪除、不覆寫、不將其與本次定案的低姿跪射混用。

## 紀錄優先順序與同步範圍

本文件記錄玩家本次最終決定，優先於舊報告、生成 manifest 或比較板中製作當時的「待審／待玩家選定」狀態。圖像內歷史標籤、原圖、卡面、比較板、提示詞與來源紀錄全部逐位元保留；定案不以重生圖片或改寫 `3798a7f` 完成。

本輪僅追加定案文件與更新審圖報告，正常推送既有提交及其文件後繼提交到 PR #45 的 `feat/art-player-feedback-20261029` 分支。文件提交的 HEAD 與核准美術提交 `3798a7f` 分別記錄；原 SHA 及祖先鏈完整保留，不 force push、不 rebase、不 cherry-pick。

日本候選、其他美術、正式 Runtime 圖片、Art Registry、兵種映射、規格與玩法均維持 `3798a7f` 的內容。這是中國候選的審圖定案，沒有替換正式遊戲圖片。PR #44 不修改，PR #45 保持 Draft；不建立新 PR、不合併、不部署。獨立審圖與實體手機等既有待驗項目不因本次文件同步而宣稱完成。

GitHub CI 請以包含本文件的新版遠端 HEAD 實際 Actions 結果為準，不沿用舊提交的綠燈。先前報告中的容量不足、未 Push 與未觸發 CI 為當時歷史紀錄；本輪 Push、遠端 HEAD 與新版 CI 結果另於本次交付回報。
