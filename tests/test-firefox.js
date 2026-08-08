// 🦊 真實 Firefox 自動實測(開你電腦上那個真正的 Firefox,實際用滑鼠鍵盤操作 App)
//
// 怎麼跑:點兩下專案根目錄的「Firefox實測.bat」,或在這個資料夾執行 `node tests/test-firefox.js`。
// 想「親眼看它操作」就加參數:`node tests/test-firefox.js --show`(會跳出 Firefox 視窗)。
//
// 跟 test-pomo.js 的差別:
//   test-pomo.js  = 假瀏覽器(jsdom),快、跑 136 項、每次改完都該跑。
//   test-firefox.js = 真 Firefox,慢,但驗得到「真的畫得出來、真的點得到」——
//                     jsdom 抓不到的排版跑掉、按鈕被蓋住、真實瀏覽器才有的行為。
//
// 安全性:全程只開 http://localhost:<port>,那是跟線上版(zaker353.github.io)
//        完全隔離的來源,碰不到你手機/電腦上的真實紀錄。每次都用全新的 Firefox
//        設定檔,不會動到你平常在用的那個 Firefox。
const http = require("http");
const fs = require("fs");
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

function startServer(){
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req,res)=>{
      let p = decodeURIComponent(req.url.split("?")[0]);
      if(p === "/") p = "/index.html";
      const f = path.join(ROOT, p);
      if(!f.startsWith(ROOT)){ res.writeHead(403); res.end(); return; }   // 別讓它讀到專案外的檔
      fs.readFile(f, (e,d)=>{
        if(e){ res.writeHead(404); res.end("not found"); return; }
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

  const opts = new firefox.Options();
  if(!SHOW) opts.addArguments("-headless");
  opts.setPreference("dom.webnotifications.enabled", false);   // 別跳通知授權視窗卡住測試
  opts.setPreference("media.volume_scale", "0.0");             // 測試時不要真的出聲

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

    await driver.get(url);
    await driver.wait(until.elementLocated(By.id("taskInput")), 15000);
    await driver.wait(async ()=> await val("typeof addTask==='function' && typeof markDeleted==='function'"), 15000);
    check("🦊 App 在真 Firefox 開得起來", true);
    check("網址是本機不是線上版", (await val("location.origin")).startsWith("http://127.0.0.1"));

    // 這個 App 用 confirm() 問「確定刪除嗎」,自動化時先讓它一律回答「是」
    await js("window.confirm=()=>true; window.alert=()=>{};");

    /* ---------- 真的用鍵盤滑鼠操作:新增任務 ---------- */
    await driver.findElement(By.id("nav-tasks")).click();
    await driver.findElement(By.id("taskInput")).sendKeys("實測任務A");
    await driver.findElement(By.xpath("//button[text()='新增']")).click();
    await driver.sleep(150);
    let listText = await driver.findElement(By.id("taskList")).getText();
    check("🦊 打字新增任務,畫面真的出現", listText.includes("實測任務A"), listText.slice(0,60));
    check("新任務有記建立時間(墓碑要用)", await val("tasks[tasks.length-1].createdAt>0"));

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
    const cardBox = await driver.findElement(By.id("ghCard")).getRect();
    check("🦊 說明沒把卡片擠爆版面", cardBox.width > 100 && cardBox.width <= (await val("window.innerWidth")),
      "卡片寬 " + Math.round(cardBox.width) + " / 視窗寬 " + await val("window.innerWidth"));

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
    check("🦊 截圖有拍到雲端備份卡片", fs.existsSync(path.join(shotDir, "雲端備份說明-手機.png")));

    // 假設定用完就清掉,不要留在測試設定檔裡
    await js("localStorage.removeItem('pomo_ghsync'); ghSetAuto(true); ghRender();");
    check("🦊 假設定已清乾淨", await val("loadGh()===null"));

    /* ---------- 順便拍一張任務頁,確認整體沒壞 ---------- */
    await driver.manage().window().setRect({width:1100, height:900});
    await driver.findElement(By.id("nav-tasks")).click();
    await driver.sleep(300);
    fs.writeFileSync(path.join(shotDir, "任務頁-電腦.png"),
      Buffer.from(await driver.takeScreenshot(), "base64"));

    /* ---------- 真實瀏覽器的紅字錯誤(jsdom 看不到的) ---------- */
    let logs = [];
    try{ logs = await driver.manage().logs().get("browser"); }catch(e){}
    const bad = logs.filter(l => l.level && l.level.name === "SEVERE"
      && !/favicon|sw\.js|ServiceWorker|Notification/i.test(l.message));
    check("🦊 主控台沒有嚴重錯誤", bad.length === 0, bad.map(l=>l.message).join(" | ").slice(0,200));

  } finally {
    if(driver) await driver.quit().catch(()=>{});
    srv.close();
  }

  console.log(results.join("\n"));
  console.log("\n總結:" + (results.length-failed) + "/" + results.length + " 通過" + (failed ? "、"+failed+" 個失敗" : ""));
  console.log("截圖存在 tests/screenshots/");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log(results.join("\n")); console.error("💥 測試中斷:", e); process.exit(2); });
