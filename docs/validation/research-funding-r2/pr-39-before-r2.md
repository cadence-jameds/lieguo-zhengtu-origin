原本的科技頁以卡片平鋪，部分研究時間標為世界分，也未完整反映資源與唯一佇列是否可用。本 PR 接回正式科技目錄，改為桌機三時代科技樹、手機時代／多分類收合與底部詳情，並以現實時分秒顯示預估與剩餘研究時間。

**Draft，等待 GPT-6 中控複審與玩家放行。未合併、未部署 Pages、未關閉 Issue，未開始 B10／B11。**

- Base main：`b8130b7bb4bd6c78f3b6510d733a149013f78d95`
- HEAD：`4365b6ea5be60ffd50d4ac9ca73b621a56077b0e`
- 分支：`ui/research-tech-tree`
- [完整施工報告、修改範圍、風險與 15 張截圖](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/ui/research-tech-tree/docs/validation/research-tech-tree/README.md)

正式資料仍是 66 項傳統、16 項現代科技；連線只取 prerequisites。沿用 techArt、researchRequirements、researchQuote、共用顯示時鐘與固定 durationSnapshot；沒有改動科技／成本／工期／研究權限、指令、佇列、ACK、存檔、Recovery 或 AI 規則。未研發保持暗圖，符合資格與資源才亮金框；研究中的圖示保持暗色直到正式完成確認，沒有進度條。現代多城籌資保留；單城不足仍可按正式規則先建立籌資，但不假裝已經開始研究倒數。

## 驗證

- 最終 UI／目錄定向測試：39/39 通過，含新 20 項，涵蓋六文明、正式邊線／順序、狀態、重複啟動阻擋、完成 ACK 與完成存檔讀回。
- 一世界小時換算：1X＝60 分；3X＝20 分；6X＝10 分；10X＝6 分；50X＝1 分 12 秒。50X 使用原有 developer effective speed；速度切換、暫停／恢復與恢復 world anchor 均驗證。
- Typecheck、根目錄 Production Build、Pages Build、Pages base／manifest scope／SW fallback、release artifacts／Worker identity 通過。
- Chromium：11/11 通過，含 1600／1024 桌機、320／360／390／430 手機、折疊／底部詳情／sticky、籌資扣款與切城、真 Worker／IndexedDB 重載，以及真 Service Worker 在 Pages 路徑離線恢復研究。
- 初輪完整隔離回歸：**1,996 通過、4 失敗、12 略過，非 PASS**。runtime 有 3 個逾時與 1 個 catch-up 斷言失敗；breakthrough 的 240s beforeAll 逾時導致 11 項略過，另 1 項需玩家私人存檔。[完整逐項紀錄](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/ui/research-tech-tree/docs/validation/research-tech-tree/regression-full.json)。兩個 formal 檔案均未修改，無建置／瀏覽器競爭的隔離單 worker 重查與最終 HEAD CI 結果補在下方；不把重查合併冒稱一次全套綠燈。
- 初輪擴展定向中的既有 5s offline codec 逾時，依完整套件的 30s 設定重跑該檔 60/60 通過，未修改斷言。
- 本機完整回歸副本早於最後幾項 UI 收尾；最終 HEAD 已重新執行 Typecheck、Build、39 項測試及 11 情境瀏覽器矩陣。最終 HEAD 全套驗證以此 PR CI 為準。

## 交付與限制

[桌機科技樹／三態](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/ui/research-tech-tree/docs/validation/research-tech-tree/1600x1000-traditional-states.jpg) · [手機科技頁](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/ui/research-tech-tree/docs/validation/research-tech-tree/390x844-traditional.jpg) · [折疊](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/ui/research-tech-tree/docs/validation/research-tech-tree/390x844-collapsed.jpg) · [詳情](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/ui/research-tech-tree/docs/validation/research-tech-tree/390x844-detail.jpg) · [現代科研桌機](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/ui/research-tech-tree/docs/validation/research-tech-tree/1600x1000-modern-overview.jpg) · [現代科研手機](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/ui/research-tech-tree/docs/validation/research-tech-tree/390x844-modern-overview.jpg) · [研究中現實倒數](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/ui/research-tech-tree/docs/validation/research-tech-tree/mobile-active-detail.jpg)

Chromium 觸控／viewport 模擬不等於實體手機驗收。既有 B5 E1 HOLD、Astra Gate 非 PASS、實機待驗維持。所有截圖與 fixture 均為合成資料，沒有提交玩家存檔、dist、node_modules 或 raw traces。

## 玩家更新摘要

<!-- release-notes:start -->
```json
{"title":"科技樹與現實研究倒數","notes":["科技研發分為傳統科技與現代科研；桌機以正式前置關係呈現三時代科技樹。","手機可切換時代、獨立折疊分類，並在底部查看完整研究資格與操作。","未研發圖示保持暗色，可研究與研究中顯示金框，正式完成後才恢復亮度。","研究時間依目前遊戲速度顯示現實時分秒，頂端持續顯示研究或籌資狀態。","保留現代科研多城籌資、共同佇列與四項資源投入操作。"]}
```
<!-- release-notes:end -->

