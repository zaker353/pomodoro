// 算出「距離上次全面體檢,累積了幾次實質改動」,寫進 audit-info.js 給 App 顯示。
//
// 為什麼要獨立成一個檔案:如果把數字寫在 index.html 裡,更新數字本身就是一次改動,
// 數字會永遠在追自己,永遠不準。所以計數檔要能被「排除在計數之外」。
//
// 什麼不算實質改動:
//   - 純文件(*.md)
//   - audit-info.js 自己(計數器不能數自己)
//   - scripts/gen-audit-info.mjs 自己
// 一個 commit 如果只動了上面這些,就不計入。
//
// 跑法:`node scripts/gen-audit-info.mjs`,或直接 `npm test`(會自動先跑這支)。
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "audit-info.js");
const THRESHOLD = 10;   // 門檻:累積幾次就提醒該做全面體檢(要改也順手改 CLAUDE.md 第七節)

const git = (cmd) => execSync("git " + cmd, {cwd: ROOT, encoding: "utf8"}).trim();

// 不算「實質改動」的檔案
const isTrivial = (f) => f.endsWith(".md")
  || f === "audit-info.js"
  || f === "scripts/gen-audit-info.mjs";

let lastAudit = "";
try{ lastAudit = git('log --format=%H --grep="全面稽核" -1'); }catch(e){}

const range = lastAudit ? (lastAudit + "..HEAD") : "HEAD";
let hashes = [];
try{ hashes = git("log --format=%H " + range).split("\n").filter(Boolean); }catch(e){}

let count = 0;
for(const h of hashes){
  let files = [];
  try{ files = git("show --name-only --format= " + h).split("\n").filter(Boolean); }catch(e){}
  if(files.length && files.every(isTrivial)) continue;   // 只動了文件/計數檔 → 不算
  count++;
}

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
