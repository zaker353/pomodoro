// 印出各類審查的上次日期與到期狀態(npm run review-status)。
// 資料與判定規則和 App 設定頁「🗓 審查紀錄」卡同源:review-log.json + scripts/review-log.mjs。
// 全面體檢不在這裡,看 npm run audit-count。
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadReviewLog, reviewStatuses, todayYmd, pendingProposal, PROPOSE_BY } from "./review-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = loadReviewLog(ROOT);
const today = todayYmd();
const rows = reviewStatuses(data, today).sort((a, b) => a.daysLeft - b.daysLeft);

console.log("審查紀錄(今天 " + today + ";全面體檢另看 npm run audit-count)\n");
for(const r of rows){
  const tag = r.state === "due" ? "⛔ 到期" : r.state === "soon" ? "⚠ 快到期" : "✅ 正常";
  if(!r.lastReviewedAt){
    console.log(tag + "  " + r.name.padEnd(6, "　") + " 從沒做過(週期 " + r.intervalDays + " 天)");
  }else{
    const left = r.daysLeft <= 0 ? "已過期 " + (-r.daysLeft) + " 天" : "還有 " + r.daysLeft + " 天";
    console.log(tag + "  " + r.name.padEnd(6, "　") + " 上次 " + r.lastReviewedAt + "(" + r.daysSince + " 天前)  下次 " + r.dueAt + "(" + left + ")");
  }
  console.log("         " + r.note);
}
const due = rows.filter(r => r.state === "due");
console.log(due.length
  ? "\n" + due.length + " 類已到期:" + due.map(r => r.name).join("、") + "。到 App 設定頁「🗓 審查紀錄」卡複製該類的審查指令貼給 Claude。"
  : "\n目前沒有到期的審查。");
const pp = pendingProposal(data.categories, today);
console.log(pp.due
  ? "\n💡 該提出待提的建議了:" + (pp.notYet.length ? "已到保底日期 " + PROPOSE_BY + "(還沒單獨審過:" + pp.notYet.join("、") + ")" : "五類都單獨審查過一次")
    + "——全面體檢要不要改成只看兩類之間的縫+快到期的類別(見 CLAUDE.md 第 39 條)。"
  : "\n(還沒用各類審查指令單獨審過:" + pp.notYet.join("、") + ";五類到齊或到 " + PROPOSE_BY + " 要提全面體檢的分工,見 CLAUDE.md 第 39 條)");
