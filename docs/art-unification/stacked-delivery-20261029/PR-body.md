兩輪玩家回饋修正了法蘭克精銳的肢體／持斧方式、輕騎兵槍向與普通騎士配色，以及三文明舊時代城郊城市底座高於前牆的問題。法蘭克現在右手單持一把適合單手的雙面斧、左手持藍金盾；城市圖下移到牆內地面。中國、日本另提供各三套不同甲冑候選，正式映射仍維持現行修正版，等待玩家選擇。

此PR是 **stacked Draft**：Base=`feat/art-unification-20261028`，Head=`feat/art-player-feedback-20261029`，依賴 #44。不要改成main後直接合併，也不要先刪除原功能分支。

## 範圍及提交

保留既有 `8736bad811a7c372c59881b143e4c75bd659c5af`、`bbdf779a1bbcdce0d1b97c43dbdd9a552818960b`、`c24862d3db8c0657ac1da88d0cf3d27a586cac05` 完整祖先鏈，另有堆疊交付文件／release note提交。沒有重生圖片。

- 第一輪：中日現行精銳防護、法蘭克精銳、輕騎兵槍向、騎士配色、英日蒙前三時代城郊接地及全部來源／圖板／報告。
- 第二輪：法蘭克單手雙面斧與持盾正式修正；中日各A／B／C候選、128／64px與手機／桌面、肢體檢查。
- 保留重甲騎兵、帝王城郊、世界地圖110%、共用建築、全部科技、v95、ID、玩法及存檔。

原Base的release note保持完全相同；本PR僅新增一個玩家回饋note，避免堆疊CI將Base既有note視為不可變更紀錄而失敗。

## 審圖

- [中國普通／A／B／C](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/feat/art-player-feedback-20261029/docs/art-unification/elite-review-20261029/boards/中國-ABCs.webp)：推薦B魚鱗，但仍待選。
- [日本普通／A／B／C](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/feat/art-player-feedback-20261029/docs/art-unification/elite-review-20261029/boards/日本-ABCs.webp)：推薦C具足，但仍待選。
- [法蘭克普通／舊精銳／單手版](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/feat/art-player-feedback-20261029/docs/art-unification/elite-review-20261029/boards/frankia-before-after.webp)及[手部／盾牌／斧頭](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/feat/art-player-feedback-20261029/docs/art-unification/elite-review-20261029/boards/frankia-anatomy.webp)。左掌部分被盾遮擋；自評未見第三肢體／重複武器，不等於玩家簽核。
- [第一輪報告](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/feat/art-player-feedback-20261029/docs/art-unification/player-feedback-20261029/REPORT.md)／[第二輪報告](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/feat/art-player-feedback-20261029/docs/art-unification/elite-review-20261029/REPORT.md)。

## 驗證

雲端既有實作：Typecheck／Build PASS；完整隔離回歸2102 PASS、0 FAIL、1 SKIP；正式ArmyView27案例、候選48卡面，前輪城郊288案例。新增堆疊release note與本文已校驗。GitHub CI必須以本PR真正執行結果為準，不引用舊PR綠燈。

中日候選選定、獨立美術／肢體複審及實體手機待驗；保留歷史legacy art失敗、B5 E1 HOLD、Astra Gate非PASS。此PR維持Draft，不合併、不部署。

未來順序：先驗收／合併#44，再將此PR Base改成main、確認差異只有玩家回饋修正、玩家選定中日卡、重新CI及必要手機測試；通過並另獲核准後才合併。

## 玩家更新摘要

<!-- release-notes:start -->
```json
{
  "title": "玩家回饋：精銳衛隊與城郊接地修正",
  "notes": [
    "中國與日本精銳衛隊增加肩胸與肢體防護，保留各自的連弩與武士裝備特色。",
    "法蘭克精銳改為右手單持雙面斧、左手持藍金鳶尾花盾，修正多餘肢體與持握問題。",
    "輕騎兵的單一槍桿與槍尖朝前，普通騎士改採低飽和紅白鐵灰配色。",
    "不列顛、日本、蒙古前三時代有城牆的城郊城市調整接地位置，前牆自然遮擋底部。"
  ]
}
```
<!-- release-notes:end -->
