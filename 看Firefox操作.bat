@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ====================================
echo  番茄鐘 App - Firefox 實測(看得到視窗版)
echo ====================================
echo.
echo 跟「Firefox實測.bat」跑的是同一套測試,
echo 差別是這個會跳出 Firefox 視窗,讓你親眼看它操作。
echo 測試期間請不要去動那個視窗。
echo.

if not exist "node_modules\selenium-webdriver" (
    echo 第一次執行,正在安裝測試工具...需要網路,請稍候
    echo.
    call npm install --no-fund --no-audit
    echo.
)

node scripts/gen-audit-info.mjs
node tests/test-firefox.js --show

echo.
echo ====================================
pause
