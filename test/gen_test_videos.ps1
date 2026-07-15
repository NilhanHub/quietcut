# Generate test videos for Round 2 smoke tests
# Run: powershell -File test\gen_test_videos.ps1

$ErrorActionPreference = "Stop"
$root = "D:\Repo\silence-cutter"
$manyPath = Join-Path $root "test_many_segments_input.mp4"
$shortPath = Join-Path $root "test_silence_input.mp4"

if (-not (Test-Path $shortPath)) {
  Write-Output "Generating short test video (6s) at: $shortPath"
  ffmpeg -y -f lavfi -i "anoisesrc=color=white:duration=6:sample_rate=44100" `
    -af "volume='if(gt(mod(floor(t/2),2),0),0,1):eval=frame'" `
    -f lavfi -i "color=c=black:s=320x240:r=30:d=6" -shortest `
    -c:v libx264 -preset fast -c:a aac -t 6 $shortPath 2>$null | Out-Null
}

$inputDur1 = ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $shortPath 2>$null
Write-Output "Short test video duration: $inputDur1"

# Many-segments test video: 0.35s silence + 0.35s tone, 400 phases => ~200 silence sections, 140s
# Each silence is 0.35s > silencedetect d=0.3 threshold, so all >= 100 detected
$phaseSeconds = 0.35
$totalPhases = 400
$totalDur = $phaseSeconds * $totalPhases  # 140 seconds total

Write-Output "Generating many-segments test video (~$totalPhases phases, $totalDur seconds, ~200 silence sections)..."
ffmpeg -y `
  -f lavfi -i "aevalsrc=exprs='if(eq(mod(floor(t/$phaseSeconds),2),1),0,sin(2*PI*440*t))':d=$totalDur:s=44100" `
  -f lavfi -i "color=c=black:s=320x240:r=30:d=$totalDur" -shortest `
  -c:v libx264 -preset fast -c:a aac -t $totalDur $manyPath 2>$null | Out-Null

$inputDur = ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $manyPath 2>$null
Write-Output "Many-segments test video: $manyPath (duration: $inputDur)"

# Count silence sections by detection
Write-Output ""
Write-Output "Verifying silence detection..."
$detectOut = ffmpeg -i $manyPath -af "silencedetect=noise=-30dB:d=0.3" -f null - 2>&1 | Out-String
$silCount = ([regex]::Matches($detectOut, "silence_start")).Count
Write-Output "Detected silence starts: $silCount"

Write-Output ""
Write-Output "Done."