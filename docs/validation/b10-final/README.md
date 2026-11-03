# B10 Final 驗收交付索引

先讀 [REPORT](REPORT.md)。結論 **B／CONDITIONAL PASS**，正式發布 HOLD。程式碼固定完整 Stack `8d40f63…`；產品、原測試及 Release Notes 沒有修改。

| 文件 | 用途 |
|---|---|
| [ARCHITECTURE](ARCHITECTURE.md) | 模組圖、唯一 Writer、T1／T2／T3、Ledger／Save／Recovery、Projection／Preview、六階段交界 |
| [RELIABILITY-MATRIX](RELIABILITY-MATRIX.md) | 20 項玩家可靠性情境與自動驗證對照 |
| [ANDROID-CHECKLIST](ANDROID-CHECKLIST.md) | 19 項實機操作表，全部 NOT TESTED |
| [MERGE-PLAN](MERGE-PLAN.md) | 實際模擬 merge-commit、Base 調整、版本與部署授權邊界 |
| [PRODUCTION-SW-REPRO](PRODUCTION-SW-REPRO.md) | 4 PASS／1 FAIL 的 SW 重試時序、最小重現與後續方向 |

`evidence/` 的 `checks`／`parity`／`native-correctness`／`performance`／`cold-load`／`soak`／`memory`／`production-sw`／`production-preview`／`attempts`／`merge-simulation` 保存摘要。大型原始量測與 traces 不在 Git；摘要不是私人存檔。Main harness、Dedicated Worker、Node／fake-IDB、真 GameApp、合成時鐘與實際 soak 分開標示。

## 重跑

使用 Node >=22.13、`npm ci`。Cloud 若 npm 預設 cache 不可寫，可指定 `/tmp` cache。Playwright 使用環境既有外部模組，不修改專案 dependencies；非 Cloud 需設定 `PLAYWRIGHT_MODULE` 並備妥 Chromium。以下均從 repo root、固定來源執行；不部署。

```sh
npm ci --cache /tmp/b10-npm-cache
npm run typecheck
npm run build
node scripts/verify-in-isolation.mjs full
node scripts/verify-runtime-parity.mjs
```

完整正向／反竄改命令依 `.github/workflows/ci.yml`，本輪 51 negative assertions 全數通過。保持原 2 workers、30／120 秒等期限及全部斷言；不要在工作樹直接跑會生成舊 docs 的完整測試。

原生 Runtime／UI／Ledger：

```sh
B10_OBSERVE=1 B10_PORT=5187 node scripts/serve-runtime-validation.mjs
```

在另一 shell 分別、依序執行（不要與 latency 量測並行重型工作）：

```sh
B10_BROWSER_URL=http://127.0.0.1:5187 node docs/validation/b10-final/extend-soak.mjs
B10_BROWSER_URL=http://127.0.0.1:5187 node scripts/verify-runtime-browser.mjs
B10_BROWSER_URL=http://127.0.0.1:5187 node scripts/verify-ui-projection-browser.mjs
B10_BROWSER_URL=http://127.0.0.1:5187 node docs/validation/b10-final/ledger-v2-adapter.mjs
```

Adapter 會保留前一次舊工具結果；首次直接執行 `verify-formal-ledger-browser.mjs` 的 v1 讀取失敗是已知工具相容問題，不能把該次算 PASS。衍生 adapter 固定原檔 SHA，只有一個讀取改接真 PresentationStore，原測試、assertions、counts、timeouts 全文保留。

Production 建置／server／五情境命令見 SW 重現表。額外可執行 `production-cold.mjs` 與 `production-preview.mjs`；冷載入每次 fresh browser／Worker，資料生成 Worker 在計時前終止。`prepare-production.mjs` 會拒絕與固定 source 不符的產品工作樹。

150k／Worker Persistence 使用 `serve-persistence-validation.mjs`，分開的 `.vite-persistence-validation` cache；`large-history-browser.mjs` 保持五次與 100MiB 限制。合法 oversized fixture 匯出拒絕是明確容量條件，不能宣稱匯入 PASS。

重跑會更新忽略的 `artifacts/`；不得將 profile、raw trace、dist、archive、node_modules 或私人存檔加入 Git。補證據時新增／更新本輪目錄，保留原六階段歷史。
