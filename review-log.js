// ⚠️ 這個檔案是「自動產生」的,不要手動改——改了也會被蓋掉。
// 來源:review-log.json(要改日期/週期/說明就改那份);產生者:scripts/gen-audit-info.mjs(跑 npm test 時會自動更新)
// 用途:讓 App 顯示各類審查的上次日期與到期狀態(file:// 開檔不能 fetch JSON,所以包成 .js)。
window.REVIEW_LOG = {
  "_說明": "各類審查的「上次做的日期」與「多久該再做一次」。單一來源:App 設定頁的「🗓 審查紀錄」卡、計時頁的到期橫幅、npm run review-status 都讀這裡(App 讀的是 review-log.js,那是跑 npm test 時從這份自動產生的,不要手改)。做完某一類審查就把該類的 lastReviewedAt 改成當天、note 整段換成這次做了什麼;用該類審查指令單獨整輪做完的,lastStandaloneAt 也改成當天、note 開頭寫「找到 N 條(會弄丟資料 M 條)」(判準見 CLAUDE.md 第 36 條),跟那次的修改一起 commit;只做了一部分就兩個日期都不要改,把做了哪些接在 note 尾巴。規則 09-08、功能實測 09-28 兩筆 lastStandaloneAt 是 2026-11-03 加欄位時追認的(當時還沒有「檢查指令本身」那一條,但都是只針對該類整輪做完)。全面體檢不記這裡(它有自己的計數 audit-count),但體檢收尾要把實際涵蓋到的類別 lastReviewedAt 一起更新(該類 scope 每一項都看過才算;lastStandaloneAt 不動)。lastReviewedAt 寫 null 代表從沒做過、lastStandaloneAt 寫 null 代表還沒單獨審查過。improveHint 是這一類的改良建議往哪找;declinedIdeas 是我否決過的建議(「YYYY-MM-DD 一句話」),審查指令會列出來叫 Claude 不要重提。",
  "soonDays": 14,
  "categories": [
    {
      "id": "rules",
      "name": "規則審查",
      "scope": "CLAUDE.md 全文、.claude/agents/ 三個代理檔、index.html 的 AUDIT_PROMPT 體檢指令與 reviewPrompt() 審查指令、review-log.json 本身(各類的範圍、週期、改良方向,五類之間有沒有重疊或沒人管的縫):規則之間有無矛盾、模糊、過時、不會觸發、缺漏;規則說的跟程式做的是否一致",
      "intervalDays": 90,
      "lastReviewedAt": "2026-09-08",
      "lastStandaloneAt": "2026-09-08",
      "note": "24 項發現全部落地:第 29 條與第 28 條及程式相反、計數腳本只認標題列+未提交先算、兩條守門測試、代理檔對齊、localStorage key 表",
      "improveHint": "規則能不能更短、更不容易被忘:哪條文字規則可以改成自動測試或腳本守門(程式擋比靠記得可靠)、哪幾條重複可以合併、哪條從來沒觸發過可以刪",
      "declinedIdeas": []
    },
    {
      "id": "features",
      "name": "功能實測",
      "scope": "在瀏覽器用眼睛逐項點過:計時(倒數/正計時/嚴格模式/慣例流程/快捷鍵)、混音器與 24 種音檔真的有聲音、任務清單、統計與熱力圖、健康提醒與呼吸伸展午睡、備份匯出匯入、深淺主題、手機尺寸排版;兩個功能同時開會不會打架",
      "intervalDays": 60,
      "lastReviewedAt": "2026-09-28",
      "lastStandaloneAt": "2026-09-28",
      "note": "第一次整輪用眼睛點過(計時/嚴格/正計時/慣例/混音器 24 音檔/任務/統計/健康/備份/主題/手機)+ pomo-auditor 查功能互動,兩輪獨立驗收;修 18 條:刪除紀錄與雲端還原鈕按不動、每輪分鐘數開始時定下、合併翻正計時押到輪末、嚴格模式先暫停再繞、暫停中改設定/合併不重設、提醒排隊且避開午睡呼吸護眼、午睡不改音量、休息加聲音不換專注組合、連續重整兩次不丟計時、匯入提示",
      "improveHint": "實際點過之後覺得卡的地方:流程要多點幾下、按鈕或資訊找不到、手機上太擠或字太小、某個數字或說明容易看錯、兩個功能同時開會互相打架",
      "declinedIdeas": []
    },
    {
      "id": "data",
      "name": "資料與同步",
      "scope": "buildBackupData/mergeBackup/importBackup、墓碑、ghSyncedOk、舊備份(v1~v3)相容、localStorage 每個 key 的合併類別(CLAUDE.md 第 28 條表);拿具體情境跑:A 機刪 B 機合併不復活、同一小時兩筆相同紀錄不被吃掉、新裝置沒對帳不上傳、時鐘較快那台的設定仍同步得出去",
      "intervalDays": 90,
      "lastReviewedAt": "2026-11-03",
      "lastStandaloneAt": null,
      "note": "全面稽核(2026-11-03,只改 lastReviewedAt):範圍整輪看過,兩三台假裝置實跑「刪了不復活/同一小時兩筆/沒對帳不上傳/時鐘較快」四個情境都成立;修 9 條:兩台都開著時上傳蓋掉另一台剛傳的(改成上傳前比對雲端版本代號、不同就先合併、帶代號上傳被搶先就 409)、匯入按取消照樣蓋雲端、換倉庫沿用舊對帳、匯入舊備份沒補 id 別台合併翻倍、合併/匯入把對方的修改時間蓋成現在、還原救不回誤刪(別台墓碑)、sw.js 與瀏覽器暫存讓舊的雲端回應冒充新的(真 Firefox 重現)、離線開 App 一聲不吭、存雲端設定的結果訊息被清掉;已知不修:空間滿時墓碑存不進去、刪掉的會復活(記入 CLAUDE.md 第 28 條)",
      "improveHint": "只收「更安全」的建議:哪條路徑還能多一道防線、哪個情境還沒有自動測試、備份與還原能不能更不容易出錯;不要為了好寫或好看提議重構備份、合併或雲端同步",
      "declinedIdeas": []
    },
    {
      "id": "docs",
      "name": "說明與文案",
      "scope": "設定頁「使用說明」「實用建議」與雲端備份教學共 9 篇、統計頁 1 篇、畫面上的提示/空狀態/按鈕文字、README 功能行與音效出處表、AUDIT_PROMPT 描述的功能:還符合現在的行為嗎?有沒有繁簡異體字",
      "intervalDays": 90,
      "lastReviewedAt": "2026-11-03",
      "lastStandaloneAt": null,
      "note": "全面稽核(2026-11-03,只改 lastReviewedAt):10 篇摺疊說明逐篇對過、畫面提示/確認框/橫幅/README 出處表/AUDIT_PROMPT 都比對,繁簡異體字腳本掃 0 處;修:說明篇數其實是設定頁 9+統計頁 1(四處寫 8)、刪除專注紀錄會同步有四處沒寫、雲端說明與還原訊息講錯、午睡提示關掉後變回舊句、功能總覽漏改名/三個開關/自動同步/看以前的備份/審查紀錄且多一串全形空白、刪紀錄不扣任務🍅、正計時一輪上限 4 小時沒提、README 功能行補 7 項",
      "improveHint": "說明好不好找、哪個按鈕旁邊缺一句話就容易用錯、說明裡的用詞跟畫面上的按鈕名稱不一致、哪篇說明太長不會有人看完",
      "declinedIdeas": []
    },
    {
      "id": "offline",
      "name": "離線與部署",
      "scope": "sw.js 的 FILES 與版本號、只刪 pomo- 前綴、manifest 與圖示、用 開啟本機伺服器.bat 斷網後真的開得起來、線上版 sw.js 版本與本機一致、三個測試工具(jsdom/selenium/geckodriver)有沒有新版、五個 .bat 都能跑",
      "intervalDays": 120,
      "lastReviewedAt": "2026-11-03",
      "lastStandaloneAt": null,
      "note": "全面稽核(2026-11-03,只改 lastReviewedAt):FILES 31 項對磁碟與 index.html 引用、圖示尺寸與 manifest、線上 sw.js/index.html/audit-info.js/review-log.js 與本機一致(curl);真 Firefox 用 serve.mjs 實測:清快取只刪 pomo-(英文學習/塔羅的留著)、伺服器關掉後首頁/index.html/音檔/manifest/圖示都從快取拿得到;五個 .bat 都實際跑過;npm outdated:jsdom 30、geckodriver 8 是大版、selenium 4.51 小版,npm audit 2 個高風險都在 jsdom 的相依(只用在測試、不連外)→不升;修:sw.js 連 GitHub 的回應也快取、錯誤回應也存(改成只管自己網站的 GET、只存成功的),並補 sw.js 行為測試(以前沒有任何測試守「只刪 pomo-」)",
      "improveHint": "部署與離線流程有沒有能更自動、更不容易漏步驟的地方(例:sw.js 的版本號靠手動 +1);測試工具升級只在有具體好處(修 bug、安全性)時才提",
      "declinedIdeas": [
        "2026-11-03 不升 jsdom 30／geckodriver 8，也不為 npm audit 在 jsdom 相依套件（undici 等）的警告升級：只用在本機跑測試、不連外、不進 App，大版升級反而可能弄壞兩套測試"
      ]
    }
  ]
};
