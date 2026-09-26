// ⚠️ 這個檔案是「自動產生」的,不要手動改——改了也會被蓋掉。
// 來源:review-log.json(要改日期/週期/說明就改那份);產生者:scripts/gen-audit-info.mjs(跑 npm test 時會自動更新)
// 用途:讓 App 顯示各類審查的上次日期與到期狀態(file:// 開檔不能 fetch JSON,所以包成 .js)。
window.REVIEW_LOG = {
  "_說明": "各類審查的「上次做的日期」與「多久該再做一次」。單一來源:App 設定頁的「🗓 審查紀錄」卡、計時頁的到期橫幅、npm run review-status 都讀這裡(App 讀的是 review-log.js,那是跑 npm test 時從這份自動產生的,不要手改)。做完某一類審查就把該類的 lastReviewedAt 改成當天、note 寫一行做了什麼,跟那次的修改一起 commit。全面體檢不記這裡(它有自己的計數 audit-count)。lastReviewedAt 寫 null 代表從沒做過。",
  "soonDays": 14,
  "categories": [
    {
      "id": "rules",
      "name": "規則審查",
      "scope": "CLAUDE.md 全文、.claude/agents/ 三個代理檔、index.html 的 AUDIT_PROMPT 體檢指令:規則之間有無矛盾、模糊、過時、不會觸發、缺漏;規則說的跟程式做的是否一致",
      "intervalDays": 90,
      "lastReviewedAt": "2026-09-08",
      "note": "24 項發現全部落地:第 29 條與第 28 條及程式相反、計數腳本只認標題列+未提交先算、兩條守門測試、代理檔對齊、localStorage key 表"
    },
    {
      "id": "features",
      "name": "功能實測",
      "scope": "在瀏覽器用眼睛逐項點過:計時(倒數/正計時/嚴格模式/慣例流程/快捷鍵)、混音器與 24 種音檔真的有聲音、任務清單、統計與熱力圖、健康提醒與呼吸伸展午睡、備份匯出匯入、深淺主題、手機尺寸排版;兩個功能同時開會不會打架",
      "intervalDays": 60,
      "lastReviewedAt": "2026-08-09",
      "note": "全面稽核那輪跑真 Firefox 實測並修四個設計問題(嚴格模式/正計時連跑/設定同步/休息音效);之後只有 09-08 看過設定頁截圖,沒有整輪用眼睛點過"
    },
    {
      "id": "data",
      "name": "資料與同步",
      "scope": "buildBackupData/mergeBackup/importBackup、墓碑、ghSyncedOk、舊備份(v1~v3)相容、localStorage 每個 key 的合併類別(CLAUDE.md 第 28 條表);拿具體情境跑:A 機刪 B 機合併不復活、同一小時兩筆相同紀錄不被吃掉、新裝置沒對帳不上傳、時鐘較快那台的設定仍同步得出去",
      "intervalDays": 90,
      "lastReviewedAt": "2026-08-09",
      "note": "全面稽核:修 8 個會弄丟/弄髒紀錄的問題(紀錄帶 id、ghSyncedOk、墓碑)+ 任務/情境/組合改取較新;09-08 只補了政策表與守門測試,沒重驗合併路徑"
    },
    {
      "id": "docs",
      "name": "說明與文案",
      "scope": "設定頁「使用說明」「實用建議」共 8 篇與統計頁 1 篇、畫面上的提示/空狀態/按鈕文字、README 功能行與音效出處表、AUDIT_PROMPT 描述的功能:還符合現在的行為嗎?有沒有繁簡異體字",
      "intervalDays": 90,
      "lastReviewedAt": "2026-08-09",
      "note": "全面稽核:11 處過時說明 + README 補功能清單;09-08 只改了體檢指令兩句"
    },
    {
      "id": "offline",
      "name": "離線與部署",
      "scope": "sw.js 的 FILES 與版本號、只刪 pomo- 前綴、manifest 與圖示、用 開啟本機伺服器.bat 斷網後真的開得起來、線上版 sw.js 版本與本機一致、三個測試工具(jsdom/selenium/geckodriver)有沒有新版、四個 .bat 都能跑",
      "intervalDays": 120,
      "lastReviewedAt": "2026-07-15",
      "note": "稽核抓到清快取會把同網域其他 App 的快取清光,改成只刪 pomo- 前綴;之後 FILES 有維護(09-08 加音效四方一致測試),但沒整輪核對 manifest/斷網實測/測試套件版本"
    }
  ]
};
