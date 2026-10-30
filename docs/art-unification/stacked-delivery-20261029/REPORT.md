# 玩家回饋堆疊 Draft PR 交付準備

本輪只整理既有成果與交付資料，沒有重新生成／壓縮／替換任何圖片，也沒有改遊戲程式、玩法或候選映射。

- 原 PR #44 保持不變：`feat/art-unification-20261028`，遠端 HEAD `5314e0c6c0b450d3a74f0bb7365b13a831bdbdf5`，Draft=true，merged=false。
- 新本機分支：`feat/art-player-feedback-20261029`，從 `c24862d3db8c0657ac1da88d0cf3d27a586cac05` 建立。
- 預定新 PR 標題：`Art: Player Feedback — Elite Guards & City Fit`。
- 預定 Base：`feat/art-unification-20261028`；不能設 main。新 Draft PR 尚未建立。

## 歷史與差異完整性

已驗證直接祖先鏈：

```
5314e0c6c0b450d3a74f0bb7365b13a831bdbdf5
  └─8736bad811a7c372c59881b143e4c75bd659c5af  第一輪兵種／城郊修正
      └─bbdf779a1bbcdce0d1b97c43dbdd9a552818960b  第二輪候選與法蘭克單手斧
          └─c24862d3db8c0657ac1da88d0cf3d27a586cac05  第二輪交付紀錄
              └─本輪堆疊交付文件與獨立 release note
```

原三個 commit 完整保留，沒有 reset、rebase、squash、force-push 或改寫 SHA。[兩輪363個差異檔案](two-round-files.json)以原 Base 到 c24862d 記錄 Git blob SHA、SHA256、尺寸及提交鏈；既有美術／遊戲成果完全沿用。

第一輪：中國／日本現行精銳防護修正、法蘭克精銳、輕騎兵槍尖朝前、騎士低飽和紅白鐵灰、不列顛／日本／蒙古前三時代有牆城市接地；保留所有前後板、原稿、提示詞、測試與報告。

第二輪：法蘭克改為右手單持唯一短柄雙面斧、左手持藍金盾；中國札甲／魚鱗／禁軍重甲和日本大鎧／胴丸／具足各三張候選，完整人體檢查與圖板。中國、日本候選不進正式映射，等待玩家選擇。

重甲騎兵、既有帝王城郊、世界地圖110%、共用建築、科技與v95規則維持原樣。法蘭克左掌部分被盾遮擋的視覺限制保留，不將自評等同玩家審圖。

## Release notes 的堆疊處理

原 PR #44 的 `art-unification-20261028.json` 已存在於新 PR 的 Base。如果直接沿用兩輪對該檔案的修改，`checkNotes` 會因變更 Base 已有的 note 而拒絕 CI。

因此僅在**新分支**將該 note 保持 Base 的完全相同內容，並新增唯一 `art-player-feedback-20261029.json`，收錄兩輪已完成的玩家可見修正；候選尚未選定，不列作已定稿更新。原三個提交和其原始 note 仍在歷史中，沒有遺失成果。新 JSON 已原樣放入[待建立PR內容](PR-body.md)的受控區塊。

## 實際 GitHub 寫入檢查

1. 正常 push 只針對新分支執行一次：`git push origin HEAD:refs/heads/feat/art-player-feedback-20261029`。失敗：`CONNECT tunnel failed, response403`。
2. 雲端 skill 與目前 enforced network policy 均確認僅放行 `registry.npmjs.org`；未停用proxy、未修改網路政策、未繞過限制。
3. GitHub連接器可讀取原PR並提供blob/tree/commit/ref/PR寫入介面。遠端GET `git/commits/8736bad...`及`git/commits/c24862d...`均回404。
4. 連接器嘗試以原c24862d建立**新分支**，回422 `Object does not exist`；沒有建立不完整空分支，也沒有動原分支。
5. 現有`github_create_commit`介面僅接受tree、parent(s)、message，沒有author／committer／date／signature欄位，也沒有接收原始Git pack的介面。單獨上傳圖片blob和tree不能把原commit物件送上去；重新建立commit會改變SHA，無法滿足保留8736bad、bbdf779、c24862d原提交鏈的要求。因此未大量上傳不可能完成原歷史的孤立圖片物件，也未改寫提交來冒充成功。

**結論：新PR、遠端新分支與新版CI均為 BLOCKED。** 不是成功推送後僅等待CI。GitHub上的中國／日本／法蘭克新審圖連結尚不存在，不能提供指向未上傳路徑的假連結。原PR #44沒有新增留言、沒有更改Body／Base／Head／Draft狀態，也沒有被合併或關閉。

## 驗證與後續

本輪執行原三commit祖先檢查、檔案SHA清單、release note／PR body校驗、相關release metadata測試及美術保護gate。未改圖片或遊戲程式，不無故重跑2000多案回歸。

沿用c24862d已完成的證據：Typecheck／Build PASS；完整隔離回歸2102 PASS、0 FAIL、1 SKIP；正式兵種27案例、候選頁48卡面；前輪城郊288案例。這些明確屬雲端本機證據，**不稱為新PR的GitHub CI**。

待網路與精確Git物件傳輸能力恢復後，由Codex雲端推送本新分支，建立Draft PR，Base維持原功能分支，核對只有本次差異、原PR #44 HEAD不變，再取得新PR真正CI結果。無需玩家手動操作Git。

本輪不合併、不部署、不刪除舊功能分支。未來先驗收／合併#44；之後將新PR Base改為main，重新檢查差異、玩家選定中日正式卡、重跑CI與必要實體手機測試，通過後才另行核准合併。
