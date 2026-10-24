# 手機導覽 UI 自訂改版交付紀錄

日期：2026-10-24（Asia/Taipei）。Base：`360e8621d1ac4ac1c2e1bea345a2b87c5f6d6048`（施工前已透過 GitHub 確認為最新 main）。功能分支：`feat/mobile-navigation-customization`；最終 HEAD 以 Draft PR 與交付訊息所列 SHA 為準。

本次只調整手機導覽與其驗收工具。未修改遊戲核心、AI、戰報資料庫、已讀規則、B9 終局或正式遊戲規格；沒有開始 80 項任務系統。未合併 main，未部署 Pages。

## 完成行為

- 預設六項：地圖、城市、軍隊、戰報、科技、軍團。可選任意零至六項，使用向前／向後按鈕排序；儲存後套用，取消可放棄修改。
- 一般按鈕沿用原版實際寬度 `max(66px, (100vw - 36px) / 5)` 與 58px 高度，沒有為六項壓縮尺寸。更多固定於最右側，為 48×58px 觸控範圍，位於滑動軌道之外。
- 左右觸控滑動、箭頭與 scroll snap 保留；導航切換及旋轉／尺寸改變會將目前功能定位至箭頭之外的可見區域。
- 偏好使用獨立 localStorage key `lieguo.mobile-shortcuts.v1`。重整、讀取戰役或重新進入仍保留，不寫入戰役存檔。損壞資料安全處理；無法儲存時明示只在本次開啟期間有效。
- 更多沿用「戰役總覽」：保留首頁、戰役設定、世界時間、速度與玩家勢力。動態加入未選功能、自訂入口；任務未選入時仍可進入。戰役設定入口始終保留。
- `NavigationReminders<View>` 分別提供各功能的 `count` 與 `attention`。快捷列顯示自己的提醒；更多彙總隱藏功能，展開後各功能仍顯示自己的提醒。本次正式資料僅接入既有戰報 unread／alerts；任務、軍團與外交提醒只有介面，沒有產生任何新通知或任務。
- 桌機仍顯示原有十個導覽項目。系統減少動態效果會停止提醒動畫，箭頭改為立即捲動。

## 驗證結果

- Typecheck：通過。
- 相關 UI／戰報測試：15 通過、0 失敗（手機導覽 12、既有戰報測試 3）。
- 完整隔離回歸最終輪：**1,858 通過、0 失敗、1 略過（通過）**。初次為 1,857 通過、1 項既有開發者速度／AI catch-up 測試超過 30 秒時限（36.97 秒）、1 略過；同一案例以原時限單獨重跑 17.00 秒通過，之後停止並行瀏覽器／Build 再跑完整套件。未修改 AI、核心程式或測試時限。
- 正式 Build：通過。另檢查 project Pages 路徑與 release 產物一致性；只建置，不部署。
- Chromium 正式建置驗收：10 組通過、0 失敗、0 page errors，含八組手機尺寸、桌機及 reduced-motion；另在 390px 情境內實際旋轉至 932px、320px 並返回 390px，驗證目前項目仍完整可見。

