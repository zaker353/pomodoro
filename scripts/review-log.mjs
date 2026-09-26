// 審查紀錄的共用邏輯(2026-09-27 加):讀 review-log.json、算每一類到期狀態、產生給 App 用的 review-log.js。
//
// 為什麼 App 不直接讀 JSON:「開啟APP.bat」是用 file:// 開檔,瀏覽器不准在 file:// 底下 fetch 別的檔,
// 所以比照 audit-info.js 的做法,把 JSON 包成一支 `window.REVIEW_LOG = {...}` 的 .js 用 <script src> 載入。
// review-log.js 是產生檔,跑 npm test 時由 gen-audit-info.mjs 順手重產,不要手改。
//
// 狀態判定(跟 index.html 裡的 reviewStatuses() 一模一樣,測試會拿同一個日期比對兩邊算得一不一樣):
//   距上次審查滿 intervalDays 天 = 到期(due);差 soonDays 天以內 = 快到期(soon);其餘 ok;
//   lastReviewedAt 是 null(從沒做過)= 直接到期。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const JSON_NAME = "review-log.json";
export const JS_NAME = "review-log.js";
const DAY = 86_400_000;

export function loadReviewLog(root){
  return JSON.parse(readFileSync(join(root, JSON_NAME), "utf8"));
}

export function parseYmd(s){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if(!m) throw new Error("日期格式錯誤:" + s + "(要 YYYY-MM-DD)");
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}
export function formatYmd(ms){ return new Date(ms).toISOString().slice(0, 10); }
export function todayYmd(now = new Date()){
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
}

export function reviewStatuses(data, today = todayYmd()){
  const t = parseYmd(today);
  return data.categories.map(c => {
    if(!c.lastReviewedAt){
      return { ...c, daysSince: null, daysLeft: -Infinity, dueAt: null, state: "due" };
    }
    const last = parseYmd(c.lastReviewedAt);
    const daysSince = Math.round((t - last) / DAY);
    const daysLeft = c.intervalDays - daysSince;
    const state = daysLeft <= 0 ? "due" : daysLeft <= data.soonDays ? "soon" : "ok";
    return { ...c, daysSince, daysLeft, dueAt: formatYmd(last + c.intervalDays * DAY), state };
  });
}

export function buildReviewJs(data){
  return "// ⚠️ 這個檔案是「自動產生」的,不要手動改——改了也會被蓋掉。\n"
    + "// 來源:review-log.json(要改日期/週期/說明就改那份);產生者:scripts/gen-audit-info.mjs(跑 npm test 時會自動更新)\n"
    + "// 用途:讓 App 顯示各類審查的上次日期與到期狀態(file:// 開檔不能 fetch JSON,所以包成 .js)。\n"
    + "window.REVIEW_LOG = " + JSON.stringify(data, null, 2) + ";\n";
}

/** 重產 review-log.js;內容沒變就不動檔案。回傳 true 表示有寫入。 */
export function generateReviewJs(root){
  const out = join(root, JS_NAME);
  const body = buildReviewJs(loadReviewLog(root));
  const before = existsSync(out) ? readFileSync(out, "utf8") : "";
  if(before === body) return false;
  writeFileSync(out, body, "utf8");
  return true;
}
