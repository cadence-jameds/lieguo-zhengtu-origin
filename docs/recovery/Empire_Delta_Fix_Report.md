# B6／B7 Empire Delta Fix｜R1

來源：RECONSTRUCTED_FROM_B7_V0.30.42。原 B6、B7 ZIP 不改動；原 B8 960fbbf 未恢复。R0 保存後已重新取得 ZIP 並驗證所有 961 項來源雜湊；保存的完整 Git bundle 亦已 clone 出 HEAD 4879ae65e36e0a63ef523e3c2518709b2be311b3。

Authority：2026-10-12 玩家帝國 Delta > v92（SHA256 2bb36aed23595b52b38e15ab5c76be883ec854c57517eaf61187af1f2c43e0e6）。受邀方不需使館11；v92 城堡時代、合法軍團長及使館1等其他既有條件保留。

| 分類 | 範圍 | 結果 |
|---|---|---|
| KEEP | 帝國成立 | 合法軍團長城堡時代／使館11發起，第二團長接受才建國；發起者成領袖，最多3軍團、每團最多10人。 |
| KEEP | 2→1 | 原 EmpireId、外交、工程與既得現代資格保持；無不足狀態、倒數或強制退款，可再邀請。 |
| DELTA_FIX | 零軍團工程 | `syncEmpires` 統一通過 `cleanScopes` 刪除已失去帝國 owner 的 active largeProjects；不退還已投入資源、不移轉、無免費繼承。沒有加入 B9 命令或工程進度功能。 |
| DELTA_FIX | 帝國邀請 | 新邀請寫入 found／join 意圖、原 sourceLegionId；join 綁定 originEmpireId。接受重新驗證雙方年齡、政治資格、原組織、領袖與容量。found 不可默認變 join，join 不可默認變 found。 |
| DELTA_FIX | 舊存檔 | 新欄位 optional，合法舊存檔仍可讀。無法由既有資料推斷舊邀請曾屬哪個帝國，故保留 legacy invite、阻止接受；發起者重新發送是明確確認並換成有 scope 的新邀請。沒有猜測或默認創建帝國。 |
| DELTA_FIX | 滅國政治清理 | B7 `removePoliticalMember` 使用同一 sync／clean 路徑；退出、解散、最後軍團滅國、領袖退出／滅國及重播一致。仍保留既有殘軍、工匠、城堡、復國玩法。 |
| DELTA_FIX | 參照驗證 | 正式世界禁止保存不存在 Empire owner 的 active 工程。B1 無政治系統的純 fixture 仍可獨立驗證抽象工程 shape；不是可玩世界的繞過路徑。 |
| BLOCKER | 已知政治缺陷 | 本輪已修正；測試結果依 R1 Regression Evidence。 |
| PENDING | B8 | 尚未重建；只在 R1 持久封存／讀回成功後進入 R2。 |
| PENDING | Gate | B5 E1 HOLD；Astra NOT_EXECUTED；不得以工程自測宣告獨立 Gate PASS。 |

修改範圍：politics.ts、politicsSchema.ts、schema.ts、PoliticsView.tsx、帝國回歸測試、版本 metadata 及報告。共用清理位於既有原子 Formal transition 內；Scheduler 將失效 friendly 事件移除，已投入戰役的聯軍不被回溯撤销，且不恢復失效政治權限。Save/Load／IndexedDB／Recovery 與離線推進仍使用同一資料。

回歸：新增 17 項帝國案例及既有 B6／B7共35項 targeted PASS。完整本輪結果、typecheck／build與失敗紀錄請查外部 R1 Evidence，不能用歷史 B7 757／原 B8 831冒充本輪結果。

不可變：B5 主戰無回合硬上限、同BattleId最多12 Siege、v0.30.40精簡終戰戰報；B7流亡軍、逐兵種floor25%、每據點1工匠、正常付費外文明城堡、玩家48h復國；384×384、100勢力、432槽位。
