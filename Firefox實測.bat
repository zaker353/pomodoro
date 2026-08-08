@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ====================================
echo  番茄鐘 App - 真實 Firefox 自動實測
echo ====================================
echo.
echo 會自動開 Firefox、實際打字點按鈕操作 App,
echo 全程只開本機網址,碰不到你手機/電腦上的真實紀錄。
echo.

if not exist "node_modules\selenium-webdriver" (
    echo 第一次執行,正在安裝測試工具...需要網路,請稍候
    echo.
    call npm install --no-fund --no-audit
    echo.
)

call npm run test:firefox

echo.
echo 截圖存在 tests\screenshots\ 資料夾,可以打開來看
echo ====================================
pause
