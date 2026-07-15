@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ====================================
echo  番茄鐘 App 自動功能測試
echo ====================================
echo.

if not exist "node_modules\jsdom" (
    echo 第一次執行,正在安裝測試工具...需要網路,請稍候
    echo.
    call npm install --no-fund --no-audit
    echo.
)

node tests/test-pomo.js

echo.
echo ====================================
pause
