// 番茄鐘 App 自動功能測試(jsdom 模擬瀏覽器 + 假的 Web Audio / GitHub API)
//
// 怎麼跑:點兩下專案根目錄的「執行測試.bat」,或在這個資料夾執行 `node tests/test-pomo.js`。
// 第一次跑需要網路(自動安裝 jsdom),之後離線也能跑。
// 全部通過會顯示「總結:N/N 通過」;有壞掉會列出 ❌ 並回傳錯誤碼。
//
// ⚠️ 改完 index.html 一定要跑一次,確認沒有弄壞既有功能(尤其是會弄丟學習紀錄的部分)。
const fs = require("fs");
const path = require("path");
const { TextEncoder, TextDecoder } = require("util");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function fakeParam(v){ return {value:v, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){}}; }
class FakeNode {
  constructor(){ this.gain=fakeParam(1); this.frequency=fakeParam(0); this.Q=fakeParam(0); this.playbackRate=fakeParam(1); this.type=""; this.buffer=null; this.loop=false; this.loopStart=0; this.loopEnd=0; }
  connect(){} disconnect(){} start(){} stop(){}
}
class FakeAudioContext {
  constructor(){ this.sampleRate=44100; this.state="running"; this.currentTime=0; this.destination=new FakeNode(); }
  resume(){ return Promise.resolve(); }
  createGain(){ return new FakeNode(); }
  createOscillator(){ return new FakeNode(); }
  createBiquadFilter(){ return new FakeNode(); }
  createBufferSource(){ return new FakeNode(); }
  createBuffer(ch,len){ const arr=new Float32Array(len); return {getChannelData:()=>arr}; }
  decodeAudioData(arr, ok, err){ ok({duration:10, getChannelData:()=>new Float32Array(10)}); }
}

const results = [];
let failed = 0;
function check(name, cond, extra){
  results.push((cond?"✅":"❌")+" "+name+(extra?(" — "+extra):""));
  if(!cond) failed++;
}

function makeDom(presetStore){
  return new JSDOM(html, {
    runScripts:"dangerously", pretendToBeVisual:true, url:"http://localhost:8931/",
    beforeParse(window){
      window.AudioContext = FakeAudioContext;
      // 真實瀏覽器都有 TextEncoder(雲端備份轉 base64 要用),但舊版 jsdom 沒有 →
      // 少了這行,雲端備份的測試會假失敗(2026-07-15 踩過)。
      if(!window.TextEncoder) window.TextEncoder = TextEncoder;
      if(!window.TextDecoder) window.TextDecoder = TextDecoder;
      window.__fetchFail = false;
      window.__ghFail = false;
      window.__ghFiles = {};  // 假的 GitHub 倉庫:path -> 檔案內容字串
      window.fetch = (url, opts) => {
        url = String(url); opts = opts || {};
        if (url.includes("api.github.com")) {
          if (window.__ghFail) return Promise.resolve({ok:false, status:401, json:()=>Promise.resolve({})});
          if ((opts.method||"GET") === "PUT") {
            const body = JSON.parse(opts.body);
            const path = decodeURIComponent(url.split("/contents/")[1]);
            window.__ghFiles[path] = Buffer.from(body.content, "base64").toString("utf8");
            return Promise.resolve({ok:true, status:200, json:()=>Promise.resolve({})});
          }
          const tail = url.split("/contents/")[1] || "";
          if (tail === "") {
            const names = Object.keys(window.__ghFiles);
            if (!names.length) return Promise.resolve({ok:false, status:404, json:()=>Promise.resolve([])});
            return Promise.resolve({ok:true, status:200, json:()=>Promise.resolve(names.map(n=>({name:n, sha:"abc"})))});
          }
          const p = decodeURIComponent(tail);
          if (!window.__ghFiles[p]) return Promise.resolve({ok:false, status:404, json:()=>Promise.resolve({})});
          return Promise.resolve({ok:true, status:200, json:()=>Promise.resolve(JSON.parse(window.__ghFiles[p]))});
        }
        return window.__fetchFail
          ? Promise.reject(new Error("fetch fail"))
          : Promise.resolve({ok:true, arrayBuffer:()=>Promise.resolve(new ArrayBuffer(8))});
      };
      window.confirm = () => true;
      window.alert = (m) => { window.__lastAlert = m; };
      window.prompt = () => "我的組合";
      window.URL.createObjectURL = () => "blob:fake";
      window.URL.revokeObjectURL = () => {};
      window.HTMLAnchorElement.prototype.click = function(){ window.__lastDownload = this.download; };
      if(presetStore) Object.keys(presetStore).forEach(k=>window.localStorage.setItem(k,presetStore[k]));
    }
  });
}

