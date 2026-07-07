"""MkDocs build hooks for generated local-preview helpers."""

from __future__ import annotations

from pathlib import Path


LAUNCHER_NAME = "open-local-site.bat"


def on_post_build(config, **kwargs):
    """Write a Windows launcher into the generated site directory."""
    site_dir = Path(config["site_dir"])
    launcher = site_dir / LAUNCHER_NAME
    launcher.write_text(_launcher_contents(), encoding="utf-8", newline="\r\n")


def _launcher_contents() -> str:
    return """@echo off
setlocal

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8000"

cd /d "%~dp0"

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  set "PYTHON_CMD=py -3"
) else (
  where python >nul 2>nul
  if %ERRORLEVEL% EQU 0 (
    set "PYTHON_CMD=python"
  ) else (
    echo Python was not found.
    echo Install Python or run this from a computer that has Python available.
    pause
    exit /b 1
  )
)

echo.
echo Starting KBC Financial Operations Documentation
echo Local address: http://127.0.0.1:%PORT%/
echo.
echo Leave this window open while using the site.
echo Press Ctrl+C in this window to stop the site.
echo.

start "" "http://127.0.0.1:%PORT%/"
%PYTHON_CMD% -m http.server %PORT% --bind 127.0.0.1

echo.
echo Local site stopped.
pause
"""
