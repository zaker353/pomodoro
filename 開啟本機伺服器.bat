@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ====================================
echo  番茄鐘 App - 本機伺服器(http://localhost:8931)
echo ====================================
echo.
echo 跟「開啟APP.bat」的差別:這個是用網址開,Service Worker 會註冊,
echo 離線快取與 PWA 行為在這裡才驗得到。資料跟線上版完全分開。
echo ⚠️ 不要在這裡設定 GitHub 雲端同步(會把測試資料上傳蓋掉真實備份)。
echo.
echo 關掉這個視窗就會停止伺服器。
echo.
start "" "http://localhost:8931/"
node scripts/serve.mjs
pause
