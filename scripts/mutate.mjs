// 突變測試小工具(2026-11-23):把某個檔「故意改壞一處」→ 跑快的那套測試 → 改回原樣,看有沒有測試變紅。
// 用途:CLAUDE.md 第 11 條——新寫的測試一定要故意把功能改壞一次,確認它真的會失敗(不是假防護)。
//
// 怎麼用(在專案資料夾):
//   node scripts/mutate.mjs <檔> <原字串> <改壞字串> [--expect <測試名稱的一段>]
//   例:node scripts/mutate.mjs index.html 'return !(+createdAt > t);' 'return true;' --expect 墓碑
//
// 它會:
//   1. 存下原檔的位元組(另外備一份到系統暫存資料夾,萬一被強制中止可以拿回來,路徑會印出來)
//   2. 確認「原字串」在檔案裡剛好出現一次(0 次或好幾次都不動手)
//   3. 改壞 → 跑 node tests/test-pomo.js(不是 npm test:那個會先重產 audit-info.js)
//   4. 不管測試結果、出錯或按 Ctrl+C,一律寫回原本的位元組,再讀一次比對一模一樣
//   5. 印出哪幾條變紅;加 --expect 時只看名稱含那一段的測試有沒有紅
// 換行:原字串裡的換行對不上時,改用這個檔原本的換行(CRLF 或 LF)再找一次,改壞字串也跟著換,寫回去不會混到別種換行。
//   參數裡的換行要是真的換行字元(bash 用 $'a\nb');不轉義「\n」兩個字,因為 index.html 裡本來就有 "\n" 這種字串。
// 只准改專案資料夾裡的檔(CLAUDE.md 第 17 條);系統暫存資料夾例外(給自我測試用)。
// 同一個檔同時只准一個突變(鎖檔在系統暫存資料夾):兩個同時改,後來那個會把「已經改壞的」當成原檔存起來、最後寫回壞的。
//
// 結束碼:0 = 突變被抓到 1 = 沒被抓到(或整套測試中斷、看不出是哪條) 2 = 用法錯、原字串不是剛好一次、有別的突變在跑
//         3 = 🔴 還原失敗(會印出備份在哪)
// --run <測試腳本> 只給自我測試用(tests/test-pomo.js 拿假的小腳本驗這個工具,不然會自己跑自己跑不完)。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = os.tmpdir();

function fail(msg, code = 2){
  console.error("❌ " + msg);
  if(code === 2) console.error("用法:node scripts/mutate.mjs <檔> <原字串> <改壞字串> [--expect <測試名稱的一段>]");
  process.exit(code);
}
const short = s => { const t = s.replace(/\r?\n/g, "⏎"); return t.length > 120 ? t.slice(0, 117) + "…" : t; };
const inside = (p, dir) => { const rel = path.relative(dir, p); return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel); };

// ── 參數
const pos = [];
let expect = null, run = path.join(ROOT, "tests", "test-pomo.js");
const argv = process.argv.slice(2);
for(let i = 0; i < argv.length; i++){
  if(argv[i] === "--expect"){ expect = argv[++i]; if(!expect) fail("--expect 後面要接測試名稱的一段"); }
  else if(argv[i] === "--run"){ if(!argv[i + 1]) fail("--run 後面要接測試腳本"); run = path.resolve(argv[++i]); }
  else pos.push(argv[i]);
}
if(pos.length !== 3) fail("要剛好三個參數:檔、原字串、改壞字串(要刪掉一段就把改壞字串寫成空字串 '')");
const target = path.resolve(pos[0]);
if(!inside(target, ROOT) && !inside(target, TMP)) fail("只准改專案資料夾裡的檔:" + target);
if(!fs.existsSync(target)) fail("找不到檔案:" + target);
if(!fs.existsSync(run)) fail("找不到測試腳本:" + run);
if(!pos[1]) fail("原字串不可以是空的");
if(pos[1] === pos[2]) fail("改壞字串跟原字串一樣,等於沒改");

// ── 讀原檔、找原字串
const orig = fs.readFileSync(target);
const text = orig.toString("utf8");
if(!Buffer.from(text, "utf8").equals(orig)) fail("這個檔不是 UTF-8,寫回去會變樣,不處理");
const count = s => text.split(s).length - 1;
let from = pos[1], to = pos[2];
if(count(from) === 0 && from.includes("\n")){
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const norm = s => s.replace(/\r?\n/g, eol);
  if(count(norm(from)) > 0){ from = norm(from); to = norm(to); }
}
const n = count(from);
if(n !== 1) fail("原字串在 " + path.relative(ROOT, target) + " 裡出現 " + n + " 次(要剛好 1 次才知道改哪裡):" + short(from));
const at = text.indexOf(from);
const line = text.slice(0, at).split("\n").length;

