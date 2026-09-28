// 🦊 真實 Firefox 自動實測(開你電腦上那個真正的 Firefox,實際用滑鼠鍵盤操作 App)
//
// 怎麼跑:點兩下專案根目錄的「Firefox實測.bat」,或在這個資料夾執行 `node tests/test-firefox.js`。
// 想「親眼看它操作」就加參數:`node tests/test-firefox.js --show`(會跳出 Firefox 視窗)。
//
// 跟 test-pomo.js 的差別:
//   test-pomo.js  = 假瀏覽器(jsdom),快、項目多、每次改完都該跑。
//   test-firefox.js = 真 Firefox,慢,但驗得到「真的畫得出來、真的點得到」——
//                     jsdom 抓不到的排版跑掉、按鈕被蓋住、真實瀏覽器才有的行為。
//
// 安全性:全程只開 http://localhost:<port>,那是跟線上版(zaker353.github.io)
//        完全隔離的來源,碰不到你手機/電腦上的真實紀錄。每次都用全新的 Firefox
//        設定檔,不會動到你平常在用的那個 Firefox。
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SHOW = process.argv.includes("--show");

const results = [];
let failed = 0;
function check(name, cond, extra){
  results.push((cond?"✅":"❌")+" "+name+(extra?(" — "+extra):""));
  if(!cond) failed++;
}

const TYPES = {".html":"text/html; charset=utf-8", ".js":"text/javascript", ".json":"application/json",
  ".png":"image/png", ".mp3":"audio/mpeg", ".ico":"image/x-icon"};

// 頁面裡自己攔錯誤,存進 window.__errs。加 --inject-error 參數可以故意製造一個錯誤,
// 用來確認這個檢查真的會紅燈(不是永遠綠的裝飾)。
const ERR_COLLECTOR = '<script>window.__errs=[];'
  + 'window.addEventListener("error",function(e){window.__errs.push(String(e.message||e));});'
  + 'window.addEventListener("unhandledrejection",function(e){window.__errs.push("unhandled: "+String(e.reason));});'
  + '(function(){var o=console.error;console.error=function(){'
  + 'window.__errs.push(Array.prototype.join.call(arguments," "));return o.apply(console,arguments);};})();'
  + (process.argv.includes("--inject-error") ? 'setTimeout(function(){console.error("INJECTED-TEST-ERROR");},50);' : '')
  + '</script>';

function startServer(){
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req,res)=>{
      let p = decodeURIComponent(req.url.split("?")[0]);
      if(p === "/") p = "/index.html";
      const f = path.join(ROOT, p);
      if(!f.startsWith(ROOT)){ res.writeHead(403); res.end(); return; }   // 別讓它讀到專案外的檔
      fs.readFile(f, (e,d)=>{
        if(e){ res.writeHead(404); res.end("not found"); return; }
        // 由伺服器把「錯誤收集器」插在最前面。要這樣做是因為 geckodriver 不支援
        // 讀瀏覽器主控台(實測回 HTTP method not allowed),而且插在最前面才連
        // 載入期間的錯誤都抓得到。2026-08-09 全面稽核改。
        if(p === "/index.html"){
          d = Buffer.from(ERR_COLLECTOR + d.toString("utf8"), "utf8");
        }
        res.writeHead(200, {"Content-Type": TYPES[path.extname(f)] || "application/octet-stream"});
        res.end(d);
      });
    });
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", ()=>resolve({srv, port: srv.address().port}));
  });
}

