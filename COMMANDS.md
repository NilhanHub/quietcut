# COMMANDS.md — Round 3

## Development
```bash
npm run dev           # Start Vite dev server + Electron
npm run dev:renderer  # Vite dev server only
npm run dev:electron  # Electron with dev mode
```

## Build
```bash
npm run build          # Full build (renderer + electron)
npm run build:renderer # Vite production build
npm run build:electron # Electron build script
npm run package        # Build + electron-builder --win
```

## Quality
```bash
npx vitest run         # Run all tests
npx tsc --noEmit       # Typecheck
```

## Smoke Test (generated video)
```bash
ffmpeg -y -f lavfi -i "color=c=blue:d=30:r=30:size=640x480" -f lavfi -i "sine=frequency=440:duration=10" -f lavfi -i "anullsrc=r=44100:cl=mono:d=20" -filter_complex "[1:a][2:a]concat=n=2:v=0:a=1[a]" -map "0:v" -map "[a]" -c:v libx264 -preset ultrafast -crf 30 -c:a aac -shortest test_output/smoke_test.mp4
.\auto-editor-x86_64.exe test_output/smoke_test.mp4 -o test_output/smoke_test_cut.mp4 --no-open --margin 0.2s --when-silent cut
```

## Screenshot Verification
```bash
npx vite preview --port 5199
# Navigate to http://localhost:5199/ with Playwright
```
