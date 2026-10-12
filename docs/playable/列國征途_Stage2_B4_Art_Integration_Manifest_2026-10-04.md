# 列國征途 Stage 2 B4 Art Integration Manifest

日期：2026-10-04｜v0.30.8｜FormalID不變，僅美術別名與presentation。

此表列正式需求對應。已接線不等於瀏覽器／手機實機已驗收；人工Smoke待玩家。`source path`相對source根目錄時加`public/`。建築多時代atlas的實體尺寸列附表；新檔512×512透明，PNG來源保留於docs。

| Formal ID | presentation asset | source path（public/） | reused / new / derived | dimensions | background | adapter | fallback | Playable status |
|---|---|---|---|---|---|---|---|---|
| civ_zhongguo | civ_zhongguo | art/civilization-emblems-023.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | CIV_ART／civilizationIndex | 未知正式ID拒絕；不fallback中國 | 已接線；待玩家Smoke |
| civ_byzantium | civ_byzantion | art/civilization-emblems-023.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | CIV_ART／civilizationIndex | 未知正式ID拒絕；不fallback中國 | 已接線；待玩家Smoke |
| civ_frankia | civ_frankia | art/civilization-emblems-023.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | CIV_ART／civilizationIndex | 未知正式ID拒絕；不fallback中國 | 已接線；待玩家Smoke |
| civ_britannia | civ_britannia | art/civilization-emblems-023.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | CIV_ART／civilizationIndex | 未知正式ID拒絕；不fallback中國 | 已接線；待玩家Smoke |
| civ_japan | civ_japan | art/civilization-emblems-023.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | CIV_ART／civilizationIndex | 未知正式ID拒絕；不fallback中國 | 已接線；待玩家Smoke |
| civ_mongolia | civ_mongol | art/civilization-emblems-023.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | CIV_ART／civilizationIndex | 未知正式ID拒絕；不fallback中國 | 已接線；待玩家Smoke |
| center | hall | art/buildings-dark.webp \| art/buildings-feudal.webp \| art/building-atlas.webp | reused | 動態展開，見附表 | SVG／atlas裁片，見實體表 | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| residence | house | art/buildings-dark.webp \| art/buildings-feudal.webp \| art/building-atlas.webp | reused | 動態展開，見附表 | SVG／atlas裁片，見實體表 | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| warehouse | warehouse | art/buildings-dark.webp \| art/buildings-feudal.webp \| art/building-atlas.webp | reused | 動態展開，見附表 | SVG／atlas裁片，見實體表 | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| bunker | cellar | art/cellar.webp | reused | 1254×1254 | SVG／atlas裁片，見實體表 | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| market | market | art/buildings-dark.webp \| art/buildings-feudal.webp \| art/building-atlas.webp | reused | 動態展開，見附表 | SVG／atlas裁片，見實體表 | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| townhall | 市政廳 | art/formal/building-townhall.webp | new | 512×512 | 透明alpha | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| monastery | 修道院 | art/formal/building-monastery.webp | new | 512×512 | 透明alpha | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| mill | 磨坊 | art/formal/building-mill.webp | new | 512×512 | 透明alpha | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| lumbermill | 鋸木場 | art/formal/building-lumbermill.webp | new | 512×512 | 透明alpha | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| masonry | 石匠工坊 | art/formal/building-masonry.webp | new | 512×512 | 透明alpha | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| mint | 鑄幣所 | art/formal/building-mint.webp | new | 512×512 | 透明alpha | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| barracks | barracks | art/buildings-dark.webp \| art/buildings-feudal.webp \| art/building-atlas.webp | reused | 動態展開，見附表 | SVG／atlas裁片，見實體表 | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| archery | range | art/buildings-dark.webp \| art/buildings-feudal.webp \| art/building-atlas.webp | reused | 動態展開，見附表 | SVG／atlas裁片，見實體表 | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| stable | stable | art/buildings-dark.webp \| art/buildings-feudal.webp \| art/building-atlas.webp | reused | 動態展開，見附表 | SVG／atlas裁片，見實體表 | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| blacksmith | 鐵匠鋪 | art/formal/building-blacksmith.webp | new | 512×512 | 透明alpha | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| academy | academy | art/buildings-dark.webp \| art/buildings-feudal.webp \| art/building-atlas.webp | reused | 動態展開，見附表 | SVG／atlas裁片，見實體表 | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| workshop | workshop | art/buildings-dark.webp \| art/buildings-feudal.webp \| art/building-atlas.webp | reused | 動態展開，見附表 | SVG／atlas裁片，見實體表 | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| castle | castle | art/castle-{civilizationAlias}.webp | reused | 動態展開，見附表 | SVG／atlas裁片，見實體表 | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| embassy | 大使館 | art/formal/building-embassy.webp | new | 512×512 | 透明alpha | cityPresentation→FormalBuildingSprite | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| field.food | farm | art/field-farm.webp | reused | 1254×1254 | SVG／atlas裁片，見實體表 | fields[slot]→18 anchors；Lv0～15文字 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| field.wood | lumber | art/field-lumber.webp | reused | 1254×1254 | SVG／atlas裁片，見實體表 | fields[slot]→18 anchors；Lv0～15文字 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| field.stone | quarry | art/field-quarry.webp | reused | 1254×1254 | SVG／atlas裁片，見實體表 | fields[slot]→18 anchors；Lv0～15文字 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| field.gold | mine | art/field-mine.webp | reused | 1254×1254 | SVG／atlas裁片，見實體表 | fields[slot]→18 anchors；Lv0～15文字 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| wildsite.food | crop 0 | art/world-resources.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | SITE_INDEX→Lv1～10文字 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| wildsite.wood | crop 1 | art/world-resources.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | SITE_INDEX→Lv1～10文字 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| wildsite.stone | crop 2 | art/world-resources.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | SITE_INDEX→Lv1～10文字 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| wildsite.gold | crop 3 | art/world-resources.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | SITE_INDEX→Lv1～10文字 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| wildsite.bandit | crop 6 | art/world-resources.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | SITE_INDEX→Lv1～10文字 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| terrain.land | land | art/world-terrain-023.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | Formal terrain→renderer | 素材尚未載入時terrain底色 | 已接線；待玩家Smoke |
| terrain.forest | forest | art/world-trees-0299.webp | reused | 1254×1254 | SVG／atlas裁片，見實體表 | Formal terrain→renderer | 素材尚未載入時terrain底色 | 已接線；待玩家Smoke |
| terrain.river | river | art/world-riverbanks-0301.webp | reused | 210×12 | SVG／atlas裁片，見實體表 | Formal terrain→renderer | 素材尚未載入時terrain底色 | 已接線；待玩家Smoke |
| terrain.water | water | art/world-water-029.webp | reused | 512×512 | SVG／atlas裁片，見實體表 | Formal terrain→renderer | 素材尚未載入時terrain底色 | 已接線；待玩家Smoke |
| terrain.mountain | mountain | art/world-mountains-0299.webp | reused | 1254×1254 | SVG／atlas裁片，見實體表 | Formal terrain→renderer | 素材尚未載入時terrain底色 | 已接線；待玩家Smoke |
| militia | units crop 0 | art/catalog-units.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| spearman | units crop 1 | art/catalog-units.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| archer | units crop 2 | art/catalog-units.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| skirmisher | 母圖 | art/formal/unit-skirmisher.webp | new | 512×512 | 透明alpha | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| scout | units crop 5 | art/catalog-units.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| light-cavalry | units crop 3＋輕騎 | art/catalog-units.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| knight | units crop 3＋騎士 | art/catalog-units.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| ram | units crop 4 | art/catalog-units.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| catapult | 母圖 | art/formal/unit-catapult.webp | new | 512×512 | 透明alpha | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| baggage | technologies crop 3＋輜重 | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| guard.civ_zhongguo | guards crop 0 | art/catalog-guards.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| guard.civ_byzantium | guards crop 1 | art/catalog-guards.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| guard.civ_frankia | guards crop 2 | art/catalog-guards.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| guard.civ_britannia | guards crop 3 | art/catalog-guards.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| guard.civ_japan | guards crop 4 | art/catalog-guards.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| guard.civ_mongolia | guards crop 5 | art/catalog-guards.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| swordsman | units crop 0＋ELITE | art/catalog-units.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| pikeman | units crop 1＋ELITE | art/catalog-units.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| crossbowman | units crop 2＋ELITE | art/catalog-units.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| heavy-skirmisher | 母圖＋ELITE | art/formal/unit-skirmisher.webp | derived | 512×512 | 透明alpha | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| ranger | units crop 3＋ELITE · 輕騎 | art/catalog-units.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| heavy-knight | units crop 3＋ELITE · 騎士 | art/catalog-units.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| elite.guard.civ_zhongguo | guards crop 0＋ELITE | art/catalog-guards.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| elite.guard.civ_byzantium | guards crop 1＋ELITE | art/catalog-guards.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| elite.guard.civ_frankia | guards crop 2＋ELITE | art/catalog-guards.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| elite.guard.civ_britannia | guards crop 3＋ELITE | art/catalog-guards.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| elite.guard.civ_japan | guards crop 4＋ELITE | art/catalog-guards.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| elite.guard.civ_mongolia | guards crop 5＋ELITE | art/catalog-guards.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | unitArt→Art／徵兵 | SVG research icon＋正式兵名 | 已接線；待玩家Smoke |
| blacksmith.melee.1 | 近戰武器 I＋I | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| blacksmith.ranged.1 | 遠程武器 I＋I | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| blacksmith.infantry-armor.1 | 步兵護具 I＋I | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| blacksmith.ranged-armor.1 | 遠程護具 I＋I | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| blacksmith.cavalry-armor.1 | 騎兵護具 I＋I | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| blacksmith.melee.2 | 近戰武器 II＋II | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| blacksmith.ranged.2 | 遠程武器 II＋II | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| blacksmith.infantry-armor.2 | 步兵護具 II＋II | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| blacksmith.ranged-armor.2 | 遠程護具 II＋II | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| blacksmith.cavalry-armor.2 | 騎兵護具 II＋II | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| blacksmith.melee.3 | 近戰武器 III＋III | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| blacksmith.ranged.3 | 遠程武器 III＋III | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| blacksmith.infantry-armor.3 | 步兵護具 III＋III | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| blacksmith.ranged-armor.3 | 遠程護具 III＋III | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| blacksmith.cavalry-armor.3 | 騎兵護具 III＋III | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| economy.food.1 | 農業 I＋I | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| economy.wood.1 | 林業 I＋I | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| economy.stone.1 | 採石 I＋I | art/formal/tech-engineering.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| economy.gold.1 | 採礦 I＋I | art/formal/tech-administration.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| economy.food.2 | 農業 II＋II | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| economy.wood.2 | 林業 II＋II | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| economy.stone.2 | 採石 II＋II | art/formal/tech-engineering.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| economy.gold.2 | 採礦 II＋II | art/formal/tech-administration.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| economy.food.3 | 農業 III＋III | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| economy.wood.3 | 林業 III＋III | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| economy.stone.3 | 採石 III＋III | art/formal/tech-engineering.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| economy.gold.3 | 採礦 III＋III | art/formal/tech-administration.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| intel.watch | 城鎮警戒 | art/formal/tech-intel.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| intel.patrol | 巡邏制度 | art/formal/tech-intel.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| intel.analysis | 軍情研判 | art/formal/tech-intel.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| intel.network | 戰場情報網 | art/formal/tech-intel.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| military.drill | 軍事操典 | art/formal/tech-drill.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| military.horsemanship | 馬術訓練 | art/formal/tech-horse.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| military.breeding | 馬匹育種 | art/formal/tech-horse.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| military.conscription | 徵兵制度 | art/formal/tech-conscription.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| logistics.transport | 運輸組織 | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| logistics.auto | 商路管理 | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| logistics.dispatch | 車隊調度 | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| logistics.baggage | 輜重標準化 | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| logistics.rations | 軍糧配給 | art/catalog-technologies.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| engineering.masonry | 石造工程 | art/formal/tech-engineering.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| engineering.architecture | 建築學 | art/formal/tech-engineering.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| siege.ram.1 | 破城工程 I＋I | art/formal/tech-siege.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| siege.projection.1 | 投射工程 I＋I | art/formal/tech-siege.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| siege.frame.1 | 強化機架 I＋I | art/formal/tech-siege.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| siege.ram.2 | 破城工程 II＋II | art/formal/tech-siege.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| siege.projection.2 | 投射工程 II＋II | art/formal/tech-siege.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| siege.frame.2 | 強化機架 II＋II | art/formal/tech-siege.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| administration.coordination | 行政統籌 | art/formal/tech-administration.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| administration.register | 領地帳冊 | art/formal/tech-administration.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| elite.infantry | 步兵精銳化＋ELITE | art/formal/tech-elite.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| elite.ranged | 遠程精銳化＋ELITE | art/formal/tech-elite.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| elite.cavalry | 騎兵精銳化＋ELITE | art/formal/tech-elite.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| elite.guard | 文明衛隊精銳化＋ELITE | art/formal/tech-elite.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| civilization.kaogong | 考工制度＋文明徽記 | art/formal/tech-administration.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| civilization.crossbow | 連弩操典＋文明徽記 | art/formal/tech-drill.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| civilization.themes | 軍區制度＋文明徽記 | art/formal/tech-administration.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| civilization.imperial-wall | 帝都城防＋文明徽記 | art/formal/tech-administration.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| civilization.knighthood | 騎士制度＋文明徽記 | art/formal/tech-horse.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| civilization.charge | 重騎衝鋒＋文明徽記 | art/formal/tech-horse.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| civilization.archer-levy | 郡民弓役＋文明徽記 | art/formal/tech-drill.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| civilization.warwolf | 戰狼投石＋文明徽記 | art/formal/tech-siege.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| civilization.mobilization | 武家動員＋文明徽記 | art/formal/tech-conscription.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| civilization.sling | 投石術＋文明徽記 | art/formal/tech-drill.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| civilization.nomadic | 遊牧補給＋文明徽記 | art/formal/tech-horse.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| civilization.swift-siege | 疾行攻城＋文明徽記 | art/formal/tech-siege.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| research.cooperation | 科研協同體系 | art/formal/tech-cooperation.svg | derived | 160×160 | SVG／atlas裁片，見實體表 | techArt→Art／科研 | SVG research icon＋正式科技名 | 已接線；待玩家Smoke |
| age.Dark | visualAge 0 | art/cities-age-0.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | visualAge→城市／scene／wall | 無age3請求 | 已接線；待玩家Smoke |
| age.Feudal | visualAge 1 | art/cities-age-1.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | visualAge→城市／scene／wall | 無age3請求 | 已接線；待玩家Smoke |
| age.Castle | visualAge 2 | art/cities-age-2.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | visualAge→城市／scene／wall | 無age3請求 | 已接線；待玩家Smoke |
| age.Imperial | visualAge 2＋帝王badge | art/cities-age-2.webp | derived | 1536×1024 | SVG／atlas裁片，見實體表 | visualAge→城市／scene／wall | 無age3請求 | 已接線；待玩家Smoke |
| town.scene | town.scene | art/city-scene-dark-open.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | TownScene composition／16 anchors | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| outskirts.scene | outskirts.scene | art/outskirts-landscape-021.webp | reused | 1536×1024 | SVG／atlas裁片，見實體表 | OutskirtsScene composition／18 anchors | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| city.wall | city.wall | art/wall-ring-2.webp | reused | 1254×1254 | SVG／atlas裁片，見實體表 | wallLevel0隱藏；>0映射visualAge | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| world.details | world.details | art/world-details-0299.webp | reused | 1254×1254 | SVG／atlas裁片，見實體表 | sceneryAtlas／深度圖層 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| brand | brand | icons/lieguo-crimson-lion.png | reused | 512×512 | SVG／atlas裁片，見實體表 | BrandMark | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.population | population | art/formal/icon-population.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.housing | housing | art/formal/icon-housing.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.food | food | art/formal/icon-food.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.wood | wood | art/formal/icon-wood.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.stone | stone | art/formal/icon-stone.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.gold | gold | art/formal/icon-gold.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.construction | construction | art/formal/icon-construction.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.slot | slot | art/formal/icon-slot.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.caravan | caravan | art/formal/icon-caravan.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.baggage | baggage | art/formal/icon-baggage.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 素材已備；相關badge／marker現以文字或Canvas顯示 |
| ui.reservation | reservation | art/formal/icon-reservation.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 素材已備；相關badge／marker現以文字或Canvas顯示 |
| ui.research | research | art/formal/icon-research.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.funding | funding | art/formal/icon-funding.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.queue | queue | art/formal/icon-queue.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 素材已備；相關badge／marker現以文字或Canvas顯示 |
| ui.military | military | art/formal/icon-military.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.elite | elite | art/formal/icon-elite.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 素材已備；相關badge／marker現以文字或Canvas顯示 |
| ui.age | age | art/formal/icon-age.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.milestone | milestone | art/formal/icon-milestone.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.city | city | art/formal/icon-city.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.integration | integration | art/formal/icon-integration.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.settlement | settlement | art/formal/icon-settlement.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.escort | escort | art/formal/icon-escort.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 素材已備；相關badge／marker現以文字或Canvas顯示 |
| ui.journey | journey | art/formal/icon-journey.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.capacity | capacity | art/formal/icon-capacity.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 已接線；待玩家Smoke |
| ui.level | level | art/formal/icon-level.svg | new | 64×64 | SVG／atlas裁片，見實體表 | Icon／badge系統 | 路徑預先驗證；失敗顯示文字識別 | 素材已備；相關badge／marker現以文字或Canvas顯示 |

