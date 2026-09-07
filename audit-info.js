// ⚠️ 這個檔案是「自動產生」的,不要手動改——改了也會被蓋掉。
// 產生者:scripts/gen-audit-info.mjs(跑 npm test 時會自動更新)
// 用途:讓 App 顯示「距離上次全面體檢累積了幾次改動」,達標時主動提醒。
window.AUDIT_INFO = {
  count: 5,              // 未體檢的實質改動數
  threshold: 10,              // 達到這個數字就提醒
  lastAuditDate: "2026-08-09"   // 上次全面體檢的日期(從沒做過就是 null)
};
