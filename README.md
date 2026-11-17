# CLOSETÉ — My Digital Wardrobe

衣櫃 App：資料存喺 Google Sheets，相片存喺 Google Drive，後端用 Google Apps Script。

可以用兩個方法開：

- **PWA（推薦）**：GitHub Pages 網址，可以「加到主畫面」，用起嚟似一個 App
- **Apps Script 網址**：直接喺瀏覽器開

兩個版本嘅介面一樣，都係由 `src/app.html` 整出嚟。

## 檔案

| 路徑 | 用途 |
| --- | --- |
| `apps-script/Code.gs` | 後端，貼入 Apps Script 嘅 `代碼.gs` |
| `apps-script/Index.html` | 網頁版介面，貼入 Apps Script 嘅 `Index`（自動產生） |
| `site/` | PWA，GitHub Pages 會發佈呢個資料夾（自動產生） |
| `src/app.html` | 介面嘅原始碼，**要改介面就改呢個** |
| `scripts/build.mjs` | `node scripts/build.mjs`：由 `src/app.html` 產生上面兩個版本 |

## 第一次設定

### 1. Apps Script

1. 將 `apps-script/Code.gs` 同 `apps-script/Index.html` 嘅內容，分別貼入你個 Apps Script 專案嘅 `代碼.gs` 同 `Index`，然後儲存。
2. 喺上面個下拉選單揀 **`setupApiToken`** → 按 **執行** → 批准權限。
3. 喺「執行記錄」會見到 `CLOSETÉ 密碼：xxxxxxxx`，抄低佢。
4. **部署 → 新增部署作業** → 類型揀「網頁應用程式」
   - 執行身分：**我**
   - 誰可以存取：**所有人**（PWA 要用到；冇密碼嘅人一樣睇唔到、改唔到）
5. 抄低以 `/exec` 結尾嘅網址。

> 之後每次改咗 `Code.gs`：**部署 → 管理部署作業 → ✏️ → 版本揀「新版本」→ 部署**。咁樣網址唔會變。

### 2. GitHub Pages（只需做一次）

**Settings → Pages → Build and deployment → Source** 揀 **GitHub Actions**。

之後每次 push 去 `main`，`site/` 都會自動發佈去：

`https://joejoe66-bot.github.io/closete-pwa/`

### 3. 喺手機安裝

1. 用手機開上面個網址，貼入 `/exec` 網址同密碼，然後按 **Connect**。
2. **iPhone**：Safari → 分享 → **加至主畫面**
   **Android**：Chrome ⋮ → **安裝應用程式**

網址同密碼只會儲存喺嗰部機。

## 功能

- 總覽：統計數字、最近加入
- 衣櫃：搜尋、按類別或 ♥ 收藏篩選、排序（最新、最多著、最少著、最近著、價錢、名稱）
- 每件衫兩張相：衫嘅相、牌子／標籤相（卡片左下角會顯示細圖，按張相可以睇大圖）
- 「Wore it」：記錄著衫次數同最後一次著嘅日期
- 刪除：要按兩下先刪得，Drive 入面嘅相會一齊放入垃圾桶
- 離線：會顯示上次載入嘅資料，但要有網絡先改得

## 安全

- 所有讀寫都要密碼。想換密碼，就喺 Apps Script 執行 `resetApiToken`，之後每部機都要重新輸入。
- 相片設為「知道連結的人可檢視」，因為 App 要直接顯示張相。
- `index.html` 有設定 `noindex`，但呢個只係叫搜尋器唔好收錄，唔等於有密碼保護。真正嘅保護係上面嗰個密碼。

## 修改介面

```bash
# 改 src/app.html，然後：
node scripts/build.mjs
```

將新嘅 `apps-script/Index.html` 貼返入 Apps Script，再 commit 同 push（`site/` 會自動更新）。