const dom = makeDom(null);
const w = dom.window, d = w.document;
const E = code => w.eval(code);
const sleep = ms => new Promise(r=>setTimeout(r,ms));

// 測試資料的日期一律用「距今幾天」算,不可以寫死日期——
// 寫死的話換一天跑就會假失敗(週報只看「上週」,2026-07-15 踩過)。
// 剛好 7 天前必定落在「上週」(同一個星期幾,往前推一週),不管今天星期幾都成立。
function daysAgoStr(n){
  const dt = new Date(); dt.setDate(dt.getDate() - n);
  return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0");
}
const LAST_WEEK_DAY = daysAgoStr(7);

(async ()=>{
  // 1. 初始化
  check("頁面初始化(計時顯示 25:00)", d.getElementById("time").textContent==="25:00", d.getElementById("time").textContent);
  check("每日一句有顯示", d.getElementById("quoteBar").textContent.length>4);
  check("混音器有 24 種音效", d.querySelectorAll(".sound").length===24, d.querySelectorAll(".sound").length);
  check("熱力圖有格子", d.querySelectorAll("#heatGrid .heat-cell").length>=140);
  check("情境列 3 預設+編輯鈕", d.querySelectorAll("#presetRow button").length===4);
  check("徽章牆 16 個", d.querySelectorAll("#badgeGrid .badge").length===16);
  check("時段圖 24 條", d.querySelectorAll("#hourChart .bar").length===24);
  check("新設定預設值", E("settings.dailyGoal")===8 && E("settings.chimeRepeat")===1 && E("settings.strict")===false && E("settings.followTimer")===false);

  // 2. 倒數計時
  E("toggleTimer()");
  check("按開始後進入計時", E("running")===true && d.getElementById("startBtn").textContent==="暫停");
  await sleep(1300);
  check("倒數有在走", d.getElementById("time").textContent!=="25:00", d.getElementById("time").textContent);

  // 3. 模擬一輪走完
  E("endAt = Date.now()-100");
  await sleep(400);
  check("完成後記錄一筆專注", E("sessions.length")===1);
  check("紀錄含完成時段(小時)", E("typeof sessions[0].t")==="number");
  check("完成後自動切到短休息", d.getElementById("tabShort").classList.contains("active"));
  check("完成後跳出專注度詢問", d.getElementById("moodOv").classList.contains("open"));
  check("休息時顯示微運動建議", d.getElementById("microCard").style.display==="block");
  E("recordMood(2)");
  check("記錄專注度成功", E("sessions[0].mood")===2);
  check("統計:今日 1 顆", d.getElementById("statToday").textContent.trim().startsWith("1"));
  check("目標環顯示 1/8", d.getElementById("goalRow").style.display!=="none" && d.getElementById("goalNum").textContent==="1/8", d.getElementById("goalNum").textContent);
  check("解鎖第一個徽章", parseInt(d.getElementById("badgeCount").textContent,10)>=1);

  // 4. 任務(預估+今日待辦)
  d.getElementById("taskInput").value="讀多益單字";
  d.getElementById("taskEst").value="5";
  E("addTask()");
  check("新增任務(含預估 5 顆)", E("tasks.length")===1 && E("tasks[0].est")===5);
  check("第一個任務自動設為目前任務", E("activeTask===tasks[0].id"));
  check("任務顯示 🍅 0/5", d.querySelector("#taskList .tcount").textContent.includes("0/5"));
  E("toggleToday(tasks[0].id)");
  check("排進今日待辦", E("isTodayTask(tasks[0])")===true);
  d.getElementById("taskInput").value="整理筆記";
  E("addTask()");
  check("有今日待辦時,計時頁只顯示今日任務", d.getElementById("taskSelect").options.length===2); // 不指定+1個今日
  E("toggleToday(tasks[0].id)");
  check("移出今日待辦後顯示全部", d.getElementById("taskSelect").options.length===3);
  E("pickTask(tasks[0].id)");
  E("switchMode('focus', false)");
  E("toggleTimer()");
  E("endAt = Date.now()-100");
  await sleep(400);
  E("closeMood()");
  check("任務累積 1 顆番茄", E("tasks[0].pomos")===1);
  check("該輪紀錄綁定任務", E("sessions[sessions.length-1].task===tasks[0].id"));
  E("completeTask(tasks[0].id)");
  check("任務標記完成", E("tasks[0].done")===true);
  E("tasks=tasks.filter(t=>!t.done||t.name==='測試留存'); tasks=tasks; saveData(); renderTasks();");

  // 5. 正計時模式
  E("switchMode('focus', false)");
  E("settings.countUp = true; document.getElementById('cuToggle').checked = true; resetTimer(); updateButtons();");
  check("正計時:顯示完成鈕、隱藏跳過", d.getElementById("doneBtn").style.display!=="none" && d.getElementById("skipBtn").style.display==="none");
  E("toggleTimer()");
  await sleep(1100);
  E("cuAccum += 5*60000");
  E("finishCountUp()");
  check("正計時完成記錄 5 分鐘", E("sessions[sessions.length-1].m")===5);
  E("closeMood()");
  E("settings.countUp=false; document.getElementById('cuToggle').checked=false; resetTimer();");

  // 5.5 嚴格模式
  E("switchMode('focus', false); settings.strict=true; toggleTimer();");
  check("嚴格模式:計時中隱藏跳過/重設", d.getElementById("skipBtn").style.display==="none" && d.getElementById("resetBtn").style.display==="none");
  E("switchMode('short', true)");
  check("嚴格模式:擋住手動切換", E("mode")==="focus" && E("running")===true);
  E("toggleTimer(); settings.strict=false; resetTimer(); updateButtons();");
  check("解除嚴格模式後按鈕恢復", d.getElementById("skipBtn").style.display!=="none" && d.getElementById("resetBtn").style.display!=="none");

  // 5.6 鈴聲重複次數
  E("settings.chimeRepeat=3; playChime(true); settings.chimeRepeat=1;");
  check("鈴聲重複 3 次不出錯", true);

  // 6. 混音器
  E("toggleSound('rain'); toggleSound('fire');");
  check("雨聲+火堆同時播放", E("mixOn.rain===true && mixOn.fire===true"));
  await sleep(150);
  check("卡片顯示播放中", d.querySelector("#snd-rain .state").textContent==="播放中");
  check("音檔已載入並開始播放", E("sndNodes.rain.length")>0 && E("!!soundBuffers.rain"));
  E("setSndVol('rain', 30)");
  check("單一音效音量調整", E("mixVol.rain")===30);
  E("saveFav()");
  check("儲存常用組合", E("favMixes.length===1 && favMixes[0].mix.rain===30"));
  E("stopAllSounds()");
  check("全部停止", E("!mixOn.rain && !mixOn.fire"));
  E("applyMix(favMixes[0].mix)");
  check("套用常用組合(雨+火開啟)", E("mixOn.rain===true && mixOn.fire===true && mixVol.rain===30"));
  E("stopAllSounds()");
  E("window.__fetchFail = true; Object.keys(soundBuffers).forEach(k=>delete soundBuffers[k]);");
  E("toggleSound('ocean')");
  await sleep(150);
  check("音檔讀不到時退回合成音", E("mixOn.ocean===true && sndNodes.ocean.length>0"));
  E("toggleSound('library')");
  await sleep(150);
  check("新音效備援(通用合成音)", E("mixOn.library===true && sndNodes.library.length>0"));
  E("stopAllSounds(); window.__fetchFail = false;");
  E("toggleSound('cat'); toggleSound('clock');");
  await sleep(150);
  check("新音效(貓咪+時鐘)音檔播放", E("mixOn.cat===true && mixOn.clock===true && sndNodes.cat.length>0"));
  E("stopAllSounds()");
  E("toggleSound('brown'); toggleSound('plane');");
  await sleep(150);
  check("最新音效(褐色噪音+飛機艙)播放", E("mixOn.brown===true && mixOn.plane===true && sndNodes.brown.length>0 && sndNodes.plane.length>0"));
  E("stopAllSounds()");

  // 7. 情境預設+編輯器
  E("applyPreset(1)"); // 讀書 50 分
  check("情境:讀書 50 分鐘", E("settings.work")===50 && d.getElementById("time").textContent==="50:00");
  check("情境:咖啡廳音效開啟", E("mixOn.cafe===true"));
  E("stopAllSounds(); settings.work=25; saveData(); applySettingsToUI(); resetTimer();");
  E("openPresetOv()");
  check("編輯器列出 3 個情境", d.querySelectorAll("#peList .pe-item").length===3);
  E("pfAddNew()");
  d.getElementById("pfName").value="考前衝刺";
  d.getElementById("pfWork").value="45";
  d.getElementById("pfRounds").value="4";
  E("pfSave()");
  check("新增自訂情境成功", E("presets.length")===4 && E("presets[3].name")==="考前衝刺" && E("presets[3].rounds")===4);
  check("情境列更新為 5 顆按鈕", d.querySelectorAll("#presetRow button").length===5);
  E("presets.pop(); saveData(); renderPresets(); closePresetOv();");

  // 7.5 一鍵慣例流程(自動連跑 2 輪)
  E("presets[0].rounds=2; saveData();");
  E("applyPreset(0)");
  check("慣例啟動:直接開始計時", E("running")===true && E("routine && routine.target===2"));
  E("endAt=Date.now()-100");
  await sleep(400);
  E("closeMood()");
  check("第 1 輪完成,自動開始休息", E("routine.done")===1 && E("running")===true && E("mode")!=="focus");
  E("endAt=Date.now()-100");
  await sleep(400);
  check("休息完自動開始第 2 輪", E("running")===true && E("mode")==="focus");
  E("endAt=Date.now()-100");
  await sleep(400);
  E("closeMood()");
  check("達成輪數後慣例結束、不再自動", E("routine")===null && E("running")===false);
  E("presets[0].rounds=0; saveData(); renderPresets(); stopAllSounds(); switchMode('focus',false);");

  // 7.6 白噪音跟著計時
  E("settings.followTimer=true; settings.breakSound='stop';");
  E("toggleSound('rain')");
  await sleep(150);
  E("toggleTimer()"); // 開始專注 → 記住組合
  check("專注開始記住聲音組合", E("focusMix && focusMix.rain!==undefined"));
  E("endAt=Date.now()-100");
  await sleep(400);
  E("closeMood()");
  check("進休息自動停止聲音", E("anySoundOn()")===false);
  E("switchMode('focus',false); toggleTimer();");
  await sleep(150);
  check("回到專注自動恢復聲音", E("mixOn.rain===true"));
  E("toggleTimer(); resetTimer(); stopAllSounds(); settings.followTimer=false; saveData();");

  // 8. 睡眠定時
  E("setSleepTimer('30')");
  check("睡眠定時啟動", E("sleepEndAt>Date.now()"));
  E("setSleepTimer('0')");
  check("睡眠定時取消", E("sleepEndAt")===0);

  // 8.5 午睡充電
  E("openNap()");
  check("午睡視窗開啟", d.getElementById("napOv").classList.contains("open"));
  E("startNap()");
  await sleep(150);
  check("午睡開始:倒數+播助眠聲", E("napEndAt>Date.now()") && E("mixOn.ocean===true"));
  E("napEndAt=Date.now()-1; napTick();");
  check("時間到:停聲音進入喚醒", E("anySoundOn()")===false && d.getElementById("napTime").textContent.includes("起床"));
  E("closeNap()");
  check("關閉午睡恢復畫面", !d.getElementById("napOv").classList.contains("open"));

  // 9. 健康提醒 + 喝水記錄
  check("今日喝水預設 0/8", d.getElementById("waterToday").textContent==="0/8 杯", d.getElementById("waterToday").textContent);
  E("addWater()");
  check("手動 +1 杯", d.getElementById("waterToday").textContent==="1/8 杯" && w.localStorage.getItem("pomo_water")!==null);
  d.getElementById("hWaterGoal").value="10";
  E("saveHealth()");
  check("喝水目標可調", d.getElementById("waterToday").textContent==="1/10 杯");
  d.getElementById("hWaterGoal").value="8"; E("saveHealth()");
  E("settings.health.water.on = true; remNext.water = Date.now()-1000; checkReminders();");
  check("喝水提醒觸發橫幅", d.getElementById("remBanner").classList.contains("show") && d.getElementById("remText").textContent.includes("喝水"));
  check("喝水提醒附「我喝了」按鈕", d.getElementById("remAction").style.display!=="none" && d.getElementById("remAction").textContent.includes("我喝了"));
  d.getElementById("remAction").onclick();
  check("按「我喝了」記一杯並收起", d.getElementById("waterToday").textContent==="2/8 杯" && !d.getElementById("remBanner").classList.contains("show"));
  E("settings.health.eye.on = true; remNext.eye = Date.now()-1000; checkReminders();");
  check("護眼提醒附「開始 20 秒」", d.getElementById("remAction").textContent.includes("20 秒"));
  d.getElementById("remAction").onclick();
  check("按下後開啟護眼倒數", d.getElementById("eyeOv").classList.contains("open") && d.getElementById("eyeSec").textContent==="20");
  E("eyeLeft=1");
  await sleep(1200);
  check("護眼倒數完成", d.getElementById("eyeSec").textContent==="✅");
  E("closeEye()");
  E("settings.health.caffeine.on = true; settings.health.caffeine.time = '00:00'; checkReminders();");
  check("咖啡因截止提醒觸發", d.getElementById("remText").textContent.includes("咖啡"));
  check("一般提醒沒有行動按鈕", d.getElementById("remAction").style.display==="none");
  E("hideRem()");

  // 10. 呼吸(三種)/伸展(三套)
  E("openBreath()");
  check("呼吸練習開啟(先選方法)", d.getElementById("breathOv").classList.contains("open") && d.getElementById("breathDesc").textContent.includes("選一種"));
  E("startBreathMethod('v478')");
  check("4-7-8 開始", d.getElementById("breathPhase").textContent.includes("吸氣") && d.getElementById("breathCount").textContent.includes("4-7-8"));
  E("startBreathMethod('box')");
  check("切換箱式呼吸", d.getElementById("breathCount").textContent.includes("箱式"));
  E("startBreathMethod('sigh')");
  check("切換生理性嘆息", d.getElementById("breathCount").textContent.includes("嘆息"));
  E("closeBreath()");
  E("openStretch()");
  check("伸展開啟(先選套路)", d.getElementById("stretchChoose").style.display!=="none" && d.getElementById("stretchStep").textContent.includes("選一套"));
  E("startStretchRoutine('neck')");
  check("頸肩套路第一個動作", d.getElementById("stretchName").textContent==="頸部右傾");
  E("startStretchRoutine('eye')");
  check("眼部套路第一個動作", d.getElementById("stretchName").textContent==="掌心敷眼");
  E("startStretchRoutine('back')");
  check("下背套路第一個動作", d.getElementById("stretchName").textContent==="站起來");
  E("closeStretch()");
  check("健康頁 4 張練習卡", d.querySelectorAll(".action-card").length===4);

  // 10.5 說明/通知/主題/快捷鍵
  check("說明+實用建議共 9 篇(含雲端備份教學)", d.querySelectorAll("details.help").length===9, d.querySelectorAll("details.help").length);
  check("有功能總覽說明", [...d.querySelectorAll("details.help summary")].some(s=>s.textContent.includes("功能總覽")));
  check("通知開關預設關閉", d.getElementById("setNotify").checked===false);
  d.getElementById("setTheme").checked=true;
  E("saveSettings()");
  check("切換淺色主題", E("document.documentElement.dataset.theme")==="light");
  d.getElementById("setTheme").checked=false;
  E("saveSettings()");
  check("切回深色主題", E("document.documentElement.dataset.theme")==="dark");
  E("switchMode('focus',false); resetTimer();");
  d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"Space"}));
  check("空白鍵開始計時", E("running")===true);
  d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"Space"}));
  check("空白鍵暫停計時", E("running")===false);
  E("resetTimer()");

  // 11. 備份匯出/匯入
  E("exportBackup()");
  check("匯出檔名正確", (w.__lastDownload||"").startsWith("番茄鐘備份_"));
  check("匯出後記錄備份日期", w.localStorage.getItem("pomo_lastexport")!==null);

  // 11.5 ☁️ GitHub 雲端備份
  check("倉庫網址解析", E("JSON.stringify(parseRepoInput('https://github.com/zaker353/my-backup'))")==='{"owner":"zaker353","repo":"my-backup"}');
  check("未設定時顯示設定表單", d.getElementById("ghCard").textContent.includes("私人倉庫") || !!d.getElementById("ghRepo"));
  E("localStorage.setItem('pomo_ghsync', JSON.stringify({owner:'zaker353',repo:'my-backup',token:'SECRET_TOKEN_123'})); ghRender();");
  check("設定後顯示三顆按鈕", d.getElementById("ghCard").textContent.includes("上傳備份") && d.getElementById("ghCard").textContent.includes("下載並合併") && d.getElementById("ghCard").textContent.includes("下載並覆蓋"));
  check("按鈕下方有白話說明", d.getElementById("ghCard").textContent.includes("加在一起") && d.getElementById("ghCard").textContent.includes("全部刪掉"));
  check("金鑰絕不進備份檔", !JSON.stringify(w.eval("buildBackupData()")).includes("SECRET_TOKEN_123"));
  E("ghDoUpload()");
  await sleep(200);
  check("上傳成功", !!w.__ghFiles["pomodoro-backup.json"] && d.getElementById("ghStatus").textContent.includes("✅"),
    "ghStatus="+d.getElementById("ghStatus").textContent+" / ghBusy="+E("ghBusy")+" / files="+JSON.stringify(Object.keys(w.__ghFiles)));
  const cloudData = JSON.parse(w.__ghFiles["pomodoro-backup.json"]);
  check("雲端檔案是有效備份且無金鑰", cloudData.app==="pomodoro-whitenoise" && !w.__ghFiles["pomodoro-backup.json"].includes("SECRET_TOKEN_123"));
  // 合併:雲端多一筆紀錄+一個任務
  cloudData.sessions.push({d:"2026-06-20", m:25, t:10});
  cloudData.tasks.push({id:"cloudTask1", name:"雲端來的任務", done:false, pomos:3});
  w.__ghFiles["pomodoro-backup.json"] = JSON.stringify(cloudData);
  const beforeMerge = E("sessions.length");
  E("ghDoMerge()");
  await sleep(200);
  check("下載並合併:紀錄取聯集", E("sessions.length")===beforeMerge+1 && E("tasks.some(t=>t.id==='cloudTask1')"));
  E("ghDoMerge()");
  await sleep(200);
  check("重複合併不會重複增加", E("sessions.length")===beforeMerge+1);
  // 覆蓋
  const smallCloud = {app:"pomodoro-whitenoise", version:3, sessions:[{d:"2026-07-01",m:25,t:9}], settings:{work:25}, roundCount:1, tasks:[], favMixes:[], presets:[], focusMix:null, waterLog:{}};
  w.__ghFiles["pomodoro-backup.json"] = JSON.stringify(smallCloud);
  E("ghDoOverwrite()");
  await sleep(200);
  check("下載並覆蓋:完全換成雲端", E("sessions.length")===1);
  // 錯誤處理
  w.__ghFail = true;
  E("ghDoUpload()");
  await sleep(200);
  check("金鑰失效顯示白話錯誤", d.getElementById("ghStatus").textContent.includes("401"));
  w.__ghFail = false;
  // ⚡ 全自動同步
  check("自動同步預設開啟", E("ghAutoEnabled()")===true);
  const cloud2 = JSON.parse(w.__ghFiles["pomodoro-backup.json"]);
  cloud2.sessions.push({d:"2026-06-15", m:25, t:8});
  w.__ghFiles["pomodoro-backup.json"] = JSON.stringify(cloud2);
  const beforeAuto = E("sessions.length");
  E("ghAutoDownload()");
  await sleep(200);
  check("開App自動下載合併", E("sessions.length")===beforeAuto+1, E("sessions.length")+" vs "+beforeAuto);
  E("ghDirty=true");
  E("ghAutoUpload()");
  await sleep(200);
  check("自動上傳成功且清除待傳標記", JSON.parse(w.__ghFiles["pomodoro-backup.json"]).sessions.length===E("sessions.length") && E("ghDirty")===false);
  check("同步狀態有記錄", (w.localStorage.getItem("pomo_ghsync_status")||"").includes("upload"));
  check("設定畫面有自動同步開關", !!d.getElementById("ghAutoCb") && d.getElementById("ghAutoCb").checked===true);
  E("ghSetAuto(false)");
  check("可關閉自動同步", E("ghAutoEnabled()")===false);
  E("ghSetAuto(true)");
  E("ghClearConfig()");
  check("清除設定後回到表單", !!d.getElementById("ghRepo"));
  const v1 = {app:"pomodoro-whitenoise", version:1, sessions:[{d:"2026-07-01",m:25}], settings:{work:30}, roundCount:3};
  w.__v1=v1; E("applyImport(window.__v1)");
  check("匯入 v1 舊備份成功", E("sessions.length")===1 && E("settings.work")===30);
  check("v1 匯入後情境用預設 3 個", E("presets.length")===3);
  const v3 = {app:"pomodoro-whitenoise", version:3, sessions:[{d:"2026-07-01",m:25,t:9}], settings:{work:25}, roundCount:1, tasks:[], favMixes:[], presets:[{id:"x",icon:"🎓",name:"考前",work:45,short:8,rounds:4,mix:{rain:50}}], focusMix:{rain:40}, waterLog:{"2026-07-01":5}};
  w.__v3=v3; E("applyImport(window.__v3)");
  check("匯入 v3 備份(含自訂情境)", E("presets.length")===1 && E("presets[0].name")==="考前" && E("focusMix.rain")===40);
  check("匯入 v3 備份(含喝水紀錄)", E("waterLog['2026-07-01']")===5);
  // 兩筆都放在「上週」,後面的週報測試才驗得到(日期相對今天算,見 daysAgoStr 說明)
  const v2 = {app:"pomodoro-whitenoise", version:2, sessions:[{d:LAST_WEEK_DAY,m:25},{d:LAST_WEEK_DAY,m:50}], settings:{work:25}, roundCount:2, tasks:[{id:"t1",name:"測試",done:false,pomos:2}], activeTask:"t1", favMixes:[{name:"雨夜",mix:{rain:60,thunder:40}}], mixVol:{rain:60}};
  w.__v2=v2; E("applyImport(window.__v2)");
  check("匯入 v2 備份成功", E("tasks.length")===1 && E("favMixes.length")===1);

  // 12. 重新整理後資料保留 + 週報
  const store = {};
  ["pomo_settings","pomo_sessions","pomo_tasks","pomo_activeTask","pomo_favmixes","pomo_mixvol","pomo_rounds","pomo_timer","pomo_presets"].forEach(k=>{
    const v=w.localStorage.getItem(k); if(v!==null) store[k]=v;
  });
  const dom2 = makeDom(store);
  await sleep(300);
  const w2=dom2.window, d2=w2.document;
  check("重開後任務還在", w2.eval("tasks.length")===1 && w2.eval("tasks[0].name")==="測試");
  check("重開後統計還在", d2.getElementById("statTotal").textContent.trim().startsWith("2"));
  check("重開後常用組合還在", w2.eval("favMixes.length")===1);
  check("上週有紀錄→週報自動跳出", d2.getElementById("weekOv").classList.contains("open"), d2.getElementById("weekOvBody").textContent.slice(0,40));
  check("上週摘要卡片顯示", d2.getElementById("weekCard").style.display!=="none");

  console.log(results.join("\n"));
  console.log("\n總結:"+(results.length-failed)+"/"+results.length+" 通過"+(failed?"、"+failed+" 個失敗":""));
  process.exit(failed?1:0);
})().catch(e=>{ console.log(results.join("\n")); console.error("💥 測試中斷:", e); process.exit(2); });