(async () => {
  const {srv, port} = await startServer();
  const url = "http://127.0.0.1:" + port + "/index.html";

  // geckodriver:第一次會自動下載(約 5MB),之後從快取拿,不用網路
  const geckoPath = await require("geckodriver").download();
  const {Builder, By, until} = require("selenium-webdriver");
  const firefox = require("selenium-webdriver/firefox");

  // 匯出備份的檔案要落在這裡,測完就刪
  const dlDir = fs.mkdtempSync(path.join(os.tmpdir(), "pomo-download-"));

  const opts = new firefox.Options();
  if(!SHOW) opts.addArguments("-headless");
  opts.setPreference("dom.webnotifications.enabled", false);   // 別跳通知授權視窗卡住測試
  opts.setPreference("media.volume_scale", "0.0");             // 測試時不要真的出聲
  // 使用者平常是勾「下載前先問我要存哪」,但自動化時不能跳對話框(會卡住),
  // 所以測試時改成直接存到暫存資料夾——驗的是「匯得出正確的檔案」,
  // 「跳不跳存檔視窗」是 Firefox 自己的設定,不歸 App 管。
  opts.setPreference("browser.download.folderList", 2);
  opts.setPreference("browser.download.dir", dlDir);
  opts.setPreference("browser.download.useDownloadDir", true);
  opts.setPreference("browser.helperApps.neverAsk.saveToDisk", "application/json");

  let driver;
  try{
    driver = await new Builder().forBrowser("firefox")
      .setFirefoxService(new firefox.ServiceBuilder(geckoPath))
      .setFirefoxOptions(opts).build();

    // ⚠️ Firefox 的 WebDriver 只看得到掛在 window 上的東西,看不到 index.html 裡
    //    用 let 宣告的 tasks / tombs / favMixes…(函式看得到,變數看不到)。
    //    所以一律透過 window.eval 進到頁面自己的作用域執行。2026-08-08 踩過。
    const js  = code => driver.executeScript("window.eval(arguments[0])", code);
    const val = code => driver.executeScript("return window.eval(arguments[0])", "(" + code + ")");
    // 底部有固定的分頁列(body 已留 86px 空間,人手動捲下去點得到),
    // 但 selenium 是直接點元素中心、不會自己捲,位置剛好被蓋到就會 ElementClickIntercepted。
    // 所以一律先把元素捲到畫面正中間再點。2026-08-08 踩過。
    const clickSafely = async (locator) => {
      const el = await driver.findElement(locator);
      await driver.executeScript("arguments[0].scrollIntoView({block:'center'})", el);
      await driver.sleep(200);
      await el.click();
    };

    await driver.get(url);
    await driver.wait(until.elementLocated(By.id("taskInput")), 15000);
    await driver.wait(async ()=> await val("typeof addTask==='function' && typeof markDeleted==='function'"), 15000);
    check("🦊 App 在真 Firefox 開得起來",
      (await driver.findElement(By.id("time")).getText()).match(/^\d{1,2}:\d{2}$/) !== null,
      "計時顯示 " + await driver.findElement(By.id("time")).getText());
    check("網址是本機不是線上版", (await val("location.origin")).startsWith("http://127.0.0.1"));

    // 這個 App 用 confirm() 問「確定刪除嗎」,自動化時先讓它一律回答「是」
    await js("window.confirm=()=>true; window.alert=()=>{};");

    /* ---------- 真的用鍵盤滑鼠操作:新增任務 ---------- */
    await driver.findElement(By.id("nav-tasks")).click();
    await driver.findElement(By.id("taskInput")).sendKeys("實測任務A");
    await clickSafely(By.xpath("//button[text()='新增']"));
    await driver.sleep(150);
    let listText = await driver.findElement(By.id("taskList")).getText();
    check("🦊 打字新增任務,畫面真的出現", listText.includes("實測任務A"), listText.slice(0,60));
    check("新任務有記建立時間(墓碑要用)", await val("tasks[tasks.length-1].createdAt>0"));

    /* ---------- 真的按改名鈕 ---------- */
    await js("window.prompt=()=>'改好的名字';");
    await clickSafely(By.css("#taskList .rename-btn"));
    await driver.sleep(250);
    check("🦊 按改名鈕真的改得動,畫面也換了",
      (await driver.findElement(By.id("taskList")).getText()).includes("改好的名字"),
      (await driver.findElement(By.id("taskList")).getText()).slice(0,60));

    /* ---------- 真的按刪除鈕 ---------- */
    const delId = await val("tasks[tasks.length-1].id");
    await js("deleteTask(" + JSON.stringify(delId) + ")");
    await driver.sleep(150);
    listText = await driver.findElement(By.id("taskList")).getText();
    check("🦊 刪除後畫面真的不見了", !listText.includes("實測任務A"), listText.slice(0,60));
    check("🦊 刪除有立墓碑", await val("tombs.task[" + JSON.stringify(delId) + "]>0"));

    /* ---------- 核心:舊備份合併回來,刪掉的不可以復活 ---------- */
    await js(`
      tasks=[]; favMixes=[]; presets=[]; tombs=emptyTombs(); activeTask=null; saveData();
      tasks.push({id:'keepX',name:'要留著',done:false,pomos:0,est:0,createdAt:1000});
      tasks.push({id:'goneX',name:'要刪掉',done:false,pomos:0,est:0,createdAt:1000});
      favMixes.push({name:'實測組合',mix:{rain:60},createdAt:1000});
      presets.push({id:'psX',icon:'🎓',name:'實測情境',work:45,short:8,rounds:0,mix:null,createdAt:1000});
      saveData();
      window.__oldBackup = JSON.parse(JSON.stringify(buildBackupData()));
      deleteTask('goneX');
      markDeleted('fav','實測組合'); favMixes=favMixes.filter(f=>f.name!=='實測組合');
      markDeleted('preset','psX'); presets=presets.filter(p=>p.id!=='psX');
      saveData(); renderTasks(); renderFavs();
    `);
    await js("mergeBackup(window.__oldBackup); renderTasks(); renderFavs();");
    await driver.sleep(200);
    check("🦊 舊備份合併:刪掉的任務沒復活",
      await val("!tasks.some(t=>t.id==='goneX')"), "tasks=" + await val("JSON.stringify(tasks.map(t=>t.id))"));
    check("🦊 舊備份合併:沒刪的任務還在", await val("tasks.some(t=>t.id==='keepX')"));
    check("🦊 舊備份合併:刪掉的音效組合沒復活", await val("favMixes.length===0"));
    check("🦊 舊備份合併:刪掉的自訂情境沒復活", await val("presets.length===0"));
    // 畫面上也要真的看不到(資料對但畫面沒重畫 = 使用者還是看得到鬼影)
    listText = await driver.findElement(By.id("taskList")).getText();
    check("🦊 復活的東西畫面上也沒出現", !listText.includes("要刪掉") && listText.includes("要留著"), listText.slice(0,60));

    /* ---------- 別台裝置刪掉的,這台要跟著消失 ---------- */
    await js(`
      tasks=[{id:'mineX',name:'這台有的',done:false,pomos:0,est:0,createdAt:1000}];
      favMixes=[]; presets=[]; tombs=emptyTombs(); saveData(); renderTasks();
      mergeBackup({app:'pomodoro-whitenoise',version:4,sessions:[],tasks:[],favMixes:[],presets:[],
        tombs:{task:{mineX:9999999999999},fav:{},preset:{}}});
      renderTasks();
    `);
    await driver.sleep(200);
    check("🦊 別台刪掉的,這台同步後也消失", await val("tasks.length===0"),
      "tasks=" + await val("JSON.stringify(tasks)"));

    /* ---------- 刪掉後重建同名的,不可以被自己的墓碑誤殺 ---------- */
    await js(`
      favMixes=[]; tombs=emptyTombs(); saveData();
      favMixes.push({name:'雨夜',mix:{rain:60},createdAt:1000}); saveData();
      window.__b2 = JSON.parse(JSON.stringify(buildBackupData()));
      markDeleted('fav','雨夜'); favMixes=[]; saveData();
      favMixes.push({name:'雨夜',mix:{rain:80},createdAt:Date.now()+5000}); saveData();
      mergeBackup(window.__b2); renderFavs();
    `);
    check("🦊 刪掉後重建同名組合沒被誤殺",
      await val("favMixes.length===1 && favMixes[0].mix.rain===80"),
      "favMixes=" + await val("JSON.stringify(favMixes)"));

    /* ---------- 真實瀏覽器才驗得到:重新整理後墓碑還在 ---------- */
    await js("tasks=[]; tombs=emptyTombs(); markDeleted('task','reloadX'); saveData();");
    await driver.navigate().refresh();
    await driver.wait(until.elementLocated(By.id("taskInput")), 15000);
    await driver.wait(async ()=> await val("typeof tombs!=='undefined'"), 10000);
    check("🦊 重新整理後墓碑沒不見", await val("tombs.task['reloadX']>0"),
      "tombs=" + await val("JSON.stringify(tombs)"));

    /* ---------- 說明文字要真的畫得出來、看得到 ---------- */
    await driver.findElement(By.id("nav-settings")).click();
    await driver.sleep(300);
    // 新的說明文字只有在「已設定雲端備份」時才出現,所以要先讓卡片切到那個狀態。
    // 🔴 安全:先關掉自動同步(ghMarkDirty / ghAutoUpload 都會擋),再填一組
    //    根本不存在的假帳號——絕對不可以在測試環境填真的倉庫或金鑰,
    //    否則測試弄髒的資料會自動上傳蓋掉真實備份。看完馬上清掉。
    await js(`
      ghSetAuto(false);
      localStorage.setItem('pomo_ghsync', JSON.stringify(
        {owner:'firefox-test-not-a-real-user', repo:'firefox-test-not-a-real-repo', token:'FAKE'}));
      ghRender();
    `);
    await driver.sleep(200);
    const ghText = await driver.findElement(By.id("ghCard")).getText();
    check("🦊 雲端備份卡片真的顯示新說明", ghText.includes("不會再被另一台救回來"), ghText.slice(0,80));
    check("🦊 三顆按鈕都在", ghText.includes("上傳備份") && ghText.includes("下載並合併") && ghText.includes("下載並覆蓋"));
    // ⚠️ 不要驗 getRect().width <= innerWidth —— #ghCard 是 block 元素,寬度永遠等於父層,
    //    內容再怎麼溢出都不會超過,那樣寫永遠是綠的。要驗的是「內容有沒有撐爆容器」。
    const overflow = await val("(function(){var e=document.getElementById('ghCard');"
      + "return e.scrollWidth - e.clientWidth;})()");
    check("🦊 說明沒把卡片內容擠到溢出", overflow <= 2, "溢出 " + overflow + "px");

    /* ---------- 截圖:一定要拍到「這次改的東西」,不然截圖只是裝飾 ---------- */
    const shotDir = path.join(__dirname, "screenshots");
    if(!fs.existsSync(shotDir)) fs.mkdirSync(shotDir);
    const shoot = async (name) => {
      // 把卡片捲到畫面中間再拍,不然只會拍到頁面最上面、看不到重點
      await js("document.getElementById('ghCard').scrollIntoView({block:'center'})");
      await driver.sleep(400);
      fs.writeFileSync(path.join(shotDir, name), Buffer.from(await driver.takeScreenshot(), "base64"));
    };
    await shoot("雲端備份說明-電腦.png");

    /* ---------- 手機尺寸也要看得下去 ---------- */
    await driver.manage().window().setRect({width:390, height:844});
    await driver.sleep(500);
    check("🦊 手機尺寸下沒有左右跑版",
      await val("document.documentElement.scrollWidth <= window.innerWidth + 2"),
      "內容寬 " + await val("document.documentElement.scrollWidth") + " / 畫面寬 " + await val("window.innerWidth"));
    await shoot("雲端備份說明-手機.png");
    const shotSize = fs.statSync(path.join(shotDir, "雲端備份說明-手機.png")).size;
    const cardInView = await val("(function(){var r=document.getElementById('ghCard').getBoundingClientRect();"
      + "return r.top < window.innerHeight && r.bottom > 0;})()");
    check("🦊 截圖有拍到雲端備份卡片", shotSize > 20000 && cardInView === true,
      "檔案 " + Math.round(shotSize/1024) + "KB / 卡片在畫面內=" + cardInView);

    // 假設定用完就清掉,不要留在測試設定檔裡
    await js("localStorage.removeItem('pomo_ghsync'); ghSetAuto(true); ghRender();");
    check("🦊 假設定已清乾淨", await val("loadGh()===null"));

    /* ---------- ✨ 統計頁的兩個新區塊:真的畫得出來、真的點得到 ---------- */
    await js(`
      tasks=[{id:'tA',name:'讀多益',done:false,pomos:0,est:0,createdAt:1},
             {id:'tB',name:'寫程式',done:false,pomos:0,est:0,createdAt:1}];
      sessions=[{id:'q1',d:todayStr(),m:25,t:10,task:'tB'},
                {id:'q2',d:todayStr(),m:50,t:9,task:'tA'}];
      tombs=emptyTombs(); saveData(); renderStats();
    `);
    await driver.findElement(By.id("nav-stats")).click();
    await driver.sleep(400);
    const ttText = await driver.findElement(By.id("taskTimeList")).getText();
    check("🦊 任務時間統計真的畫得出來", ttText.includes("讀多益") && ttText.includes("50 分"), ttText.slice(0,70));
    check("🦊 時間長的排前面", ttText.indexOf("讀多益") < ttText.indexOf("寫程式"));
    await clickSafely(By.id("taRangeAll"));
    await driver.sleep(250);
    check("🦊 切換「全部」範圍按得動", await val("taskStatDays")===0);
    await clickSafely(By.id("taRange30"));
    // 紀錄清單在摺疊區裡 —— 要真的點開才看得到(自動測試常漏掉摺疊內容)
    await js("document.querySelectorAll('details.help.tool').forEach(e=>e.open=true);");
    await driver.sleep(300);
    const slText = await driver.findElement(By.id("sessionList")).getText();
    check("🦊 最近紀錄清單真的畫得出來", slText.includes("50") && slText.includes("讀多益"), slText.slice(0,70));
    // 真的按畫面上的 ✕(以前這裡直接呼叫函式,按鈕的 onclick 壞了兩個月沒人發現;2026-09-28 功能實測抓到)
    await js("window.confirm=()=>true;");
    await clickSafely(By.css("#sessionList button[onclick*='q2']"));
    await driver.sleep(300);
    check("🦊 按刪除後畫面真的少一筆",
      !(await driver.findElement(By.id("sessionList")).getText()).includes("讀多益"),
      (await driver.findElement(By.id("sessionList")).getText()).slice(0,60));
    check("🦊 刪除後統計也跟著扣掉",
      !(await driver.findElement(By.id("taskTimeList")).getText()).includes("讀多益"));
    // 拍一張給人看:截圖要拍到改動處,否則等於沒有證據
    await js(`
      tasks=[{id:'tA',name:'讀多益單字',done:false,pomos:0,est:0,createdAt:1},
             {id:'tB',name:'寫程式',done:false,pomos:0,est:0,createdAt:1},
             {id:'tC',name:'看書',done:true,pomos:0,est:0,createdAt:1}];
      sessions=[{id:'w1',d:todayStr(),m:50,t:9,task:'tA'},{id:'w2',d:todayStr(),m:25,t:10,task:'tB'},
                {id:'w3',d:todayStr(-1),m:75,t:14,task:'tA'},{id:'w4',d:todayStr(-1),m:30,t:20,task:'tC'},
                {id:'w5',d:todayStr(-2),m:25,t:11}];
      saveData(); renderStats();
      document.querySelectorAll('details.help.tool').forEach(e=>e.open=true);
      document.getElementById('taskTimeList').scrollIntoView({block:'center'});
    `);
    await driver.sleep(500);
    fs.writeFileSync(path.join(__dirname, "screenshots", "任務時間統計.png"),
      Buffer.from(await driver.takeScreenshot(), "base64"));
    await js("document.getElementById('sessionList').scrollIntoView({block:'center'});");
    await driver.sleep(400);
    fs.writeFileSync(path.join(__dirname, "screenshots", "紀錄可刪除.png"),
      Buffer.from(await driver.takeScreenshot(), "base64"));
    await js("tasks=[]; sessions=[]; tombs=emptyTombs(); saveData(); renderStats();");
    await driver.findElement(By.id("nav-settings")).click();
    await driver.sleep(300);

    /* ---------- 🔍 全面體檢:真實瀏覽器才驗得到「外部檔真的載進來了」 ---------- */
    // jsdom 不會載入 <script src="audit-info.js">(測試裡是手動注入的),
    // 所以「這個檔到底載不載得起來」只有真瀏覽器驗得到 —— 路徑寫錯就會在這裡爆。
    check("🦊 體檢計數檔真的被瀏覽器載進來", await val("!!window.AUDIT_INFO && typeof window.AUDIT_INFO.count==='number'"),
      "AUDIT_INFO=" + await val("JSON.stringify(window.AUDIT_INFO||null)"));
    const auditText = await driver.findElement(By.id("auditCard")).getText();
    check("🦊 設定頁真的畫出體檢區塊", auditText.includes("複製體檢指令") && /\d+ 次改動/.test(auditText),
      auditText.slice(0,70));
    // 真的按下複製鈕(Firefox 對 file:// 以外的來源允許寫剪貼簿)
    await js("navigator.clipboard.writeText=(t)=>{window.__copied=t; return Promise.resolve();};");
    await clickSafely(By.xpath("//button[contains(., '複製體檢指令')]"));
    await driver.sleep(300);
    const copied = await val("window.__copied||''");
    check("🦊 按下複製鈕真的把指令送進剪貼簿", copied.length > 500 && copied.includes("全面稽核"),
      "複製了 " + copied.length + " 個字");
    check("🦊 複製後有給使用者回饋", (await driver.findElement(By.id("toast")).getText()).includes("已複製"),
      await driver.findElement(By.id("toast")).getText());
    await js("document.getElementById('auditCard').scrollIntoView({block:'center'})");
    await driver.sleep(400);
    fs.writeFileSync(path.join(__dirname, "screenshots", "全面體檢區塊.png"),
      Buffer.from(await driver.takeScreenshot(), "base64"));

    /* ---------- 🗓 審查紀錄:外部檔真的載進來、卡片真的畫出來(2026-09-27) ---------- */
    check("🦊 審查紀錄檔真的被瀏覽器載進來", await val("!!window.REVIEW_LOG && Array.isArray(window.REVIEW_LOG.categories) && window.REVIEW_LOG.categories.length>0"));
    const firstReviewName = await val("(window.REVIEW_LOG.categories[0]||{}).name||''");
    const reviewText = await driver.findElement(By.id("reviewCard")).getText();
    check("🦊 設定頁真的畫出審查紀錄卡", firstReviewName && reviewText.includes(firstReviewName) && reviewText.includes("指令"), reviewText.slice(0,60));
    await js("document.getElementById('reviewCard').scrollIntoView({block:'center'})");
    await driver.sleep(400);
    fs.writeFileSync(path.join(__dirname, "screenshots", "審查紀錄卡.png"),
      Buffer.from(await driver.takeScreenshot(), "base64"));

    /* ---------- 匯出備份:真的按下去,真的要有檔案掉出來 ---------- */
    // 先放一點資料進去,才驗得出「匯出的內容是對的」
    await js(`
      tasks=[{id:'exportX',name:'匯出測試任務',done:false,pomos:2,est:0,createdAt:1000}];
      tombs=emptyTombs(); markDeleted('task','tombX'); saveData();
    `);
    await clickSafely(By.xpath("//button[contains(., '匯出備份')]"));
    // 等檔案真的「寫完」。Firefox 是先建檔再慢慢寫,一看到檔名就去讀會讀到半截,
    // 所以要等到內容 parse 得起來為止(2026-08-08 踩過,一開始 4 項假失敗)。
    let dlFile = null, parsed = null;
    for(let i=0; i<40 && !parsed; i++){
      const found = fs.readdirSync(dlDir).filter(f => f.endsWith(".json"));
      if(found.length){
        dlFile = path.join(dlDir, found[0]);
        try{ parsed = JSON.parse(fs.readFileSync(dlFile, "utf8")); }catch(e){ parsed = null; }
      }
      if(!parsed) await driver.sleep(250);
    }
    check("🦊 按匯出備份,真的有檔案下載下來", !!dlFile, dlFile ? path.basename(dlFile) : "等 10 秒都沒出現");
    if(dlFile){
      check("🦊 檔名是看得懂的中文日期檔名", /^番茄鐘備份_\d{4}-\d{2}-\d{2}\.json$/.test(path.basename(dlFile)),
        path.basename(dlFile));
      check("🦊 匯出的檔案打得開、格式正確", !!parsed && parsed.app === "pomodoro-whitenoise" && parsed.version === 4);
      check("🦊 匯出的內容真的有我的資料", !!parsed && (parsed.tasks||[]).some(t => t.id === "exportX"));
      check("🦊 匯出的檔案有帶墓碑(否則刪除同步不到別台)", !!parsed && !!parsed.tombs && parsed.tombs.task.tombX > 0);
      check("🦊 匯出檔案絕不含 GitHub 金鑰", !!parsed && !JSON.stringify(parsed).includes("ghsync")
        && !JSON.stringify(parsed).toLowerCase().includes("token"));
    }

    /* ---------- 順便拍一張任務頁,確認整體沒壞 ---------- */
    await driver.manage().window().setRect({width:1100, height:900});
    await driver.findElement(By.id("nav-tasks")).click();
    await driver.sleep(300);
    fs.writeFileSync(path.join(shotDir, "任務頁-電腦.png"),
      Buffer.from(await driver.takeScreenshot(), "base64"));

    /* ---------- 真實瀏覽器的紅字錯誤(jsdom 看不到的) ---------- */
    // ⚠️ 不要用 driver.manage().logs().get("browser") —— geckodriver 不支援這個端點,
    //    會丟 "HTTP method not allowed",被 catch 吞掉後永遠是空陣列 = 永遠綠燈
    //    (2026-08-09 全面稽核實測)。改成在頁面裡自己攔截。
    const pageErrs = await val("JSON.stringify(window.__errs||[])");
    const bad = JSON.parse(pageErrs).filter(m => !/favicon|sw\.js|ServiceWorker|Notification/i.test(m));
    check("🦊 頁面沒有噴出錯誤", bad.length === 0, bad.join(" | ").slice(0,200));

  } finally {
    if(driver) await driver.quit().catch(()=>{});
    srv.close();
    try{ fs.rmSync(dlDir, {recursive:true, force:true}); }catch(e){}   // 清掉下載的暫存檔
  }

  console.log(results.join("\n"));
  console.log("\n總結:" + (results.length-failed) + "/" + results.length + " 通過" + (failed ? "、"+failed+" 個失敗" : ""));
  console.log("截圖存在 tests/screenshots/");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log(results.join("\n")); console.error("💥 測試中斷:", e); process.exit(2); });
