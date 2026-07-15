# QuietCut

A premium desktop application for automatically cutting silent sections from videos using Auto-Editor or FFmpeg.

## Features

- **Drag-drop or browse** to select video files
- **Auto-detect and cut silence** using real audio analysis
- **Adjustable settings**: margin, detection method, actions for silent/normal sections
- **Advanced settings**: codec, bitrate, resolution, frame rate, sample rate, scale
- **Extra arguments**: pass any Auto-Editor-supported CLI option
- **Real progress logging**: see exactly what the processing engine is doing
- **Process cancellation**: safely stop processing at any time
- **Premium UI**: dark mode, glassmorphism, clean Apple-inspired design

## Prerequisites

- **Node.js** v18+ (with npm)
- **Auto-Editor** (optional, but recommended) - download from [GitHub Releases](https://github.com/WyattBlue/auto-editor/releases)
- **FFmpeg** (required for fallback processing) - [gyan.dev FFmpeg Builds](https://www.gyan.dev/ffmpeg/builds/)
- **Python** (only needed if running auto-editor via pip)

## Quick Start

1. **Download Auto-Editor binary** (recommended):
   ```
   Place auto-editor-windows-x86_64.exe in the project root as auto-editor-x86_64.exe
   ```

2. **Install dependencies**:
   ```
   npm install
   ```

3. **Run in development mode**:
   ```
   npm run dev
   ```

4. **Build for production**:
   ```
   npm run build
   ```

## How to launch QuietCut

Double-click `launch_quietcut.bat` in the project root. The launcher will:

1. Install dependencies if `node_modules` is missing
2. Install the Electron binary if needed
3. Build the app (Vite + Electron)
4. Launch QuietCut

If anything fails, the window stays open so you can read the error.

## Usage

1. Launch QuietCut
2. Drag a video file onto the drop zone or click to browse
3. Choose or type an output file path
4. Adjust settings as needed (margin, detection method, etc.)
5. Click "Cut Silence" to start processing
6. View real-time progress in the log panel
7. When complete, click "Open Output Folder" to view the result

## Settings Explained

### Simple Settings

- **Margin**: Time before and after speech sections to keep as normal speed (e.g., "0.3s"). Prevents abrupt cuts.
- **Edit detection method**: How to detect sections to edit. "Audio" detects silence, "Motion" detects static frames.
- **When silent**: What to do with silent sections. Default is "Cut" (remove).
- **When normal**: What to do with non-silent sections. Default is no change.

### Advanced Settings

- **Video/Audio codec**: Override output encoding (e.g., libx265 for smaller files)
- **Bitrate**: Control output quality/size
- **Resolution**: Set output resolution (width,height)
- **Frame rate**: Set output frame rate
- **Sample rate**: Set audio sample rate
- **Scale**: Scale output by factor (e.g., 0.5 for half size)
- **Extra arguments**: Any additional Auto-Editor CLI arguments

## Backend

- **Primary**: Auto-Editor v31.1.2+ (Nim-based, downloaded from GitHub)
- **Fallback**: FFmpeg-based silence cutter (used when Auto-Editor is unavailable)

The app auto-detects which backend is available and shows it in the header (QE ✓/✗ + FF ✓/✗ pills).

### ENAMETOOLONG (fixed in v1.1)

Earlier FFmpeg fallback built a single `-filter_complex` with one trim/atrim pair per keep section. Real OBS videos with hundreds of silence/speech sections produced commands around 30 KB — too long for Windows' `CreateProcess`. The error showed up in the UI as `FFmpeg processing error: spawn ENAMETOOLONG`.

Fix: keep sections are now split into batches of at most 10 segments. Each batch uses a small filter_complex; all batch outputs are concatenated via the **concat demuxer** with a file list. Command length stays around 1.3 KB no matter how many sections are detected.

### Logs and diagnostics

- Per-run log files are written to `logs/run_YYYY-MM-DD-HH-MM-SS_xxxxxx.log` in the project folder.
- The in-app **Backend Diagnostics** panel shows AE/FFmpeg availability, the reasons when unavailable, checked paths, and selected backend.
- **Copy Diagnostic Summary**, **Open Logs Folder**, and **Export Diagnostic Pack** buttons are available.
- **Diagnostic Pack** is a small ZIP containing the latest run log, backend diagnostics, tool versions; it never includes your source video by default.
- On processing failure, the app shows a structured error card with backend, step, probable cause, suggested next action, run ID, and the log file path. Technical details are expandable.

## Project Structure

```
QuietCut/
├── electron/
│   ├── main.ts         # Electron main process
│   ├── preload.ts      # IPC bridge
│   └── backend.ts      # Processing backends (Auto-Editor + FFmpeg)
├── src/
│   ├── components/     # React UI components
│   ├── styles/         # CSS styling
│   ├── App.tsx         # Main app component
│   └── main.tsx        # Entry point
├── test/               # Tests and fixtures
├── Evidence/           # Round evidence artifacts
├── package.json
└── README.md
```

## Tests

```bash
# Unit tests (command-builder + ENAMETOOLONG regression)
npm test

# Many-segments smoke test (FFmpeg fallback, requires ffmpeg)
node test/smoke_runner.js many    # 60 sections, output around half of input
node test/smoke_runner.js short   # 1 silent section, regression

# Failure path tests
node test/failure_path_runner.js
```

## Common errors

- **"FFmpeg processing error: spawn ENAMETOOLONG"** — previously meant the command exceeded the Windows spawn limit (~32 KB). Since v1.1, FFmpeg fallback batches sections so this should not recur. If it does, use the **Export Diagnostic Pack** button and report with the run log file.
- **"Failed to start Auto-Editor"** — Auto-Editor binary not found. Place `auto-editor-x86_64.exe` in the project root or add it to PATH. The backend diagnostics panel shows the exact paths that were checked.
- **"Input file not found"** — chosen input file no longer exists or is not reachable from the app.
