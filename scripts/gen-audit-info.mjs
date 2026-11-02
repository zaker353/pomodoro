// 算出「距離上次全面體檢,累積了幾次實質改動」,寫進 audit-info.js 給 App 顯示。
//
// 為什麼要獨立成一個檔案:如果把數字寫在 index.html 裡,更新數字本身就是一次改動,
// 數字會永遠在追自己,永遠不準。所以計數檔要能被「排除在計數之外」。
//
// 什麼不算實質改動:
//   - 純文件(*.md)
//   - audit-info.js 自己(計數器不能數自己)
//   - scripts/gen-audit-info.mjs 自己
//   - .gitignore 與 .claude/ 底下的東西(代理定義檔等開發設定,不是 App 的改動)
//   - review-log.json 與它的產生檔 review-log.js(審查日期,不是 App 的改動;2026-09-27 加)
// 一個 commit 如果只動了上面這些,就不計入。
//
// 兩個 2026-09-08 的修正:
//   - 「上次全面體檢」只認 commit 訊息的「標題列」含「全面稽核」。原本連內文都算,
//     而程式註解到處寫「2026-08-09 全面稽核找到」,哪天有人在內文引用一句就會把計數歸零。
//   - 工作區有「還沒 commit」的實質改動時,先算 +1。原本只數已提交的 commit,
//     所以部署流程「先跑測試(更新計數)→ 再 commit」寫出來的數字永遠少一,
//     每次部署都得再補一個「更新體檢計數」的 commit。現在 commit 前後數字一致。
//
// 跑法:`node scripts/gen-audit-info.mjs`,或直接 `npm test`(會自動先跑這支)。
// 2026-09-27 起也順手把 review-log.json 重產成 review-log.js(審查紀錄,見 scripts/review-log.mjs)。
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { generateReviewJs } from "./review-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "audit-info.js");
const THRESHOLD = 10;   // 門檻:累積幾次就提醒該做全面體檢(要改也順手改 CLAUDE.md 第七節)

// core.quotepath=false:中文檔名照原樣印,不要變成 "\351\226\213..." 加引號(否則中文檔名的 .md 認不出來)
const gitRaw = (cmd) => execSync("git -c core.quotepath=false " + cmd, {cwd: ROOT, encoding: "utf8"});
const git = (cmd) => gitRaw(cmd).trim();

// 不算「實質改動」的檔案
export const isTrivial = (f) => f.endsWith(".md")
  || f === "audit-info.js"
  || f === "scripts/gen-audit-info.mjs"
  || f === ".gitignore"
  || f.startsWith(".claude/")
  || f === "review-log.json"
  || f === "review-log.js";

/* `git status --porcelain` 的輸出 → 檔名清單。
   ⚠️ 不可以先把整段 .trim():每行開頭的空格是狀態欄位的一部分(" M 檔名"),整段 trim 會吃掉第一行的空格,
   接著 slice(3) 就把第一個檔名的第一個字切掉(" M review-log.json" → "eview-log.json"),
   只改了審查紀錄或計數檔也被當成實質改動,計數多 1(2026-11-03 驗收抓到,全面稽核修)。 */
export function dirtyFiles(porcelain){
  return String(porcelain).split(/\r?\n/).filter(l => l.trim())
    .map(l => l.slice(3).trimEnd().replace(/^"|"$/g, ""))
    .map(f => f.includes(" -> ") ? f.split(" -> ")[1] : f);
}

// 被測試 import 時只拿上面兩個函式,不要真的去算、去寫檔
const isMain = !!process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if(isMain) main();
function main(){
// 上次全面體檢的 commit:只看標題列(%s),不看內文
let lastAudit = "";
try{
  const line = git("log --format=%H%x09%s").split(/\r?\n/)
    .find(l => (l.split("\t")[1] || "").includes("全面稽核"));
  if(line) lastAudit = line.split("\t")[0];
}catch(e){}

const range = lastAudit ? (lastAudit + "..HEAD") : "HEAD";
let hashes = [];
try{ hashes = git("log --format=%H " + range).split(/\r?\n/).filter(Boolean); }catch(e){}

let count = 0;
for(const h of hashes){
  let files = [];
  try{ files = git("show --name-only --format= " + h).split(/\r?\n/).filter(Boolean); }catch(e){}
  if(files.length && files.every(isTrivial)) continue;   // 只動了文件/計數檔 → 不算
  count++;
}

// 工作區還沒 commit 的實質改動(含新檔)算一次
let dirty = [];
try{ dirty = dirtyFiles(gitRaw("status --porcelain --untracked-files=all")); }catch(e){}
if(dirty.some(f => !isTrivial(f))) count++;

let lastAuditDate = null;
if(lastAudit){
  try{ lastAuditDate = git("show -s --format=%cs " + lastAudit); }catch(e){}
}

const body = `// ⚠️ 這個檔案是「自動產生」的,不要手動改——改了也會被蓋掉。
// 產生者:scripts/gen-audit-info.mjs(跑 npm test 時會自動更新)
// 用途:讓 App 顯示「距離上次全面體檢累積了幾次改動」,達標時主動提醒。
window.AUDIT_INFO = {
  count: ${count},              // 未體檢的實質改動數
  threshold: ${THRESHOLD},              // 達到這個數字就提醒
  lastAuditDate: ${lastAuditDate ? JSON.stringify(lastAuditDate) : "null"}   // 上次全面體檢的日期(從沒做過就是 null)
};
`;

const before = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
if(before !== body){
  writeFileSync(OUT, body, "utf8");
  console.log("📊 體檢計數已更新:" + count + " / 門檻 " + THRESHOLD
    + (lastAuditDate ? "(上次體檢 " + lastAuditDate + ")" : "(從沒做過全面體檢)"));
}else{
  console.log("📊 體檢計數:" + count + " / 門檻 " + THRESHOLD + "(沒有變化)");
}

if(generateReviewJs(ROOT)) console.log("🗓 review-log.js 已從 review-log.json 重產");
}
