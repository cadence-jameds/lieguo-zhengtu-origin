# C4 長局瓶頸追查（2026-10-20）

固定起點為 PR21 `9f08fd63d8e7928add4048ff5f7c3aa2d1048fc7`，main `06c4cb93779f1f679bb77470515fd8aee1c42de9`。沿用 Draft PR21，不改已完成功能及 AI 權重。

## Phase A／B 初始追蹤

沿用上輪自然演進 checkpoint、相同五類合法 UI 操作及玩家前置，不改 AI 決策／事件。168h 手機10X、96h桌面10X各10筆；168h50X桌面／手機各5筆；新局桌面10X 5筆。35筆 durable 成功、0失敗。原始各筆 CommandId 時間軸見 `evidence/before/`，僅壓縮 JSON 空白，不移除慢樣本。這是固定來源的隔離插樁診斷，不是正式ABBA；巢狀時間不可直接相加。

初始隔離建置先因 Node spawn sandbox 權限、archive 不含.git的release prebuild、診斷helper的this型別而中止；均在隔離副本修正，原紀錄留在research，不改正式驗證規則。使用已凍結metadata直接執行tsc及vite；初始副本metadata沿用舊commitSha/dirty欄，來源身分以git archive head和各原始檔雜湊為準，不以那份版本標籤冒稱正式production。後續preparer已修正診斷標籤為來源head/dirty=true。

168h最慢新樣本為研究命令 `command:890152b9-3115-4b36-a387-41490a49856e`：ACK1490.5ms、含診斷傳輸的DOM觀察1824.9ms；點擊至Worker接收6.3ms、接收至處理0.1ms、純時鐘追算252.0ms、正式命令156.5ms、save1074.0ms（其中encode447.3ms、authority241.7ms）、ACK後worldPatch107.0ms。追算／命令／encode內各一次完整驗證，分別104.0／95.9／151.5ms。沒有到期AI事件，不能把這筆歸因AI決策。IndexedDB transaction lifetime1073.4ms包含驗證／序列化／crypto與請求，不是純磁碟寫入時間。所有開始／結束、父span、物件個數及checksum bytes均在raw。

另一筆168h建造命令接收後等待前一個背景保存182.3ms；該背景工作總長1475.3ms，其中大部分在玩家點擊前，不能把整段當指令延遲。初始96h桌面10X最大902.1ms；168h桌面50X最大1351.5ms、手機50X最大1243.1ms；新局最大411.3ms（精確值依raw）。**未重現歷史8613.2ms成功極值、96h舊p95退步或上輪提交前逾時；不能為它們指定唯一原因。**

世界城市數皆100、AI records99；168h自然存活81，不復活／減少AI。新局／96h／168h Receipt 約0／7038／13266；canonical存檔約0.2／2.84／5.28MB（依各筆bytes）。世界規模與存檔歷史成本同步增加。兩次native structuredClone會重新複製長fingerprint字串；Zod完整驗證仍做三次；IDB讀取current、備份/current及authority寫入也攜帶全部歷史。首批GC只收集CDP數值事件，缺少單調鐘與epoch對應，僅可提供巢狀GC統計，不能聲稱某個GC導致某筆命令。performance.memory是main JS heap，不能冒稱Worker heap或整機CPU。沒有強制GC或上傳Chrome raw trace。

診斷回傳payload可能延後DOM觀察；React layoutCommit為真實commit標記，ACK後餘量不是純React CPU或精確paint。正式驗收必須另用未插樁production與相同環境。

## Phase C 候選

針對已量測的兩次大型複製，候選僅讓純primitive Receipt另建獨立records，長字串不可變故可共用；其他所有分支仍deep clone，異常Receipt走原full clone；最終完整Schema、Checksum、Receipt驗證、IDB交易、CAS及ACK均不變。先驗證隔離／拒絕／99AI Replay等價，再做有界前後比較。若改善有限，不啟動完整矩陣，改交架構選項決策。