// ── 鎖 + 備份(被強制中止時,鎖檔裡寫著備份在哪)
const tag = crypto.createHash("sha1").update(target.toLowerCase()).digest("hex").slice(0, 12);
const lock = path.join(TMP, "pomo-mutate-" + tag + ".lock");
const bak = path.join(TMP, "pomo-mutate-" + tag + "-" + Date.now() + ".bak");
try{ fs.writeFileSync(lock, bak + "\n" + target + "\n", { flag: "wx" }); }
catch(e){
  let info = ""; try{ info = fs.readFileSync(lock, "utf8").split("\n")[0]; }catch(_){}
  fail("這個檔有另一個突變正在跑(或上次被強制中止沒收尾)。鎖檔:" + lock
    + (info ? "\n   上次的原檔備份:" + info + "——確認 " + target + " 有沒有被改壞(git diff),壞了就把備份複製回去,再刪掉鎖檔" : ""));
}
// 拿到鎖之後才掛「結束時還原」:拿不到鎖就離開的那次不可以去動檔案或刪別人的鎖
let mutated = false, restored = false;
function restore(){
  if(restored) return true;
  if(mutated){
    fs.writeFileSync(target, orig);
    if(!fs.readFileSync(target).equals(orig)) return false;
  }
  restored = true;
  try{ fs.unlinkSync(bak); }catch(_){}
  try{ fs.unlinkSync(lock); }catch(_){}
  return true;
}
process.on("exit", () => { try{ restore(); }catch(_){} });
for(const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => { try{ restore(); }catch(_){} process.exit(130); });
fs.writeFileSync(bak, orig);

// ── 改壞、跑測試、改回
let r;
try{
  mutated = true;
  fs.writeFileSync(target, Buffer.from(text.slice(0, at) + to + text.slice(at + from.length), "utf8"));
  console.log("🧪 突變 " + path.relative(ROOT, target) + " 第 " + line + " 行");
  console.log("   原本:" + short(from));
  console.log("   改成:" + (to ? short(to) : "(刪掉)"));
  console.log("   跑 node " + path.relative(ROOT, run).replace(/\\/g, "/") + " …");
  r = spawnSync(process.execPath, [run], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 });
}finally{
  if(!restore()){
    console.error("🔴 還原失敗!原檔備份在 " + bak + ",請把它複製回 " + target + "(鎖檔 " + lock + " 確認後再刪)");
    process.exit(3);
  }
}

// ── 看結果
const lines = (r.stdout || "").split(/\r?\n/);
const red = lines.filter(l => l.startsWith("❌"));
const summary = lines.filter(l => l.startsWith("總結")).pop() || "";   // 取最後一行:測試的說明文字裡可能也帶到「總結」
const crashed = !!r.error || !!r.signal || !summary;
const hit = expect ? red.filter(l => l.includes(expect)) : red;
if(red.length){
  console.log("\n變紅的 " + red.length + " 條:");
  for(const l of red.slice(0, 20)) console.log("   " + l.slice(0, 200));
  if(red.length > 20) console.log("   …(還有 " + (red.length - 20) + " 條)");
}
if(summary) console.log("\n" + summary);
if(crashed){
  const why = r.error ? String(r.error.message) : r.signal ? "被訊號 " + r.signal + " 中止" : (r.stderr || "").trim().split(/\r?\n/).slice(-3).join(" / ");
  console.log("⚠️ 整套測試中斷(結束碼 " + r.status + "):" + short(why || "沒有總結行"));
}
console.log("✅ 已還原,檔案跟原本的位元組一模一樣");
if(hit.length && !(crashed && !expect)){
  console.log("✅ 突變有被抓到" + (expect ? "(名稱含「" + expect + "」的 " + hit.length + " 條變紅)" : ""));
  process.exit(0);
}
console.log(crashed && !expect
  ? "⚠️ 看不出是哪一條抓到的:改壞的地方可能讓整套跑不下去。換個改法,或加 --expect 指定要看的那條"
  : expect
    ? "⚠️ 名稱含「" + expect + "」的測試沒有變紅" + (red.length ? "(紅的是別條)" : "") + "——它可能是假防護,或 --expect 打錯字"
    : "⚠️ 沒被抓到:測試全綠——守這段的測試可能是假防護(或改的地方根本沒有測試在看)");
process.exit(1);
