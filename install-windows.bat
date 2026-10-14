@echo off
rem Installs the Suus Typeface CEP panel for Illustrator on Windows.
rem Usage: double-click install-windows.bat (run again after every update).
setlocal

set "EXT_ID=com.nielsberk.suustypeface"
set "SRC=%~dp0panel"
set "EXT_DIR=%APPDATA%\Adobe\CEP\extensions"
set "DEST=%EXT_DIR%\%EXT_ID%"

if not exist "%SRC%\CSXS\manifest.xml" (
    echo Fout: "%SRC%\CSXS\manifest.xml" niet gevonden.
    echo Pak de ZIP eerst uit en start dit script vanuit de projectmap.
    goto :fail
)

rem Unsigned extensions only load with PlayerDebugMode on. 13 is included in
rem case a newer Illustrator moves to CSXS 13; an unused key is harmless.
echo PlayerDebugMode aanzetten voor CSXS 9 t/m 13...
for %%V in (9 10 11 12 13) do (
    reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
    if errorlevel 1 (
        echo Fout: registersleutel CSXS.%%V kon niet worden gezet.
        goto :fail
    )
)

if not exist "%EXT_DIR%" mkdir "%EXT_DIR%"
if exist "%DEST%" (
    echo Oude installatie verwijderen: "%DEST%"
    rmdir /s /q "%DEST%"
)

xcopy "%SRC%" "%DEST%\" /E /I /H /Y /Q >nul
if errorlevel 1 (
    echo Fout: kopieren naar "%DEST%" is mislukt.
    goto :fail
)

echo Gekopieerd naar: "%DEST%"
echo.
echo Klaar. Herstart Illustrator en open Venster ^> Extensies ^> Suus Typeface.
pause
exit /b 0

:fail
echo.
echo Installatie afgebroken.
pause
exit /b 1