## 實體檔附表

保留DEMO123檔中有些屬B5+或舊候選，此表只標示保留及實際role，不把未接玩法誤列PASS。原路徑123檔SHA相同；新增SVG包括預備icon。

| public path | origin | dimensions | format / background | SHA-256 |
|---|---|---|---|---|
| art/building-atlas.webp | reused | 1402×1122 | .webp／alpha | `25a588555e148a0ef9ea6303628af05ba3074633247bf7b391c7a185d308dff9` |
| art/buildings-dark.webp | reused | 1536×1024 | .webp／alpha | `50f203a7e1f82eca61466c394308ba7598afe61722898441d60d384488ddcbc9` |
| art/buildings-feudal.webp | reused | 1536×1024 | .webp／alpha | `47a6d1ab04dac467ab1d6da18fec45820adc147229ef894a65f025654486fc3b` |
| art/castle-civ_britannia.webp | reused | 1254×1254 | .webp／alpha | `9677c724f20f9c2b873661d2e6bd8f18d0c8d16c7fe16b3d5dc90954d64382d7` |
| art/castle-civ_byzantion.webp | reused | 1254×1254 | .webp／alpha | `7d3cbfb044e42b1d98b015f06de356b082f41892698a84b775a38db4fba21371` |
| art/castle-civ_frankia.webp | reused | 1254×1254 | .webp／alpha | `e050b5c8e103ef75bec30a46668d5de355365de012885330cf2803e54e729aa3` |
| art/castle-civ_japan.webp | reused | 1254×1254 | .webp／alpha | `73ffe111174e834f09ac28634415a46ccf89764bbccf6e9c3313a125cf4e3498` |
| art/castle-civ_mongol.webp | reused | 1254×1254 | .webp／alpha | `c2db9ec07675b7b80b053c447cb7018cd72cc14b8324650f3195af8a157816a5` |
| art/castle-civ_zhongguo.webp | reused | 1254×1254 | .webp／alpha | `d596ae927adce35631ec2dc9bbad6ac339f8d120a883dc580ff811313adc31e0` |
| art/catalog-guards.webp | reused | 1536×1024 | .webp／opaque | `22a6b4442bd65ef24e6376a5e9fa666aba61a79fb27376342bb8c6813a30f6ef` |
| art/catalog-technologies.webp | reused | 1536×1024 | .webp／opaque | `ce1556c17c73483ede7a0ddcc16207938e7ec790bb4b547a23421f5a9d6f67f3` |
| art/catalog-units.webp | reused | 1536×1024 | .webp／opaque | `261e4d9dba26a25bc61d8ceb20395b99f572c617022049bdc84b22b983deb832` |
| art/cellar.webp | reused | 1254×1254 | .webp／alpha | `c2ab581d315f3a4a283857d46f7f88daddf6062c0550780690cb881f2286eac4` |
| art/cities-age-0.webp | reused | 1536×1024 | .webp／alpha | `7af3e5bd0ca282ce344e6d717ec1cff3044f57a8465fc5d0ef8ca67cec1ef648` |
| art/cities-age-1.webp | reused | 1536×1024 | .webp／alpha | `06b08ea92ab59c99e5ea9d0726c61f139e469fcb3edc88be37ed23dddf9e24e8` |
| art/cities-age-2.webp | reused | 1536×1024 | .webp／alpha | `da45066de81845ffeda9cb0ce07aa2fde20bfecd426b65622f694055a021478b` |
| art/city-scene-castle-construction-v2.webp | reused | 1536×1024 | .webp／opaque | `97b3f75b9b4861837202e279d6cb5ac7d982567bb9e74fb71a8a58cfa6b171e3` |
| art/city-scene-dark-construction-v2.webp | reused | 1536×1024 | .webp／opaque | `16cd520551c8a9552cbea9e56a5b9e7692556b47148dfd75b579b10eb65ed98c` |
| art/city-scene-dark-open.webp | reused | 1536×1024 | .webp／opaque | `24ac42172178ac9e69ec7c37aa45bf8735ad29ed1c88033cd5825151d922fef8` |
| art/city-scene-dark-wood.webp | reused | 1536×1024 | .webp／opaque | `58223d34d696c02942bd733601bb2feed7bb257373fde7df0bbc7798ac0d2fa2` |
| art/city-scene-feudal-construction-v2.webp | reused | 1536×1024 | .webp／opaque | `69a8f8e10e8cead7a2c065ed576a32e99c4494ec52a00e74ed67e4202a20b5c9` |
| art/city-scene-feudal-open.webp | reused | 1536×1024 | .webp／opaque | `d8ed91fab62ba13b9abcd33f2d068426e98c9a20028181817b86c9a358d17ba3` |
| art/city-scene-feudal-stone.webp | reused | 1536×1024 | .webp／opaque | `7f15788059c4909f463c20ef7c77c22f47d4c9cbb0019b07af593583b3ce8a90` |
| art/city-scene-feudal-wood.webp | reused | 1536×1024 | .webp／opaque | `0e644d52c8299d88b20035c6639fda33ee62bb370dac91f42b439d48772fa0e8` |
| art/city-scene-open.webp | reused | 1536×1024 | .webp／opaque | `fa2142bc0f0d2350867031e76bb54c2fba4805e28b704c8fa07f9f669a21eb91` |
| art/city-scene-stone.png | reused | 1536×1024 | .png／opaque | `7b6928612602ab6141bbceffd81e7ecd5331984037b838f05ed5540526543693` |
| art/city-scene-stone.webp | reused | 1536×1024 | .webp／opaque | `b0aeee3ba47ba345e2cbadc34e01eee4a38cb3a66a64bcdd20b50ce2782efd5b` |
| art/city-scene-wood.webp | reused | 1536×1024 | .webp／opaque | `d64561f7b16806eaadeb7dd34a81ca9e5d5a4bfe5cda175be76a825d9fbce556` |
| art/civilization-emblems-023.webp | reused | 1536×1024 | .webp／alpha | `74f6b3f6e0d754dfbf8f87e0444a96f40b67d288bea9c2b0d04735b92a32bbbc` |
| art/construction-academy-castle.webp | reused | 846×768 | .webp／alpha | `6dbf16d34a63afb14881900a38e94146b54e33a06b19cdcd83767264ed204d39` |
| art/construction-academy-feudal.webp | reused | 815×680 | .webp／alpha | `ea4aa0eba3d82283f9731b0f7a6419ce0d27c869aab86e2141a7e0fdd5e8e29d` |
| art/construction-academy.webp | reused | 1536×1024 | .webp／alpha | `481b0a375cd8e7b41a94efe2fa67af757db831aac01768f2def34cc374cade6b` |
| art/construction-barracks-castle.webp | reused | 707×680 | .webp／alpha | `da01e8e9ab9399dfaf1678fb1832cebbc7970202dc42367a5cf7d3ed48b238a1` |
| art/construction-barracks-feudal.webp | reused | 819×680 | .webp／alpha | `3397f8d303189547f1755de0e4bb048390f1dbe0b118ba97b3462b6e7eae2af3` |
| art/construction-barracks.webp | reused | 1536×1024 | .webp／alpha | `7a2c10a3678727556cb998f9b2674305d56df289ca8984acb989466760874a27` |
| art/construction-castle-civ_britannia.webp | reused | 1254×1254 | .webp／alpha | `434f746b357587852a2a632a9021a9672cbae63f9193affb8305f446e4503aef` |
| art/construction-castle-civ_byzantion.webp | reused | 1254×1254 | .webp／alpha | `f87795363df36be8e1a3f34ffe631dbe1f7e1176c61484baa4a6cf69f1a82fde` |
| art/construction-castle-civ_frankia.webp | reused | 1254×1254 | .webp／alpha | `0081875a2d470efbe136042063be5462e22ce025ff6d58d7b27c85de1ff005a1` |
| art/construction-castle-civ_japan.webp | reused | 1254×1254 | .webp／alpha | `e62a4e6e154627474c222f13ba55d6b2745596043d99e25c8e87e4a7efc27650` |
| art/construction-castle-civ_mongol.webp | reused | 1254×1254 | .webp／alpha | `86c1edbe77ee4f3e6c8c1f6b84a8e9e055c2aabb4930c6d10c118f4de3ca39de` |
| art/construction-castle-civ_zhongguo.webp | reused | 1254×1254 | .webp／alpha | `ada71d9dd96e8c89edc99f4e75c2e2c7a2b68c10d1fab89468a53dd7e2164ebe` |
| art/construction-castle.webp | reused | 1254×1254 | .webp／alpha | `ada71d9dd96e8c89edc99f4e75c2e2c7a2b68c10d1fab89468a53dd7e2164ebe` |
| art/construction-cellar.webp | reused | 1254×1254 | .webp／alpha | `ad15cdc5a34ff4cfd1a7672472c9defbc1fd02f1f24bc2c2d57f93e44e14e7be` |
| art/construction-farm-castle.webp | reused | 699×680 | .webp／alpha | `4d83fb05f0e164973caeabe1f1ebf6ae183af93019fe41b75a97608bfd17ad28` |
| art/construction-farm-feudal.webp | reused | 815×680 | .webp／alpha | `0419a304953684f88cb59a29f8cb6b7a981e684e57e5f491705d68766ac44042` |
| art/construction-farm.webp | reused | 1254×1254 | .webp／alpha | `180dd9289cf794fbe2582202278c18cb1325a7d831b3d29ee1f5056888bca387` |
| art/construction-hall-civ_britannia-dark.webp | reused | 819×680 | .webp／alpha | `481caed5c7d2d4b206016aa114abf8c75e1baf5368e44a10379f6916a46ce3e2` |
| art/construction-hall-civ_britannia-feudal.webp | reused | 819×680 | .webp／alpha | `70ac8b9a1fad62dd6058cf6e58e16c37a1a3309af841584818b6d23006d2677d` |
| art/construction-hall-civ_britannia.webp | reused | 1403×1121 | .webp／alpha | `cc0eba424b51faf55eca2bd6b822cd5ee6b28d5bacdd1cb4a2b7342550821f7b` |
| art/construction-hall-civ_byzantion-dark.webp | reused | 815×680 | .webp／alpha | `8bec4d9aec77a826700ae8e2ae3c0bf608d418146d430179c4ccaa5b3585277b` |
| art/construction-hall-civ_byzantion-feudal.webp | reused | 815×680 | .webp／alpha | `224eae4ee8e4f5f2b4d98094532bcbd997e4bbb3215315e51d2f194032b063b2` |
| art/construction-hall-civ_byzantion.webp | reused | 1373×1145 | .webp／alpha | `146ab6181d2df9c9bbe7cdba5c67aedcf3f54a29d3a1ff9c5d3e40b35cf386b2` |
| art/construction-hall-civ_frankia-dark.webp | reused | 900×600 | .webp／alpha | `85544b87bfb5939291e1fa4aa94dc5866681a934614a82633a3c0f87fabb27b6` |
| art/construction-hall-civ_frankia-feudal.webp | reused | 815×680 | .webp／alpha | `ba7718892e3076961eb4997730bad4320e5011aece3cc567021519031cfdf2da` |
| art/construction-hall-civ_frankia.webp | reused | 1308×1203 | .webp／alpha | `ac58231a4555c548151960349cdc0af8c9dba2801d8a19c60532a8467f3816f1` |
| art/construction-hall-civ_japan-dark.webp | reused | 815×680 | .webp／alpha | `e997876c1d830a5f6007b30e29ee697c6a507e7cbcfe1a478c7d62d74d5a8ddf` |
| art/construction-hall-civ_japan-feudal.webp | reused | 815×680 | .webp／alpha | `e4dbde4f09c743f7dabb5945f3a8496c33d55377cd3eb91d9132eda590a619e2` |
| art/construction-hall-civ_japan.webp | reused | 1313×1198 | .webp／alpha | `3839480d354a575d838f880756e911e1e149457ef73484ce71f6ab3c67c2513f` |
| art/construction-hall-civ_mongol-dark.webp | reused | 815×680 | .webp／alpha | `1f9b9534f14f8d244cbf9328437afc8c2029a429e61fddd70424714a5185d0aa` |
| art/construction-hall-civ_mongol-feudal.webp | reused | 815×680 | .webp／alpha | `382ff004e261aefe9a6e5ef91bfed5f648d8eaf0da6e3cbd2d8a3af14a4841c9` |
| art/construction-hall-civ_mongol.webp | reused | 1410×1116 | .webp／alpha | `c795277350ec99158fe8aae7ddf24030651bee15d7e113397f0f54a8c03308d6` |
| art/construction-hall-civ_zhongguo-dark.webp | reused | 815×680 | .webp／alpha | `520b807051df43d0632359d59b2d311ca2ca13ff5ed9106f35380f916b8b9b3f` |
| art/construction-hall-civ_zhongguo-feudal.webp | reused | 815×680 | .webp／alpha | `6ad62ea2c45e4b498fe3d6ea83ee5dbb21b7b28bc5cb88125db74162ebc06304` |
| art/construction-hall-civ_zhongguo.webp | reused | 1373×1145 | .webp／alpha | `7c4a273e3ba838e57a302bd669b420ff7d7189411de2115062465d172ef87853` |
| art/construction-hall.webp | reused | 1536×1024 | .webp／alpha | `a2e2a0e92839c8089958dadf7ae55caefeb2b8bb1e637b8962f72e131e608e20` |
| art/construction-house-castle.webp | reused | 724×680 | .webp／alpha | `192673e417d858d409715d7f39f270710e742be2ad76ce5408eadf4c3af5909c` |
| art/construction-house.webp | reused | 1536×1024 | .webp／alpha | `7bcbd8bc4cacb507f9aca8face0320dea7a1d6e4519010dc4ec64162e2cdec3f` |
| art/construction-lumber-castle.webp | reused | 742×680 | .webp／alpha | `eb8f41a1cddbdfe865192158c8dd08d5a79693fc1e71c232e7bb9d36fb24c2fc` |
| art/construction-lumber-feudal.webp | reused | 819×680 | .webp／alpha | `74413cfaefebbecbc13c0326159bbaea9f0c83a143f9b562c656e57df37b7a7e` |
| art/construction-lumber.webp | reused | 1254×1254 | .webp／alpha | `c4d786cc6832d3705aca672d107d4bfaef89857d9ed9632b68ef28de79938dd2` |
| art/construction-market-castle.webp | reused | 745×680 | .webp／alpha | `d964b4430596bcc03f9c40ad9c8008c93195d49b9e0c6a355f870c0aa54d12de` |
| art/construction-market.webp | reused | 1536×1024 | .webp／alpha | `42e227b45a99d099ab671b383f68eda73a8fccebf5cf488fee03d8edcf17eec2` |
| art/construction-mine.webp | reused | 1254×1254 | .webp／alpha | `bdfe19b219fc52c9e4f962cb33cb1b85b0acdc8f4a6f891ab07fe680addde408` |
| art/construction-quarry.webp | reused | 1254×1254 | .webp／alpha | `71148170b673d1d00cea73362a18f63cdc2eb4b768b302b99f72a7efbc3be9fb` |
| art/construction-range-castle.webp | reused | 703×680 | .webp／alpha | `5305e114d2891a833f1668a499285c7eed0b6910ecb0f390e98e579ebd80640a` |
| art/construction-range.webp | reused | 1536×1024 | .webp／alpha | `8467ea4836af76e698137c146b792bc90d54405e3c2c6d6b8a4d2a3ccd95622b` |
| art/construction-stable-castle.webp | reused | 721×680 | .webp／alpha | `795512af156b56d115776fc336d5bf6601fba04482b1c16a82100f9778a2afc1` |
| art/construction-stable.webp | reused | 1536×1024 | .webp／alpha | `0269a274848042a62a6a15f967f999451647594f771e70d0045636c170e6d7e3` |
| art/construction-wall-stone.webp | reused | 1536×1024 | .webp／alpha | `cfe7c2342e419cb6e431273387af34761eb493b7982629da5847ed545d5b2623` |
| art/construction-wall-wood.webp | reused | 1536×1024 | .webp／alpha | `8c9168b979a5b8b1e4487bec6951235f79b190953b06ed9b004d1b90d86283a7` |
| art/construction-warehouse-castle.webp | reused | 744×680 | .webp／alpha | `fab0716afd210455cf19ee42e9a22ae69aa15e8b120cb4c44ba6d2ca0caefbb5` |
| art/construction-warehouse-dark-v2.webp | reused | 1374×1145 | .webp／alpha | `f134bab368ff8b961019716dc4742884719c0f3bab293ae528b978c09a7b8bb3` |
| art/construction-warehouse-feudal-v2.webp | reused | 1374×1145 | .webp／alpha | `7bb588a43b7989169d19b60d2c7ef0f8f43b1a0c620c21ba7dc06d7fd69f0729` |
| art/construction-warehouse-feudal.webp | reused | 1374×1145 | .webp／alpha | `ed2ff1a29b1e63ccc4d70a8507559a32fe0805041ab6042875d65ce966100c7c` |
| art/construction-warehouse.webp | reused | 1536×1024 | .webp／alpha | `74ecc86f04cb3cab8769e8f093d8a94b4d0a25f6d189f0c56894c6ef2aaec833` |
| art/construction-workshop-castle.webp | reused | 758×680 | .webp／alpha | `b60c04b8df82fecc6f5e397fc46ca709d999fd436f3437b26fe1a5246c9f1a73` |
| art/construction-workshop-feudal.webp | reused | 900×600 | .webp／alpha | `9edde1641b5a35f754f9bf2684239e99ed9f8441bd7229c247fcfcab5384f192` |
| art/construction-workshop.webp | reused | 1536×1024 | .webp／alpha | `a8b4b9d4ce20d5f69eba54d0ecb054e0f2dfcf0479d89dc357339566066d51f0` |
| art/field-farm.webp | reused | 1254×1254 | .webp／alpha | `9a30d050ea3df603e2c01e6761ec29d5fa4844abee0ffdeece43f5d90d8cf5dd` |
| art/field-lumber.webp | reused | 1254×1254 | .webp／alpha | `4deb979df3a5e2c2e2b31b2b0e01b5ccaec4bf06b2c866e299b05b87862e88f7` |
| art/field-mine.webp | reused | 1254×1254 | .webp／alpha | `61f0ab8a89c328baa5c024c81ef76df1fee37e69ee867d10642a01506623a2dc` |
| art/field-quarry.webp | reused | 1254×1254 | .webp／alpha | `d36c2d15eb021135209f52b0602383075c80762f6e44888f2f1592849643b9d0` |
| art/formal/building-blacksmith.webp | new | 512×512 | .webp／alpha | `085cb2e4d6d7741e828a0c45e989727b1c2bbd1321d88e9320fafe0a8218467a` |
| art/formal/building-embassy.webp | new | 512×512 | .webp／alpha | `b26d6a7a89b0e156e7114d2d11caa8d8ba44e8649b2c2f027950d41bb5273f59` |
| art/formal/building-lumbermill.webp | new | 512×512 | .webp／alpha | `551556b3ae57e9e9004e24d43722efe056fd6f0ca5dc79172103b478fe044532` |
| art/formal/building-masonry.webp | new | 512×512 | .webp／alpha | `192b7aabda5302286f98700a93340d725c808ff653d5a70f986b02d536e5bcee` |
| art/formal/building-mill.webp | new | 512×512 | .webp／alpha | `fa1a798ac6063fb023f71482fda94dc60d987eaa0297ea22b228e2a3f62a33f2` |
| art/formal/building-mint.webp | new | 512×512 | .webp／alpha | `05075dafeac51f8ff42af1bd35b2b546420bd5cd8219d075361af3c5b67427e3` |
| art/formal/building-monastery.webp | new | 512×512 | .webp／alpha | `e539f65fd954b95ab4f09ed2d422b99e7bb19646e78aa677d3687c45f78cb9d7` |
| art/formal/building-townhall.webp | new | 512×512 | .webp／alpha | `c4e39187469f6a2b59c9e47690c3d5f5fd959758838a4b557633c246517ab36b` |
| art/formal/icon-administration.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `efc7a862625d62892af83cac41cec8e4937480dff7951a050e3857a7e8b990f5` |
| art/formal/icon-age.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `8c32e29272eca1ce0feac19ec42b6fa6edef1605caf863b6c16777b70a63e230` |
| art/formal/icon-baggage.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `529c12565af3b6b19a58fa2dc2e6e363cd173a102dace88811d609ff78c408fe` |
| art/formal/icon-capacity.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `6c6d414ff6e6acf01d0830113c5d782f7c9e7ccbc86fef0c6c0f0a53bf61d5b7` |
| art/formal/icon-caravan.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `f840f7e818fd8cc55a3665d5aa69d571dc262d40d8666993b568113822a2aadb` |
| art/formal/icon-city.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `fd183f61f673f8e5a4a24ad8a456e70b3e6af41c2d29445e4a0908af75efa7d5` |
| art/formal/icon-conscription.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `38b5e13760705267e8fe598159dcc732e53a603fc0ec3d6d7507c17ca201a38d` |
| art/formal/icon-construction.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `813f53451cf616913723dbbb1d91cbaf006ab5a4fd5240956faca432b85eb02a` |
| art/formal/icon-cooperation.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `f8b67dca756288984d103d203dfbd69c1eb8bf9c6f2095d31e0b3b506130981f` |
| art/formal/icon-drill.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `7dfaadf575743df32908e7f634f7c0dc894efd6f0dc77d08b01612c271142932` |
| art/formal/icon-elite.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `24d6cfce7ad473b271903ad689e6e25b67f7f1aae1490cf5f1eb3c9e217446bc` |
| art/formal/icon-engineering.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `f3be6317d1483b8d6684ffface1902ac21513abdbfa982ce97272d56da8cccfd` |
| art/formal/icon-escort.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `64d722bc3e4889323228a12b5ad11bb813ca2af8d5c1e1403c53ed4f476a0e73` |
| art/formal/icon-food.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `4e6f830f99a353f550723940ae73c38bfecb86477b2bd222390e427e92bd99b5` |
| art/formal/icon-funding.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `33c25eded51b29562869c9ce2e6344a62b70153aeb36c870822ece5a025e2822` |
| art/formal/icon-gold.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `b1a9f1454e8d8b5a2deef3409d245e0a173bb6e8cf3f80d6913a9face4d09577` |
| art/formal/icon-horse.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `48a0175d1d91204c29239c8365723eddf787c40f8f7532821b4ee6214ec7ddc6` |
| art/formal/icon-housing.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `c7f55e78765619c8f0335aec01ff075369e1d38fc991bcb45fde6568a75639f8` |
| art/formal/icon-integration.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `3ba839abc9a1aa22b2e5ee4ea5724402aac07d148f2fb034ff3de6531e20cd37` |
| art/formal/icon-intel.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `5ecc2f0d20e55fb70c42a9e7f3d9c4378e67fbfd10620b26dfd5375bae8eba67` |
| art/formal/icon-journey.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `018992861d4d1088dd0092d8e2158bfd2cf76ae1dd4b6e7886832ee29739e5c9` |
| art/formal/icon-level.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `f167dd7bfdd2af6d9b54410d2e94764ed9250bb9d4e0b9933ab0714499e329f8` |
| art/formal/icon-logistics.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `4ccc9a25a09063809fc1d2b52252a62c4dad54c8b0b92a9eb3a8173143ee59fc` |
| art/formal/icon-milestone.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `b897f118033607ca3d84bf0516c117c9a65b9f888c695da8beb3edea95b14f2e` |
| art/formal/icon-military.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `b7338658e430c116f53babbf80530e4858790c59e5f05db29fa52d5d68e629ca` |
| art/formal/icon-population.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `af3207e4d8a810b62e4065476927f049638d962b517a15995c5159d7b351c530` |
| art/formal/icon-provenance.json | new | — | .json／metadata | `fe84d94fb3e799d215c8d076e3af8fd8a32b3054c813f5dfb2703da452759a8c` |
| art/formal/icon-queue.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `ddc87345c196c96758e65a0c8ff42b03af0c243dd4c9fc588aec46e075d9f5c2` |
| art/formal/icon-research.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `cf8112d355cd525d4375e3d5c6b0a26582146f49af161c4785efd23744a2e8af` |
| art/formal/icon-reservation.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `b671c116c8a7a97eca7952e25bf17f2d5e70d5387ee67c75e4718e06293da9bf` |
| art/formal/icon-settlement.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `b994d280662bcfc7cf2d8e84c7736fb30f6a9e41e2a463a9e1f4479149788024` |
| art/formal/icon-siege.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `70a953236eff42694f832b6d2a7da7b05c20205a1ef24e61a8d42755275df0df` |
| art/formal/icon-slot.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `6cebbb1650b753aa762e0e921e490ea7a74eb8ce0008d46373687ec2d442f042` |
| art/formal/icon-stone.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `2dfa5db696c9eaea12452b600a498efff839cfdd91fac72a762ecac93c56dd70` |
| art/formal/icon-wood.svg | new | 64×64 | .svg／SVG；category母圖帶深綠框／icon透明 | `82259f6a3c5f40a26478f41c4733531e3a7f818375bab3a6ae9c147463a810c6` |
| art/formal/tech-administration.svg | new | 160×160 | .svg／SVG；category母圖帶深綠框／icon透明 | `dd9f3112183420f9aa571379a2f97731c5e0ed7c84aa7f2d1f3486ccdc0a6b5c` |
| art/formal/tech-conscription.svg | new | 160×160 | .svg／SVG；category母圖帶深綠框／icon透明 | `7c5f0c01fcac84d4988ff82d98435224e7b733355b14f8633ed9b4228344dddf` |
| art/formal/tech-cooperation.svg | new | 160×160 | .svg／SVG；category母圖帶深綠框／icon透明 | `f5738739c1f61c9bb623f8562f320cf042437a7ae512a37a1d6c4d6add34ccc0` |
| art/formal/tech-drill.svg | new | 160×160 | .svg／SVG；category母圖帶深綠框／icon透明 | `524160586608ec52a6e1c83ef4940bab89ca2866fd94d8ffcfff464531705117` |
| art/formal/tech-elite.svg | new | 160×160 | .svg／SVG；category母圖帶深綠框／icon透明 | `7b7e27a6788138de9a31372d93eb04d1bb1263c2880d8cd6cd2f725fc2e86003` |
| art/formal/tech-engineering.svg | new | 160×160 | .svg／SVG；category母圖帶深綠框／icon透明 | `9b90557f75d1e8acc9d397332a8ab639208f03d9fee731772a717307bda97af4` |
| art/formal/tech-horse.svg | new | 160×160 | .svg／SVG；category母圖帶深綠框／icon透明 | `ac31c1fccb83947f3e530d71e351dc9a63eff5320b7c9e6bbe3f07f52d8c47fe` |
| art/formal/tech-intel.svg | new | 160×160 | .svg／SVG；category母圖帶深綠框／icon透明 | `bc82c38eae8d74814a8b6d217950f906c695ec77a4f6e792abde648a0022455e` |
| art/formal/tech-logistics.svg | new | 160×160 | .svg／SVG；category母圖帶深綠框／icon透明 | `4c82784acadf39c6221b46749a349128ebd94f6c859f53236bda9d3b5969d568` |
| art/formal/tech-siege.svg | new | 160×160 | .svg／SVG；category母圖帶深綠框／icon透明 | `039b97357091edfc5621d9aaaca55096bb0701b222fc38dd4424d57077e95734` |
| art/formal/unit-catapult.webp | new | 512×512 | .webp／alpha | `889e7ce3b6ce4e7e0a0f0ce4c9aedfbd30f930780ca6798668c1bd913ae7dfc2` |
| art/formal/unit-skirmisher.webp | new | 512×512 | .webp／alpha | `f27dba9354ebe0f8953f3d2d96aff68be1460b59c8b9792831409c3c0862a465` |
| art/outskirts-background.webp | reused | 1536×1024 | .webp／opaque | `854ae6dc423f8d426c99d6bc3b3fcc87da38daf50f7c2cf92dc3b468cc951000` |
| art/outskirts-landscape-021.webp | reused | 1536×1024 | .webp／opaque | `25cc4882c31232397925d4f3a0b55c060feadec8d31aebf699508aab6929baa0` |
| art/protection-dome.webp | reused | 1254×1254 | .webp／alpha | `55f8952c99b46b42e9bd74bb5d2fae5049bbae0d0b959c3e81166ba2945c0d48` |
| art/report-bandit.webp | reused | 1593×700 | .webp／opaque | `4c3688535b2f1d79b0b6239cfa20cf89565f0713149a3ef5499392c866943c84` |
| art/report-defeat.webp | reused | 1600×686 | .webp／opaque | `c338ec3ca0f43998ecab632b4d8b4b34da4f94a2e4983cbe61a088c10ec06144` |
| art/report-food.webp | reused | 1593×700 | .webp／opaque | `83fb86f07f9e461d30a2db8bd26dee3cfcc7481ad6174954722408a5a5d6721e` |
| art/report-gold.webp | reused | 1599×700 | .webp／opaque | `7587b0587214b6eba0a881c17f553f9db75f7b697a22c0a9c0fea947d1c2e211` |
| art/report-stone.webp | reused | 1593×700 | .webp／opaque | `5372e6d32c61318fce82e0c9cb786253d7e3b2e2702ef48a74910d9bc14d530d` |
| art/report-wood.webp | reused | 1593×700 | .webp／opaque | `d25ddb0b618df56a653c5f20561377a821fbc48512c68efec22bf39289c8055e` |
| art/river-city.webp | reused | 1774×887 | .webp／opaque | `7a8697d64a0fe8490086d1c000946906e03bcfb1dc8c5a3ba06c188e5e5f1ed4` |
| art/siege-report.png | reused | 1774×887 | .png／opaque | `2d8f6461a49ad42a87ed0070dc979d16ac30ac4d0cf1bfa533c1df7f849eb523` |
| art/siege-report.webp | reused | 1774×887 | .webp／opaque | `bafcc87c60725e69bc61bcb8b39c83f1dc285a3dbc76f63fbb4d940eb8e81143` |
| art/terrain-base.webp | reused | 1536×1024 | .webp／opaque | `95e24e5c03bc3b2a391d3d162c9f715a7f801b146cc3f4fcf5ff97c0db1ea653` |
| art/town-wall-construction-castle.webp | reused | 1536×118 | .webp／alpha | `a2b2d93a68098faf82b83dc6122093fe4f0248f0bef350adc3cb333a81132e5c` |
| art/town-wall-construction-dark.webp | reused | 1536×118 | .webp／alpha | `cfec8aa567a81d13ecc57a614f03ec9ffb4dadb954a5aaaca40c94e9359c5941` |
| art/town-wall-construction-feudal.webp | reused | 1536×118 | .webp／alpha | `e2b10fa6cb2692d99fb6ff9608d46a5693e79391afea1d03ceda494a535d46b2` |
| art/town-wall-stone.webp | reused | 1536×1024 | .webp／alpha | `636ce0872906aa2ced3f1137868ac744921b8d8ea8d3f80d04bc2857ab0610c0` |
| art/town-wall-wood.webp | reused | 1536×1024 | .webp／alpha | `0db04942ef29e6fe4b30fa547c96d7f467817e97cbf53309ae42291256eb69f4` |
| art/wall-ring-0.webp | reused | 1254×1254 | .webp／alpha | `d0b2864579110bbd5a54b5df5400768d5ff6aa32e5d5362de57fde73ad200bbf` |
| art/wall-ring-1.webp | reused | 1254×1254 | .webp／alpha | `196ccbac24e1b2f1217948f9f31696cf8d5145b565bfedae39a279e9433ed9f3` |
| art/wall-ring-2.webp | reused | 1254×1254 | .webp／alpha | `9b5d740f29f213deee4fc314c27673b489370dfa46ae779ee4644189dacb07e5` |
| art/wall-sections-022.webp | reused | 1536×512 | .webp／alpha | `a4e88a697c8257f13adb38dd8d4056b529901ec760df134eb99b34265798125d` |
| art/world-details-0299.webp | reused | 1254×1254 | .webp／alpha | `8b92705996cea9232d34029a360452b542aaeec0f4604f0f16d281401530bcec` |
| art/world-forest-029.webp | reused | 360×219 | .webp／alpha | `37dadea2d37936a8f38e57ef3a040372cdfcbdb6cbd4fa5a3bd5e101e5a08375` |
| art/world-mountains-029.webp | reused | 720×303 | .webp／alpha | `9f2cc2c63a6ec0984aef244243bdcdacaee1cdf1a0b956bafb0bb88b68cfd74e` |
| art/world-mountains-0299.webp | reused | 1254×1254 | .webp／alpha | `d4aa5807507ac841d91a519fc5b5187fb2266f67374840dfade86405f70bab1d` |
| art/world-resources.webp | reused | 1536×1024 | .webp／alpha | `8f97106e798b5991c274d73aacf23e833fe775b2a7a76b0e3f3cc5074d842d03` |
| art/world-riverbanks-0301.webp | reused | 210×12 | .webp／alpha | `a0cf2ddee470a4bca0c056cc497d26d4c392eec4b8785e679a24aa45179eda70` |
| art/world-terrain-023.webp | reused | 1536×1024 | .webp／opaque | `620de9d2339951fa533d3f692d2db80bf57276787ec08bfd98f467e64c91043a` |
| art/world-trees-0299.webp | reused | 1254×1254 | .webp／alpha | `583d51f72d2f24d5d3c00dd721697e03c97ec505d169781e169515de4dadd09f` |
| art/world-water-029.webp | reused | 512×512 | .webp／opaque | `f2e30df29e3c7ac64b3467470908430c730a13898b75b948be1ed820eda34712` |

## ID／anchor／fallback註記

- center用中央anchor；其餘formal slot0～14一對一使用15個free anchors。repeat identity不合併。
- fields依formal slot0～17一對一，四母圖共用Lv0～15數字；新局6/5/4/3，拓殖城讀正式資料。
- 共圖不合併科技／單位identity。ELITE、I/II/III、文明徽記、Age都是UI覆層。
- Byzantium→byzantion index1；Mongolia→mongol index5；未知文明拒絕而非中國fallback。
- 帝王採visualAge2，沒有age3/ring3路徑。
- renderer圖尚未載入時用正式地形底色；catalog單檔失敗顯示小icon＋正式名字。既有atlas由路徑測試保證，不靜默改identity。
- B5+戰鬥／易主／現代／帝國等保留資產不代表已接玩法。完整Imperial atlas／Elite獨立造型留B10。
