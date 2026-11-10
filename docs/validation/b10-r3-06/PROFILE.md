# R3-06 正式 Runtime 初始剖析

基準 PR58 c370ff8，正式程式修改前先量測。Node22.23.4/CPU quota2/8GiB，Vite SSR唯讀插樁，Node CPU sample與GC；不是原生裝置延遲。原始全量樣本在ignored artifacts，交付數值摘要保留calls/total/max及最多前20000樣本的p50/p95。Nested inclusive不可相加。

原30秒案例使用既有isolatedAutonomyFixture：AI延後30日，首次AI前須重播72000個逐城小時經濟事件。存檔失敗後相同玩家設定命令必須重播一次；不是99AI同時決策36秒。相同合法fixture與目標的單次正式cooperative advance為13932.7ms/72001事件/1AI決策。其中economy.settle事件12205.6ms，reconcileVictory 72004次/8798.9ms，campStatistics6427.1ms；populationGrowth14472803次/1282.3ms。最長經濟事件17.4ms，冷AI20～21ms；warm99決策同時場景506.8ms、99事件，最大12.3ms。

Node CPU sample首位victory.ts anonymous callbacks約4.94秒，now插樁1.30秒、GC1.21秒，populationAt0.40秒。Victory每個陣營對所有100陣營做hostileEmpire搜尋，即使沒有帝國；同城人口也重算兩次。排程push/pop合計不到250ms，不應先重寫Scheduler。

決定先優化可證明等價的唯讀勝利必要條件及候選篩選，保留所有事件和AI策略。城市占比不足45%時兩種勝利必定不成立，但仍必須依原行為清除舊候選及事件；實際勝利公式和邊界不改。再改善完整事件間的有界接收機會與唯讀命令查詢，不拆事件、不發布未提交draft。
