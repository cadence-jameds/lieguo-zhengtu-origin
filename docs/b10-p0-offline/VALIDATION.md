# B10 P0 驗證紀錄

Base：`c8b3554ff9643b74b624e4e77f381653afcccc20`（已合併 PR #66）。實測時的正式來源固定在此 SHA；最終工具 HEAD 列於 Draft PR 描述。2026-11-16 再查 remote main，仍為相同 SHA。

## 執行結果

| 檢查 | 結果 |
|---|---|
| `npm ci --cache /workspace/npm-cache` | 通過；未修改 dependencies／lockfile |
| `npm run typecheck` | 通過 |
| `npm run build` | 通過；既有大 chunk 提示保留 |
| `node --test scripts/offline-benchmark/metrics.test.mjs scripts/offline-benchmark/isolation.test.mjs` | 最終 **10/10 通過**，約 14.1 秒 |
| `node scripts/verify-in-isolation.mjs full` | **2,604 通過、1 失敗、12 跳過**；沒有宣稱全套通過 |
| 失敗測試檔在同一拋棄式 workspace 單獨重跑 | **4/4 通過**；未修改正式測試或延長等待門檻 |
| 原生 Chromium 最終 count smoke（1X／1h） | 326 事件、1.546 秒；readback 通過，只作工具 smoke |
| 最終 raw adapter 真實備份完整驗證 | 通過；StorageMeta、正式 loader、Ledger／identity、full-export/import 稽核；無 Recovery fallback、pending Inbox 0 |
| 真實 12h Node／原生結果比較 | 113,924 事件；全部 38 項 world／完整 archive／報告 SHA-256 相同，事件順序觀察值相同 |
| 私人 1h count／sites 控制與冷載入詳細剖析 | 完整世界／Ledger／報告相同；工具 async span 修正後重跑成功 |
| `git diff --quiet origin/main -- src public package.json package-lock.json` | 通過；正式遊戲來源與依賴零差異 |
| Production `dist/assets` 探針檢查 | 無 `__b10p0`、`b10p0-fixed`、`PRIVATE_BENCHMARK_FAILED` 字串 |
| 私人來源前後 SHA-256 | 相同；digest 不公開 |
| `git diff --check` | 通過 |

完整回歸唯一失敗是 `src/game/formal/offlineExtinctionClockWorkerDelta.test.ts` 的 `T2/T4/T5/T6 Worker developer-100: offline freeze and rebirth publish only durable state; failure/retry, queued requests and first tick preserve the clock boundary`。失敗位於第 16 行共用 `vi.waitFor` 的 `expected false to be true` 輪詢斷言，duration 約 3.418 秒。正式來源與 base 相同，Benchmark transform 未被此 suite 匯入；單檔重跑四個情境全數通過。**全套負載下這次等待失敗的確切根因尚未證實**，不將單檔通過改寫為 full regression PASS，也不推論所有 Worker 延遲都已驗證。

完整回歸依 AGENTS.md 在 `/tmp` 拋棄式 copy 執行，保留歷史測試的寫檔隔離。新增 MJS 測試已加入 CI；GitHub CI 狀態另見 PR checks，不能以本機結果代替。

## 新增測試實際保護的邊界

- Reservoir 記憶體有界、inclusive／self 巢狀扣除及樣本不足時不輸出假分位數。
- count 模式只插入事件觀察；structuredClone wrapper 保留回傳／finally。
- async tail Promise 結束後才關閉 span，原函式內的 catch 不會意外攔截原本應由 caller 接收的 rejection。
- named arrow cache invalidation 的行為保持。
- 輸出不可透過相同路徑、symlink 或 hardlink 覆寫私人來源。
- 非法 envelope 不改既有 DB；raw adapter 拒絕重複主鍵、損壞 Ledger checksum、錯誤 StorageMeta，來源保持不變。
- 原同步 replay／cooperative replay 及 detailed／count 的全部 world fields、完整 Ledger archive 與報告相同；原輸入未變。這不取代第二階段所需的外部 Inbox／Fence／Recovery 故障注入與逐事件對照。

## 沒有當成通過的執行

30-world-day mature fixture 準備遇 Node 約 2 GiB heap OOM，未進入計時重播；另有未完成的 developed 12h exploratory 長跑，皆未產生虛構完整耗時。早期 native 詳細探針的 async span 失敗已修正工具並重跑；最後 raw StorageMeta 負向測試亦先暴露同實例 ready handler 不重跑，改為全新隔離實例後通過。這些都是工具／fixture 的紀錄，不偽稱正式遊戲 Runtime 失敗或已最佳化。

Android 真機、背景凍結／OS 回收、熱降頻、原生磁碟、整頁 heap、真正玩家指令 T1／T2 p50／p95／p99 尚未測。歷史三項 legacy art failure 的基線說明、B5 E1 HOLD、Astra Gate 非 PASS 與手機未驗證狀態保留；本次結果不構成發行或 Gate 驗收。沒有合併 main 或部署。
