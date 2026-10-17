# 美術素材

public/art/river-city.webp 是 2026-09-06 由 imagegen 產生的原創歷史河谷城市全景，1774 × 887，網站轉存 WebP。包含城牆、民居、兵營、農田、礦場、河流與橋梁，未使用《世紀帝國》或《蒼狼與白鹿》的遊戲素材。目前僅在起始畫面使用；可建城市已改為空地底圖與動態建築。

地圖棋盤、地形、城市／資源／盜賊標記與軍隊路線，依實際遊戲狀態繪製。文字符號使用系統字型，現有 SVG 圖示保留自專案 M0。

歷史文明 ID、代表兵種、規則與素材路徑分離，後續可替換美術而不改動存檔的文明身份。


## v0.4 正式最低素材集

- `public/art/terrain-base.png`：1536×1024，原創空地底圖，無預先蓋滿的城市。
- `public/art/building-atlas.png`：1402×1122 透明 atlas；14 通用建築與六文明城市中心。畫面及地圖共用相同素材管線。
- `public/art/siege-report.png`：1774×887，原創圍城戰報插圖。

以上三份由 imagegen 於本輪各生成一次，未使用既有商業遊戲的素材或截圖。`docs/ART_V4_PROVENANCE.json` 保存檔案雜湊、尺寸與裁切範圍；`docs/ART_V4_PROMPTS.json` 保存原始 brief。圖像透過 `src/game/assets.tsx` 的 manifest 與裁切座標取得；規則與存檔不依圖片檔名。

沒有新增外部字型或音訊。按鈕、地塊邊界、資源／軍隊資料標記為功能性介面幾何；建築及場景使用以上原創 raster 素材。


## v0.6.0 時代背景與世界標記

新增四張 1536×1024 場景：`city-scene-dark-open.webp`、`city-scene-dark-wood.webp`、`city-scene-feudal-open.webp`、`city-scene-feudal-wood.webp`。依原場景局部修改道路材質，保留廣場、城門和地塊位置；城堡時代沿用原場景。

`world-resources.webp`：1536×1024 透明 4×2 atlas，上排糧食／伐木／採石／金礦，下排鐵礦／牧場／盜賊／空白。`protection-dome.webp`：1254×1254 半透明藍色護罩，隨真實保護狀態顯示。

六份皆為原創 imagegen 圖像，使用無損 WebP 轉存，沒有使用商業遊戲素材。詳細 brief、尺寸與 SHA-256 見 `docs/ART_V060_PROVENANCE.json`。地圖的格線、選取框、路線與文字仍為功能性 Canvas 繪圖。

## v0.8.0 封建石牆背景

`public/art/city-scene-feudal-stone.webp`：使用 imagegen 編輯本作原有 `city-scene-stone.png`，保留山景、地塊與道路，把遠方垛牆改為低矮平頂石牆與簡單城門，作為封建時代外觀。原城堡垛牆、黑暗木牆保持。生成 1536×1024，再轉 WebP；未複製其他遊戲截圖。

## v0.9.0 軍事與科技圖鑑

新增 catalog-units.webp、catalog-guards.webp、catalog-technologies.webp；各為原創 1536×1024、3×2 圖集，由 OpenAI imagegen 生成。共用兵依民兵、槍兵、弓兵、騎兵、攻城器、斥候排列；衛隊依中國、拜占庭、法蘭克、不列顛、日本、蒙古；科技依輪作、木工、鍛造、補給、灌溉、鍛鋼。原始 PNG 轉 WebP（quality 90），未使用第三方遊戲素材。卡片與詳情浮窗共用相同圖集。
