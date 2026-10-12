# R2c｜城市治理與99AI完整R2整合

接續Verified R2b v0.30.47 commit 3de26db6bf4dc1e5206057e5078e5c7041c58658，ZIP SHA 248498b4d9aa85075d7960fb991fac297574475115c079a7403ce16a0a087e70，bundle SHA 70274db84bf41b8810de8360d47ae717689dc83d40fc2290dbd4d971ff1ec2c3；976來源檔、CRC、bundle verify及clone已通過。R2a/R1封存原樣保留。

新增Formal governors，以CityId/FactionId為scope。市政廳Lv1才可委任；五方針balanced/economy/population/military/reserve改變真實正式命令優先度，不提供產量／人口／施工加成。Governor僅能操作其城市；失城／市政廳資格消失停用，無免費繼承組織權限。每世界小時刷新spent，四資源支出總額不得超budget、各資源付款後保留reserve；同小時重設不清spent，零預算及reserve方針不偷花費。

預算契約重用現有source legacyEngine.governorStep：總額上限＋四資源最低保留量，不新創收入百分比。玩家預設budget2400/reserve180來自city.ts.defaultGovernor，標示CALIBRATE而非新LOCKED平衡。AI沿用R2a既有自身20～50%可用資源决策；若正式候選job價格高於現有委任上限，可自願經同governance.set調高至該job真實總价，不合併庫存、不增加資源，亦不清同小時spent。Governor預算限制治理命令，玩家／AI仍可依法下達自身其他命令。

Gov使用同economicChoices及submitFormalOrder，正常建設／資源田／徵兵／科研／時代／City；修正planner的City晉升真實60k quote及精銳自動替換quote，未改任何正式價格。AI不重複由自治與總督操作同一城市經濟；補給透過正式市場商隊，外文明城堡只能由已生還取得且在城工匠付款、施工並完成消耗。

Persistence：Schema欄位optional保留R0/R1/R2a/R2b合法正式存檔。Worker新局啟用99AI；舊載入先保存啟用draft才發布。舊匯入／手動Recovery的啟用改在原政治／历史／存檔同一IDB交易，合併durable序號後配置新AI事件，避免第二筆啟用保存失敗留下已切換的存檔。故障、retry、rolled-back命令去重均沿用既有Authority。

UI：正式治理頁及市政廳接入GovernorControls：方針、支出上限、保留量、状态、當小時spent、委任／套用／停止；僅玩家實際持有城市、50城分頁。保留商隊頁、原正式美術／三主題／手机布局。DOM測試是真實React+happy-dom；未冒稱瀏覽器／實機PASS，該項留R3。

本輪正式完整Regression：78檔857項PASS、0FAIL；typecheck/build PASS。範圍Formal全部、Presentation全部、Developer全部、saveLock、useGameInteraction、interaction、worldStream。857是本輪fresh JSON，不使用遺失856／歷史831。另targeted23PASS、Worker-targeted68PASS。初次完整806PASS/48FAIL保留在Evidence；失敗集中舊Worker測試R1 revision與新增AI啟用提交不一致。測試改用已持久化AImetadata的獨立B4/B5 fixture，自治事件延後至30天，保留全部舊付款／deadline／未提交不可見斷言。新獨立runtime案例驗證真正AI啟用保存／失敗／retry；實際AI+gov、1/3/6/10/50X、SaveLoad／IDB故障／Recovery／offline slicing亦獨立測試。

R3待做Formal方向動畫／野外終戰視覺、Art、真實瀏覽器。R4待做跨階段链与较大世界觀測、現代AI策略介面高風險抽查、B5 E1證據整理及AstraHandoff。B9兵種／認知／逆向／奇觀／終局執行仍未開始；不授予現代资格。長期政治分布與168/360/720h不以2h/短測代替。B5 E1 HOLD；Astra NOT_EXECUTED；Sites NOT_UPDATED。
