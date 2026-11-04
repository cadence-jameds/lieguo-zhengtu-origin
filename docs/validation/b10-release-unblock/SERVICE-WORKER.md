# Production SW：P0 BLOCKED、證據及五情境契約

歷史 PR #60 的結果仍是 **4 PASS／1 FAIL**：HTTP 503 後重試，durable-save-ack、SKIP_WAITING 已發出，但 15 秒內沒有 controllerchange。原文件及原測試不改寫。本批第一次原基準重跑未能重現這個 activation failure，不能宣稱已確定該次失敗的唯一根因。

本批實際重現另一個狀態競態：拒絕安裝的 candidate 約 4ms 內由 installing 進入 redundant，`registration.update()` resolve 時 `registration.installing` 已清空；只在 resolve 後掛監聽的舊頁會錯過失敗。原生 CDP 狀態追蹤保留這項證據。修復在呼叫 update 前觀察 candidate，並追蹤其後狀態，及時顯示失敗／重試。

`clients.claim()` 的明確事件生命週期、候選已 active 而頁面尚未取得 controller 的恢復、安裝失敗監聽競態已施工並有定向測試。僅收到經 UI 保存及身份確認的 SKIP_WAITING 才請求啟用；精確 release identity、3 秒身份檢查、30 秒下載及 15 秒啟用期限均保留。身份訊息短暫遺失可有限重查。沒有自動 skipWaiting、unregister、刪資料或延長期限。

**但啟用停滯仍未安全解決。** 最終補充回歸在 `3a3ae8d` 真正 Production Build 重現：HTTP 503 情境通過，但 Install Reject 後重試為 activation timeout，完整五組 **4 PASS／1 FAIL**。原生狀態與候選身份均正確，candidate 收到 SKIP_WAITING，記錄 `skipWaiting:start`，之後仍 installed；沒有 `skipWaiting:resolved`／activate／controllerchange。active 仍是舊版本、scope 正確、只有一個 client。保存成功及舊頁／原 Ack 保留，但不構成更新成功。

移除 waiting message 對 skipWaiting Promise 等待的對照提交 `355e7f7` 仍在正常更新重現同型停滯（該輪五組亦 4/5），所以不能將 circular wait 當成已證實根因；已用 `243f68a` 正式 revert，沒有改寫歷史。另一個診斷在原案例已 FAIL 後再次對**同一** candidate 發 SKIP_WAITING，1 秒後仍 installed、零 controllerchange。沒有因此加入自動重送或強制 reload。6 次獨立 Install Reject 試驗為 5 PASS／1 FAIL；6 次獨立正常更新亦為 5 PASS／1 FAIL，兩個 FAIL 的診斷重送都無法解除停滯。單輪 5/5 或單項 PASS 不能消除此間歇性 P0。

## 測試差異

原 `docs/validation/b10-final/production-sw.mjs` 完整保留。本批同格式 bounded before／after 跑此原檔為 **4 PASS／1 FAIL**：Install Reject 的「必須先出現 GET_APP_RELEASE」探針等待失敗；UI 此時已正確顯示安裝失敗。其他四組（包括 HTTP 503）通過。這不是原歷史的 activation timeout，兩者不得混記。

後繼 `production-sw-successor.mjs` 保留相同五組故障條件及保存、身份、啟用、離線、查詢與重試斷言。唯一替代是 Install Reject 不再要求對已 redundant worker 發身份探針，而要求原生 CDP 證明**同一 candidate 曾 installing→redundant，且從未 activated**，同時 UI 明確失敗。此證明比以「發過探針」推斷安裝失敗更直接，不以虛構舊 active 回覆滿足斷言。後繼完整五組第一輪曾 **5 PASS／0 FAIL**，但後續完整重跑及獨立重複已重現上列真實 activation failure；必須保留全部結果，不能只選第一輪綠燈。

| 情境 | 保留的故障／安全條件 |
|---|---|
| 正常更新、離線重開 | 原生 SW／CacheStorage；保存後啟用；期望版本；離線重開及正式命令查詢 |
| HTTP 503 後重試 | 首次 `sw.js` 真實 HTTP 503；舊頁／資料保留；網路恢復後重新更新；原 15 秒啟用期限 |
| Install Reject 後重試 | 真正 install event Promise.reject；同 candidate 原生狀態；無假成功；恢復產物後重試 |
| Durable Save Abort | 原生 IDB readwrite transaction abort；不得 SKIP_WAITING／reload；原頁及資料保留 |
| T1 後關閉再重啟 | 原生 Runtime T1 durable 後關頁；同 origin 重開並查詢；正式效果一次 |

診斷訊息僅在案例結果確定後讀取，不用診斷 ping 延長被測 worker 的生命週期。原始 trace、測試 DB、CacheStorage 及私人存檔均不提交。

`B10_SW_DIAGNOSTIC_RESEND=1` 僅在原案例已記為 FAIL 後執行上述一次診斷重送，不改 FAIL、不延長產品 deadline；重現腳本可用 `B10_SW_ONLY=bad-install` 或 `B10_SW_ONLY='native update'`。這不是產品重試修復。仍須定位瀏覽器 registration／active-worker 端未完成 transition 的原因，或證明可維持全部保存／身份／舊頁保護的修復；目前沒有足夠證據安全採用破壞性替代。

已執行的舊頁程式不會因新 SW 下載而被倒改。舊版安裝失敗競態仍可能先走既有有限 timeout，保留舊頁及重試入口；不能聲稱新 worker 能修改先前已執行的 JavaScript。舊 DB→新格式更新另外測試，不能拿新格式可存取代 SW 成功證據。