[完整測試紀錄](tests.json) · [初次回歸完整紀錄](https://github.com/cadence-jameds/lieguo-zhengtu-origin/blob/f75c119446b3df26feb00927ab80905ad1fdb77b/docs/validation/mobile-navigation-customization/tests.json) · [瀏覽器結果與實測幾何](browser.json) · [實際修改檔案清單](FILES.txt)

所有手機情境皆透過實際 GameApp、Worker 與 IndexedDB 匯入合成戰役，使用 CDP touch events 滑動；驗證固定更多位置、首尾點擊、箭頭邊界、原有更多內容、移除與重新加入、排序、五項配置、重整及重新讀取戰役。戰報頁進入後未讀仍為 1，展開既有報告後才依原規則標記已讀。

截圖來自未提交預覽建置（Base 加本次最終程式內容，release metadata 為 dirty preview）；不是正式部署或發行版證據。合成戰役的資源、人口、戰報均為測試資料，不是玩家私人存檔。

## 手機截圖

| 直向尺寸 | 原版一般按鈕寬 × 高 | 快捷列 | 自訂 | 更多與未讀 | 重載後 |
| --- | --- | --- | --- | --- | --- |
| 320×568 | 66×58 | [截圖](320x568-shortcuts.jpg) | [截圖](320x568-customize.jpg) | [截圖](320x568-more-unread.jpg) | [截圖](320x568-reloaded.jpg) |
| 360×640 | 66×58 | [截圖](360x640-shortcuts.jpg) | [截圖](360x640-customize.jpg) | [截圖](360x640-more-unread.jpg) | [截圖](360x640-reloaded.jpg) |
| 390×844 | 70.8×58 | [截圖](390x844-shortcuts.jpg) | [截圖](390x844-customize.jpg) | [截圖](390x844-more-unread.jpg) | [截圖](390x844-reloaded.jpg) |
| 430×932 | 78.8×58 | [截圖](430x932-shortcuts.jpg) | [截圖](430x932-customize.jpg) | [截圖](430x932-more-unread.jpg) | [截圖](430x932-reloaded.jpg) |

| 橫向尺寸 | 快捷列 | 自訂 | 更多與未讀 | 重載後 |
| --- | --- | --- | --- | --- |
| 568×320 | [截圖](568x320-shortcuts.jpg) | [截圖](568x320-customize.jpg) | [截圖](568x320-more-unread.jpg) | [截圖](568x320-reloaded.jpg) |
| 640×360 | [截圖](640x360-shortcuts.jpg) | [截圖](640x360-customize.jpg) | [截圖](640x360-more-unread.jpg) | [截圖](640x360-reloaded.jpg) |
| 844×390 | [截圖](844x390-shortcuts.jpg) | [截圖](844x390-customize.jpg) | [截圖](844x390-more-unread.jpg) | [截圖](844x390-reloaded.jpg) |
| 932×430 | [截圖](932x430-shortcuts.jpg) | [截圖](932x430-customize.jpg) | [截圖](932x430-more-unread.jpg) | [截圖](932x430-reloaded.jpg) |

[旋轉後目前功能定位](rotation-returned.jpg) · [減少動態效果](reduced-motion.jpg) · [桌機 1440×900](desktop.jpg)

## 修改檔案

產品與測試：

- `src/game/MobileNavigation.tsx`：固定更多、各功能提醒、箭頭避讓及旋轉定位。
- `src/game/mobileNavigationPreferences.ts`：本機偏好、驗證與儲存錯誤處理。
- `src/game/MobileNavigationSettings.tsx`：原有更多內容、隱藏功能與快捷列設定介面。
- `src/game/NavigationReminder.tsx`：獨立提醒介面、彙總與徽記。
- `src/game/GameApp.tsx`：偏好與現有戰報狀態接線。
- `src/game/presentation/Shell.tsx`：手機快捷列傳入，桌機導覽保留。
- `src/game/game.css`：手機尺寸、固定更多、自訂視窗與減少動態效果。
- `src/game/MobileNavigation.test.tsx`：12 項導覽／偏好／提醒／桌機與定位測試。

其他：兩個重現腳本、一個玩家更新摘要，以及本資料夾的報告、JSON 紀錄與 35 張截圖。完整逐檔清單見 [FILES.txt](FILES.txt)。

## 重現方式

使用 Node 22.13 以上、`npm ci`，並提供外部 Playwright 的 `index.mjs` 路徑；Chromium 預設為 `/usr/bin/chromium`，可用 `CHROMIUM_PATH` 指定。

```sh
npm run typecheck
node scripts/verify-in-isolation.mjs full
npm run build
node scripts/check-release-build.mjs
node scripts/prepare-mobile-navigation-fixture.mjs /tmp/mobile-navigation.realm-save
npm run preview -- --host 127.0.0.1 --port 4173
```

另一個終端執行：

```sh
node scripts/verify-mobile-navigation-browser.mjs /absolute/path/to/playwright/index.mjs /tmp/mobile-navigation.realm-save /tmp/mobile-navigation-evidence
```

Project Pages 路徑檢查（不部署）：

```sh
GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin npm run build
GITHUB_ACTIONS=true GITHUB_REPOSITORY=cadence-jameds/lieguo-zhengtu-origin node scripts/check-pages-build.mjs
node scripts/check-release-build.mjs
```

## 已知問題與驗收邊界

- 目前手機導航驗收未發現尚未修復的功能問題。瀏覽器模擬通過不代表手機實機驗收通過；iOS Safari、Android Chrome／安裝 PWA、瀏海／安全區、實際觸控與旋轉、系統減少動態效果仍待玩家實測。
- 全套的 1 項略過為既有私人晚期戰役六小時驗證，環境未提供 `REALM_REGRESSION_SAVE`；沒有新增略過或修改此案例。初次回歸的 AI 速度案例超時紀錄保留，詳細結果見 JSON。
- 任務待領獎勵、軍團待處理與外交待處理提醒尚未正式接入，只有導覽介面；本次沒有實作或承諾完成對應系統。
- repository 的歷史驗收狀態保留：B5 E1 為 HOLD，Astra Gate 不是 PASS，實機測試待完成。本次 UI 驗收不改寫這些狀態。
- 待 GPT-6 中控審查與玩家實機驗收；本次交付 Draft PR 後停止，不自行合併或部署。
