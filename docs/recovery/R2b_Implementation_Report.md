# R2b｜AI政治、軍事、拓殖與合法情報

從R2a Verified v0.30.46、commit 41a01ac56eea924b842ed80abb31e91327036a14 接續。ZIP SHA f4dd9339417092048e9bef7b2085fec23da1dc6a9e5133cc0fe428220f895eb3；bundle SHA 6904b5e6121ad1ed22f55039a6d7cee69ec6b7d90109192c514c329fc40b5bfe。重新取得、CRC、971來源逐檔驗證及clone均通過。來源工作樹失去後由正式bundle恢復，沒有重做R0/R1/R2a或偽造原B8 Git物件。

AI連續人格決策新增：军團建立／申請／邀請／接受／拒絕／退出、帝國found/join scoped邀請與接受、友好／解除／宣戰／停戰。全用原Formal政治命令；R1一軍團存續、零軍團工程／邀請清理不變；無操控其他成員城市或軍隊。退出仍走正式繼任；友好解除6世界小時不變。

合法情報介面：公開城市座標／人口／owner／现代化公開狀態、既有關係；來襲警報只有ArmyId、來源owner、目的地及arrivalAt，不暴露路上編成。Lv12軍團共享、Lv15帝國共享按正式使館檢查。自己實際戰報及合法共享可形成有限的信任／仇恨／威脅與最多32城市記憶；成功偵察只在斥候生還返程後交付。12h後confidence降低、24h後不使用精確比例；不掃描敵軍現有庫存、HP、內部耐久、科技、路上兵種。AI vs AI戰報先供合法記憶，再經原playerScope過濾，不永久保存無關完整報告。

軍事使用本城可動員軍隊、距離、警報、過期情報、資源、風險決定偵察／raid／conquest、野外掠奪、聯防／聯軍；保留本城主要守軍。Lv13正式reserve設置／dispatch、Lv14軍團joint／Lv15跨軍團協同，實際Formal路徑及waiting/depart事件，非瞬移。僅合法stationed援軍recall，不加入戰鬥途中撤退／士氣。拓殖使用正式付費整備及ready隊實際行軍、≥20護衛、土地／座標reservation，無免費城市或移民。

本批實際targeted：5檔49項PASS、0FAIL；typecheck/build PASS。包含R2a、R1帝國、B6政治、B7滅國；新增9項政治同權、emb1建國、接受／拒絕、退出繼任、Lv12信息隔離、Lv13實軍派遣、12/24h情報、反事實隱藏資料隔離、低活躍、AI vs AI真實raid、joint waiting、6h解除與斥候實際返程。完整B7、Persistence和UI全面回歸留R2c，不以歷史831／856宣告本批PASS。

CALIBRATE：AI決策概率、活動節奏、距離上限、軍力預備比例與預算延續R2a並使用可校準策略，不改变正式命令／成本／時程。Day30獨立5～10／帝國3～5等分布不強制湊數，長測留R4/B11。v92§10.8完整現代軍事生產與D3認知執行屬B9，未提前授予現代资格、兵種或逆向工程；已存在full資格僅影響征服選擇×1.75。

B5 E1 HOLD；Astra NOT_EXECUTED；R3/R4/B9未開始；Sites未修改。
