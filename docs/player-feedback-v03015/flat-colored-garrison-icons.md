# v0.30.15 駐軍列扁平彩色圖示

只替換頂部駐軍分類圖示，徵兵卡、兵種詳細資料和拓殖隊維持現有美術及規則。

圖示使用透明背景與平面剪影，不加金屬材質、立體浮雕、漸層或投影。各分類保留不同形狀，不只靠色彩辨認；數量與點選明細維持原功能。

| 分類 | 圖形 | 色系 |
| --- | --- | --- |
| 民兵 | 劍 | 珊瑚紅 |
| 槍兵 | 長槍 | 珊瑚紅 |
| 弓兵 | 弓箭 | 暖橙 |
| 散兵 | 標槍與圓盾 | 暖橙 |
| 偵察兵 | 眼睛 | 青 |
| 輕騎兵 | 馬頭 | 藍 |
| 重騎兵 | 裝甲馬頭 | 藍 |
| 衝車 | 破城槌 | 紫 |
| 投石機 | 投石機 | 紫 |
| 輜重隊 | 補給車 | 綠 |
| 城堡衛隊 | 十字盾 | 金 |

素材：`public/art/formal/hud-unit-icons-v03015.png`，4 欄 × 3 列圖集，第 12 格空白，手機與桌機共同使用此圖集。生成方式：內建 imagegen，text-to-image，transparent_background=true。

實際尺寸：1448 × 1086，RGBA；各格 362 × 362。原始生成圖不裁切，利用現有 CSS 圖集定位。細微邊緣與內部色差屬生成圖本身，在原圖檢視可見；分類圖案和主要配色已檢視。

## Imagegen prompt

```text
Use case: stylized-concept
Asset type: tiny garrison classification HUD icon sprite atlas.
Primary request: Create exactly ONE transparent PNG, landscape 4:3 canvas, preferably 1536 x 1152 pixels. A precisely aligned invisible grid of four columns and three rows, twelve equal square cells. Eleven flat colored military pictogram icons in row-major order; twelfth cell completely empty and transparent.
Composition: Each icon perfectly centered within its own equal square cell. Ample transparent margins approximately 18 percent of each cell on every side. Similar visual weight and bold thickness. Readable when each cell shrinks to 30 x 30 pixels. Do not draw the grid.
Row 1 from left to right: (1) simple sword, coral red; (2) simple long spear, coral red; (3) bow with arrow, warm amber; (4) javelin with a small round shield, warm amber.
Row 2 from left to right: (5) eye, bright cyan; (6) plain horse head, sky blue; (7) armored horse head, sky blue, visibly distinct from the plain horse through broad simple armor silhouette; (8) battering ram, lavender purple.
Row 3 from left to right: (9) trebuchet, lavender purple; (10) supply wagon with wheels, mint teal green; (11) shield with a cross, gold yellow; (12) no icon, empty transparency.
Style: Extremely simple crisp flat game pictograms. Solid filled silhouettes. Maximum one or two flat solid colors per icon. Bold clean shapes and useful negative space. Consistent visual language across all eleven icons. Avoid tiny decorative detail. The colored icons must show clearly over a near-black forest-green game interface.
Backdrop: True transparent alpha everywhere outside icon shapes, including all margins and the final empty cell.
Avoid: labels, letters, numerals, captions, borders, grid lines, background tiles, white background, checkerboard graphics, gradients, textures, shadows, bevels, embossing, metallic material, realistic rendering, gold ornate styling, 3D, thin line illustration. No extra icons.
```
