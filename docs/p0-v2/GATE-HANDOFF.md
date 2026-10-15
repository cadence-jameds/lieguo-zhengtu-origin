# 獨立 GPT-6.1 Gate Review 交接

請使用 GPT-6.1 Sol 最高可用思考等級，對此 Draft PR 的完成 head 執行獨立審查。不要將本文件、測試數量或既有 CI 綠燈當成 Gate PASS；Android 驗收仍須真機。

## 檢查基準

基準 main `7b0390a05e5eea4f9fe190d2e772ad7275745751`（v0.30.50）；authority v94 > v93 > v92 > 有效歷史規則 > source。只審 P0 replay 性能、玩家指令可靠性與必要存檔安全。PR #3 R4 與 #9 UI 尚未合併，不得把它們納入產品基準。既有 v94/main 容量差異未在本輪改動。

## 請獨立確認

1. **根因證據**：PHASE1 的完整 6h baseline、前十大 CPU 熱點、保存收據 O(n²) 與玩家時序，是否足以支持變更；不要以 cooperative yield 代替真實速度改善。
2. **Replay draft 隔離**：公開 submit 的 clone/schema 不變；內部較小 draft 的所有 writer 僅改可變副本；readonly、autonomy、跨城市/領域別名可靠 fallback；拒絕或 exception 不留下付款、queue、sequence、politics 副作用。
3. **Scheduler**：priority/comparator/EventId tie-break 未變；事件次數、順序、內容完全相同；public native clone、nested/accessor/Proxy/clone-failure 語義保留；politics 只刪除原 predicate 判定的 stale event。
4. **持久化**：transaction-local Map 仍比較每筆 canonical receipt 全欄位；checksum、最終 schema、CAS、rolled-back history、Recovery prune 與多 store 原子性未退化。用獨立 fault injection 驗證，不只看記憶體世界。
5. **玩家命令**：從 rendered intent 建立 stamp；無關更新可單次 admission rebase，較新 foreground/campaign/branch 有 fence。真正 queue、resource、ownership、qualification 仍拒絕；同 CommandId 不重扣，拒絕後沒有延遲自動成功。
6. **Worker 排程**：foreground 保持 FIFO，load/import/restore/away/resume 是 barrier，pending tick 不插隊；當前 replay/save 不暴露部分 draft；受理與 durable success 分開。
7. **前端**：pending/ack 關聯 CommandId；舊 ack 不覆寫新操作；經檢查 patch 的 identity 保留；重複 resume 的 watchdog 仍以真實事件進度重設，停滯時仍能停止/重試。
8. **真實存檔**：0/6/24h 完整處理；世界、reports、事件順序 hash 比對，99 AI 與 1/10/50X 測試；分段 revision normalize 的界線清楚，CAS 另驗證。原始檔不能公開或覆寫。
9. **瀏覽器**：檢查 click→received→admission→native IDB complete→ack→render 的順序與時間，尤其 AI 更新、佇列滿、資源不足、取消、雙點擊、重送、切換/refresh/Recovery、繁重 offline 後立即建造。
10. **回歸及界線**：typecheck、隔離 full regression、production/Pages build 與 Chromium 為本次 head 執行；保留三項歷史 legacy art 失敗紀錄、B5 E1 HOLD、Astra 未 PASS。同一環境的未修改 main 美術對照為 20/20 PASS，本輪實測結果另列，不把環境差異當作 P0 美術修復。無 Android 真機時標 PENDING，不宣稱 P0 PASS。

## 可重現方式與私有資料

性能工具用法見 [`../../scripts/p0-profile.md`](../../scripts/p0-profile.md)，以環境變數注入私有存檔與隔離輸出目錄。公開 repository 不包含真實存檔 fixture、完整 JSON、CPU trace、資料庫內容或原始瀏覽器 trace。可先執行內建 99 AI 合成輸入核對工具，再於私有環境重跑真實存檔。

完整測試只能使用 `node scripts/verify-in-isolation.mjs full`，避免歷史測試改寫工作樹驗收紀錄。新檔需納入 git index 才會被隔離腳本複製。最終結果與已知失敗見 [`DELIVERY.md`](DELIVERY.md)、[`performance.json`](performance.json) 與 [`browser-validation.json`](browser-validation.json)。

交付時最終 full 為 1,197 PASS / 0 FAIL / 1 SKIP；0/6/24h Node 原版前後、策略一致性與 6h 同 Chromium 原版前後皆 exact PASS。另有 [`production-browser.json`](production-browser.json) 與 [`validation.json`](validation.json)。施工期間 GPT-6.1 預審見 [`INDEPENDENT-REVIEW.md`](INDEPENDENT-REVIEW.md)，封存後實測由交付者另註，尚未取得最終 Gate 簽核。請特別核對 24h 144.224s 超出 120s、部分建造超過 1–2s、跨 V8 21 個既有浮點差異及 Android PENDING，不能因功能測試通過便予以消除。

任何未達工程時間目標、Android PENDING、新增不一致或保存故障，都必須列為具體限制或阻擋項。不得自行 merge、部署、修改 release approval 或宣布 P0 Gate PASS。
