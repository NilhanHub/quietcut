@echo off
REM Creates test video fixtures for QuietCut testing
REM Generates: test_silence_input.mp4 (6s: audio + silence + audio)

echo Creating test fixtures...
echo.

REM Generate test video with audio-silence-audio pattern
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=2" ^
       -f lavfi -i "anullsrc=r=44100:cl=mono" ^
       -f lavfi -i "sine=frequency=880:duration=2" ^
       -filter_complex "[0:a][1:a][2:a]concat=n=3:v=0:a=1[a]" ^
       -f lavfi -i "color=c=blue:size=640x480:duration=6" ^
       -map "[a]" -map "3:v" -c:v libx264 -c:a aac -shortest -t 6 test_silence_input.mp4

if errorlevel 1 (
    echo FAILED to create test fixture
    exit /b 1
)

echo Created test_silence_input.mp4 successfully
echo.

REM Verify duration
for /f "delims=" %%D in ('ffprobe -v error -show_entries format^=duration -of default^=noprint_wrappers^=1:nokey^=1 test_silence_input.mp4') do set DUR=%%D
echo Duration: %DUR%s

echo.
echo Test fixtures ready.