## 完整回歸受影響檔案隔離重查

原封不動的 `runtime.test.ts` 與 `breakthroughB92.test.ts` 在無建置／瀏覽器競爭的同一隔離副本、`--maxWorkers=1 --testTimeout=30000` 重跑：**75 通過、0 失敗、0 略過**。未改測試內明訂的 20s／30s／240s 限制與任何斷言。包含初輪 4 個失敗及因 hook 逾時未跑到的 11 項；初輪全套非 PASS 的紀錄保留。

<details>
<summary>隔離重查逐項結果（75）</summary>

```json
{
  "passed": 75,
  "failed": 0,
  "skipped": 0,
  "suites": [
    {
      "file": "game/formal/breakthroughB92.test.ts",
      "tests": [
        {
          "name": "B9-2 requires a completed usable wonder, leader and current members; creation and replay cannot spend or create extra projects",
          "status": "passed"
        },
        {
          "name": "B9-2 stock is debited once, cargo arrives once into its own pool; paused arrivals are returned and can be dispatched after recapture",
          "status": "passed"
        },
        {
          "name": "B9-2 60M takes 2000 real market trips and exactly 48 world hours, once, with save/offline/cooperative equivalence",
          "status": "passed"
        },
        {
          "name": "B9-2 a conqueror joining the original empire cannot resume funding, including after save/load",
          "status": "passed"
        },
        {
          "name": "B9-2 a conqueror joining the original empire cannot resume building, including after save/load",
          "status": "passed"
        },
        {
          "name": "B9-2 conquest freezes elapsed work immediately, and genuine recapture resumes the saved remainder across save/load",
          "status": "passed"
        },
        {
          "name": "B9-2 awards the current membership snapshot only; leaving and rejoining before completion is sufficient, later joining grants nothing",
          "status": "passed"
        },
        {
          "name": "B9-2/B9-5 numeric damage pauses work, ruins roll back to the last 25% checkpoint, and paid repair restores use",
          "status": "passed"
        },
        {
          "name": "B9-2 all 99 native AI use the same real-stock breakthrough start and contribution rules",
          "status": "passed"
        },
        {
          "name": "B9-2 atomic persistence, export/import and Recovery preserve cargo, pause, membership snapshot and one completion",
          "status": "passed"
        },
        {
          "name": "B9-2 a conquest at the exact deadline takes priority; recapture can finish the preserved zero remainder once",
          "status": "passed"
        }
      ]
    },
    {
      "file": "game/formal/runtime.test.ts",
      "tests": [
        {
          "name": "active Worker does not acknowledge or switch a draft until persistence resolves",
          "status": "passed"
        },
        {
          "name": "failed commit gives rejected ack and prior world; retry and replay only save once successfully",
          "status": "passed"
        },
        {
          "name": "requests share one serialized authority and reject an overlapping stale command",
          "status": "passed"
        },
        {
          "name": "restore mid-transaction failure never exposes success",
          "status": "passed"
        },
        {
          "name": "import mid-transaction failure never exposes success",
          "status": "passed"
        },
        {
          "name": "restart loads durable receipts and replay does not submit a second save",
          "status": "passed"
        },
        {
          "name": "1X construction completes at its real deadline, not the old ten-second tick",
          "status": "passed"
        },
        {
          "name": "3X construction completes at its real deadline, not the old ten-second tick",
          "status": "passed"
        },
        {
          "name": "6X construction completes at its real deadline, not the old ten-second tick",
          "status": "passed"
        },
        {
          "name": "10X construction completes at its real deadline, not the old ten-second tick",
          "status": "passed"
        },
        {
          "name": "25X construction completes at its real deadline, not the old ten-second tick",
          "status": "passed"
        },
        {
          "name": "polling is coalesced while the durable advance is pending and catches up elapsed real time",
          "status": "passed"
        },
        {
          "name": "1X idle polling does not publish/save per second and checkpoints at ten seconds",
          "status": "passed"
        },
        {
          "name": "1X a new construction starts at actual admission time and saves a single revision",
          "status": "passed"
        },
        {
          "name": "1X a clock checkpoint revalidates the exact click once without a rejected acknowledgement or resubmission",
          "status": "passed"
        },
        {
          "name": "1X training uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "1X research uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "1X settlement uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "1X logistics uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "3X idle polling does not publish/save per second and checkpoints at ten seconds",
          "status": "passed"
        },
        {
          "name": "3X a new construction starts at actual admission time and saves a single revision",
          "status": "passed"
        },
        {
          "name": "3X a clock checkpoint revalidates the exact click once without a rejected acknowledgement or resubmission",
          "status": "passed"
        },
        {
          "name": "3X training uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "3X research uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "3X settlement uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "3X logistics uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "6X idle polling does not publish/save per second and checkpoints at ten seconds",
          "status": "passed"
        },
        {
          "name": "6X a new construction starts at actual admission time and saves a single revision",
          "status": "passed"
        },
        {
          "name": "6X a clock checkpoint revalidates the exact click once without a rejected acknowledgement or resubmission",
          "status": "passed"
        },
        {
          "name": "6X training uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "6X research uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "6X settlement uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "6X logistics uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "10X idle polling does not publish/save per second and checkpoints at ten seconds",
          "status": "passed"
        },
        {
          "name": "10X a new construction starts at actual admission time and saves a single revision",
          "status": "passed"
        },
        {
          "name": "10X a clock checkpoint revalidates the exact click once without a rejected acknowledgement or resubmission",
          "status": "passed"
        },
        {
          "name": "10X training uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "10X research uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "10X settlement uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "10X logistics uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "25X idle polling does not publish/save per second and checkpoints at ten seconds",
          "status": "passed"
        },
        {
          "name": "25X a new construction starts at actual admission time and saves a single revision",
          "status": "passed"
        },
        {
          "name": "25X a clock checkpoint revalidates the exact click once without a rejected acknowledgement or resubmission",
          "status": "passed"
        },
        {
          "name": "25X training uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "25X research uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "25X settlement uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "25X logistics uses the real deadline and agrees with offline completion",
          "status": "passed"
        },
        {
          "name": "a due event crossed by an original click commits first and must not auto-retry a changed intention",
          "status": "passed"
        },
        {
          "name": "1X governance bridges its own catch-up with low load and never duplicates payment or events",
          "status": "passed"
        },
        {
          "name": "1X governance bridges its own catch-up with 100 armies and never duplicates payment or events",
          "status": "passed"
        },
        {
          "name": "10X governance bridges its own catch-up with low load and never duplicates payment or events",
          "status": "passed"
        },
        {
          "name": "10X governance bridges its own catch-up with 100 armies and never duplicates payment or events",
          "status": "passed"
        },
        {
          "name": "25X governance bridges its own catch-up with low load and never duplicates payment or events",
          "status": "passed"
        },
        {
          "name": "25X governance bridges its own catch-up with 100 armies and never duplicates payment or events",
          "status": "passed"
        },
        {
          "name": "a late event remains unexposed on failed persistence, retries after one second, and never overlaps",
          "status": "passed"
        },
        {
          "name": "a failed governance save never exposes a new setting or receipt and replay commits only once",
          "status": "passed"
        },
        {
          "name": "1X command admission uses real IndexedDB authority and restores the same durable state",
          "status": "passed"
        },
        {
          "name": "3X command admission uses real IndexedDB authority and restores the same durable state",
          "status": "passed"
        },
        {
          "name": "6X command admission uses real IndexedDB authority and restores the same durable state",
          "status": "passed"
        },
        {
          "name": "10X command admission uses real IndexedDB authority and restores the same durable state",
          "status": "passed"
        },
        {
          "name": "25X command admission uses real IndexedDB authority and restores the same durable state",
          "status": "passed"
        },
        {
          "name": "the active presentation stream sends committed patches and can recover a full snapshot",
          "status": "passed"
        },
        {
          "name": "a queued visibility boundary freezes dev time before waiting behind an atomic save and duplicate barriers are idempotent",
          "status": "passed"
        },
        {
          "name": "developer speed changes bridge due AI catch-up only with unchanged intent, retain durable rollback and reject concurrent settings",
          "status": "passed"
        }
      ]
    }
  ]
}
```
</details>

