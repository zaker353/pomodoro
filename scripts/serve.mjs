// 本機靜態伺服器:把這個資料夾用 http://localhost:8931 開起來。
//
// 為什麼需要它:「開啟APP.bat」是用 file:// 開檔,Service Worker 在 file:// 不會註冊,
// 所以離線快取、sw.js 的 FILES 清單、PWA 行為在那裡都驗不到。要驗這些就用這支。
// 沒有任何額外相依,只用 Node 內建模組。跑法:`node scripts/serve.mjs`,或雙擊「開啟本機伺服器.bat」。
//
// 安全性:localhost 跟線上版(zaker353.github.io)是不同來源,localStorage 完全隔離,
// 在這裡怎麼玩都碰不到手機/電腦上的真實紀錄。但也因此:**不要在這裡設定 GitHub 雲端同步**,
// 一設,測試弄髒的資料就會自動上傳蓋掉雲端備份(CLAUDE.md 第 20 條)。
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PORT = 8931;
const TYPES = {".html":"text/html; charset=utf-8", ".js":"text/javascript", ".mjs":"text/javascript",
  ".json":"application/json", ".png":"image/png", ".mp3":"audio/mpeg", ".ico":"image/x-icon",
  ".webmanifest":"application/manifest+json", ".css":"text/css"};

http.createServer(async (req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  if(p === "/") p = "/index.html";
  const file = normalize(join(ROOT, p));
  if(!file.startsWith(ROOT)){ res.writeHead(403); res.end(); return; }   // 不准往上跳出資料夾
  try{
    const data = await readFile(file);
    res.writeHead(200, {"Content-Type": TYPES[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store"});   // 每次都拿最新的,改完重新整理就看得到
    res.end(data);
  }catch(e){
    res.writeHead(404); res.end("not found");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log("🍅 番茄鐘本機版開好了:http://localhost:" + PORT + "/");
  console.log("   (這裡的資料跟線上版完全分開;不要在這裡設定 GitHub 雲端同步)");
  console.log("   關掉這個視窗就會停止。");
});
