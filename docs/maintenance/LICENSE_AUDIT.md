# 授權與素材盤點

盤點基準：main `d5a6f544d87c0308c0105075f233bbfa0aeb1329`，2026-11-13。這是工程盤點，不是法律意見或授權證明。未新增專案授權。風險是待處理優先度，不代表侵權已成立。

| 項目／來源與使用 | 類型及義務 | 狀態／風險 | 建議與證據 |
|---|---|---|---|
| 專案程式與文件 | 根目錄未見 LICENSE；GitHub 公開可受平台條款影響，不構成一般再利用授權 | 已確認現況；中 | 負責人決定是否授權及範圍；不得以公開推定免費商用。見根目錄及 README。 |
| npm 直接及間接依賴 | lockfile 446 個套件路徑：MIT 385、ISC 16、Apache-2.0 10、BSD-3-Clause 7、BSD-2-Clause 5、BlueOak-1.0.0 8、0BSD 1、CC-BY-4.0 1、MPL-2.0 12、MIT OR CC0-1.0 1；各條款義務不同 | 欄位已確認，實際發行內容及通知待確認；中 | [逐條清單](NPM_LICENSE_INVENTORY.md)依 lockfile 而非實際 bundle；包含跨平台 optional 套件。MIT/BSD/ISC/Apache 等須核對對應版權及授權文字與 NOTICE。 |
| `dexie` 4.4.5 | Apache-2.0，正式依賴；散布時檢查授權副本、修改與適用 NOTICE | 條款欄位已確認；中 | `package-lock.json`、`node_modules/dexie/LICENSE`；以實際 build 追溯並加入合適第三方聲明。 |
| `lightningcss` 及平台 binary 1.32.0 | MPL-2.0，lockfile 標為 dev；是否改動或散布其 covered files 影響義務 | 套件欄位已確認；實際分發待確認；中 | 檢查構建工具及產物，若散布涵蓋檔案，依 MPL 保留通知並提供適用原始碼；不要把 dev 自動等同已部署。 |
| `caniuse-lite` 1.0.30001810 | CC-BY-4.0，標為 dev；散布該資料時需核對署名、授權連結及變更標示 | 發布包含與否待確認；中 | 追蹤資料是否進入輸出及其 upstream 通知。 |
| GPL／AGPL | 446 筆 lockfile 的 license 欄位未見 GPL／AGPL；不是完整程式來源鑑識 | 欄位確認；其他來源待確認；中 | 更新依賴時重掃；另檢查複製碼和 assets，勿將此結果推廣到所有內容。 |
| 複製的第三方程式 | 原始碼抽查、套件清單與來源搜尋不能證明不存在 | 待確認；中 | 負責人確認歷史匯入、外部片段與作者；對找到的來源保存授權與修改紀錄。 |
| 遊戲美術 | `ART_ASSETS.md` 記錄部分 imagegen 與系統字型；`docs/ART_V4_PROVENANCE.json`、`docs/ART_V060_PROVENANCE.json` 記錄部分來源與雜湊 | 部分有證據；整體權利及所有檔案覆蓋率待確認；高 | 對 `public/art` 全數建立檔案→生成紀錄／原始來源／服務條款／可用範圍對照；不得推論全部原創或享有獨占權。 |
| 截圖與社群圖 | `docs/validation/global-protection/1440-map.png` 為合成戰役的 Chromium 畫面；`docs/maintenance/images/world-map.webp` 是壓縮複本 | 拍攝與來源可追溯；底層素材權利仍待確認；中 | `docs/validation/global-protection/README.md`、`compatibility.json`；使用前一併確認畫面內素材權利。 |
| 字型、音效、圖示 | `ART_ASSETS.md` 記載系統字型、無新增外部音訊、M0 SVG；非全歷史驗證 | 部分記載；高 | 逐檔檢索外部字型、音訊、SVG 與圖示來源；系統字型由使用者系統提供也須區分打包情形。 |
| Pages／PWA 發布 | 構建包含第三方 JS 與靜態素材；預快取也是分發 | 授權通知是否完整待確認；高 | 對實際 production bundle 建立第三方通知及授權副本，核對來源與適用條款後隨網站發布；本次未假設現有聲明合規。 |
| AI 協作產出 | 工具使用紀錄不直接證明全部輸出的可保護性或獨占性 | 待確認；中 | 保留生成紀錄、輸入來源與適用條款；涉及商用或再授權時諮詢專業人士。 |

盤點方法：讀取 `package.json`、`package-lock.json` 的 `packages` 欄位，逐路徑彙總 `license`；未對每個上游條款與版本人工核驗，也未確認依賴授權欄位必然正確。圖像證據與輸出中的依賴需要後續逐項核對。沒有根 LICENSE 並不排除個別第三方授權。