## 最終 HEAD GitHub CI

最終 HEAD `4365b6ea5be60ffd50d4ac9ca73b621a56077b0e` 的兩次原生 CI 均成功：

- [PR 事件 CI 40216684050](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/40216684050)：完整回歸 **2,011 通過、0 失敗、1 略過**。
- [分支 push CI 40216477771](https://github.com/cadence-jameds/lieguo-zhengtu-origin/actions/runs/40216477771)：相同 **2,011／0／1**。
- 兩次均完成 npm ci、Typecheck、完整隔離 Regression、Pages Production Build、Pages base／PWA scope／SW fallback、release artifacts／Worker identity 驗證及 regression artifact 上傳。
- 唯一 skip 是既有 `batch210` 玩家私人存檔案例，未提供 `REALM_REGRESSION_SAVE`；不是本輪新增 skip。
- 初輪本機非 PASS 的紀錄及單 worker 75/75 重查保留，沒有修改 formal 規則、時限或斷言來取得綠燈。
- 本節只補驗證連結與結果，沒有改 source HEAD 或 release note；若 PR 說明更新觸發同 SHA 的 edited CI，最新狀態以 PR Checks 為準。

維持 Draft；未合併 main、未部署 Pages、未關閉 Issue。STOP，等待 GPT-6 中控複審與玩家放行。
