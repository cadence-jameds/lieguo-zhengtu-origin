# PR #49 後繼 UI 相容性

本記錄修復 CI Run [41026256832](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/41026256832) 的 `Stale display evidence: CityScenes.tsx`，並涵蓋後續 FormalWorldMap 保護值與 game.css 相容性鏈。施工保留原 PR #49 UI Commit `574cdac0f50b1352289f9fec3764db53b04b6742`，不重做 UI／美術。

`compatibility.json` 明列 main 基準 `bfe2429…`、UI Commit `574cdac…`、五個 UI 來源及其既有總督測試的原／新 SHA256、各 Gate 可接受的精確前驅 SHA、允許的 UI 差異，以及 22 個既有驗收檔案的 SHA256。兩份 Commit 是驗證器中的固定識別，不接受任意替換。六個來源（五個 Runtime 與一個既有 UI 測試）均以 Git 中原始 bytes 與工作樹互相核對；只允許這六個精確檔案：CityScenes、FormalWorldMap、game.css、Shell、parity.css、v95City.test.tsx。後三項也受巢狀 elite-review Gate 保護；總督測試只更新手機精簡標籤與完整無障礙名稱的斷言。

兩套舊 Gate 的差異：city-fit/measurements.json 鎖定早期顯示來源；PR #45 的 compatibility.json 只接上 MiniatureCity 與 game.css，protected.json 仍鎖定舊 FormalWorldMap。PR #49 另變更 CityScenes／FormalWorldMap 與 game.css，因此不能僅刷新舊量測的 SHA。新檢查沿用原保護與所有圖片、裁切、圖板、腳點、anchor／hit、來源、兵種／科技及核准中國／日本美術驗證，只為上述精確來源提供可稽核的精確後繼版本。

`city_ui_successor.py` 另外核對七份歷史 manifest 原 bytes、五個未變美術映射／校準來源、原始 39 項瀏覽器案例、六文明四時代、四個尺寸、完整時代切換、等級徽章幾何與對比、地圖「帝」字移除及所有 17 張截圖。舊 label／scale 量測仍是其原版本的歷史證據，**不宣稱已重新量測目前 UI**；目前徽章／標題／HUD 依 PR #49 新證據驗證。

原 `docs/validation/city-ui-integration/checks.json` 的完整回歸仍為 **2104 PASS／1 個 30000ms 超時 FAIL／1 SKIP**，定向重跑與 main 對照 PASS 的紀錄不變。後繼 UI 相容性不是完整回歸豁免；本輪 GitHub CI 仍須重新執行完整回歸、Build、Pages 與 Release 檢查，測試門檻及 workflow 不變。PR 維持 Draft，不合併、不部署。

本機驗證：

```sh
python3 scripts/city_ui_successor.py
python3 -m unittest discover -s scripts -p 'test_city_ui_successor.py'
python3 scripts/check-city-visuals.py
python3 scripts/check-player-feedback.py
python3 scripts/check-art-boards.py
python3 scripts/check-elite-review.py
python3 scripts/check-elite-final-review.py
```

負向測試在暫存副本中驗證：未知前驅、未授權來源、來源 bytes 改動、歷史 manifest 改動、即使刷新 manifest SHA 也不能替換原驗收、缺少驗收檔案、換 Commit 與修改美術校準皆拒絕。正式歷史證據與核准美術不寫入。
