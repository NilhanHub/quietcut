@echo off
REM ========================================
REM Failure Path Tests
REM ========================================
echo === Failure Path Tests ===
echo.

set AE_EXE="D:\Repo\silence-cutter\auto-editor-x86_64.exe"

REM Test 1: Missing input file
echo [Test 1] Missing input file...
%AE_EXE% "D:\Repo\silence-cutter\nonexistent_video.mp4" -o "D:\Repo\silence-cutter\fail_output.mp4" --no-open 2>&1
if errorlevel 1 (
    echo  PASS: Auto-Editor correctly reports error for missing input (exit code %errorlevel%)
) else (
    echo  WARN: Auto-Editor exit code 0 for missing input
)
echo.

REM Test 2: Invalid output location
echo [Test 2] Invalid output path...
REM This test depends on the system - output to a non-existent directory
%AE_EXE% "D:\Repo\silence-cutter\test_input.mp4" -o "Z:\nonexistent\output.mp4" --no-open 2>&1
echo  EXIT CODE: %errorlevel%
echo.

REM Test 3: Non-video file as input
echo [Test 3] Non-video file as input...
echo this is not a video > "D:\Repo\silence-cutter\not_a_video.txt"
%AE_EXE% "D:\Repo\silence-cutter\not_a_video.txt" -o "D:\Repo\silence-cutter\fail_output2.mp4" --no-open 2>&1
if errorlevel 1 (
    echo  PASS: Auto-Editor correctly reports error for invalid file (exit code %errorlevel%)
) else (
    echo  WARN: Auto-Editor exit code 0 for non-video input
)
echo.

REM Cleanup
del "D:\Repo\silence-cutter\not_a_video.txt" 2>nul
del "D:\Repo\silence-cutter\fail_output.mp4" 2>nul
del "D:\Repo\silence-cutter\fail_output2.mp4" 2>nul

echo === Failure Path Tests Complete ===
