# 實際圖像參考與裁切

`technology-timber.png` 直接取自 `public/art/catalog-technologies.webp` 的木工格，整數裁切 rect 為 `[512, 0, 512, 512]`；未重畫、拉伸或改色。生成時實際傳入的路徑是 `work/references/technology-timber.png`，此處保留相同原始位元組供重現。它與完整科技母圖一起送入每批科技卡生成器。

每批 `batches.json.references` 保存真正傳入的參考圖、SHA256 與提示詞。兵種同時使用正式兵種及六文明衛隊圖集；一般城建同時使用兩張正式建築母圖或兩個時代圖集；施工另帶入該批完工圖以保持幾何。城市、城牆及場景各用兩張同類既有圖。玩家要求保留的藍金騎兵候選另作局部編修參考，已確認舊母圖仍同時傳入。

原始 PNG 完整保留，包含未選用與玩家退件的候選；正式輸出及量測裁切在 `assets.json`。技術處理只做圖集提取、去除鄰格碎片、安全留白、等比例縮放及 WebP 壓縮，不以程式繪製人物、器械或建築。來源、參考及正式輸出均有 SHA256。兩次沒有圖像產物的工具拒絕記錄在 `generation-blocked.json`，不列成完成圖片。

重現正式衍生檔需 Python 3、Pillow、NumPy、SciPy：在 repository 根目錄執行 `python scripts/prepare-art-candidates.py`；無 `work/art-batches.json` 時會讀取已提交的 `batches.json` 及原始 PNG，不重新生圖。`python scripts/check-art-files.py` 是唯讀的路徑、尺寸、alpha、校驗碼及場景前景像素檢查；它不能證明人體／器械結構或風格一致。

`old-symbols/*.png` 是既有 `public/art/formal/tech-*.svg` 在瀏覽器中的點陣快照，只供新舊圖板排列；原 SVG 保留，這些快照不會進入正式 UI，也不是新生成的 TECH-CARD。原 SVG 的 SHA256 記錄在 `docs/art-unification/before-map.json`。一張未採用的弩手中間候選因逐字提示詞未留存，獨立隔離於 `rejected/crossbow-clean-intermediate.*` 並標為 BLOCKED_PROVENANCE；已以完整留存提示詞重新生成採用版本。
