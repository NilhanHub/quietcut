# AGENTS.md

## Project
- Name: QuietCut (silence-cutter)
- Root: D:\Repo\silence-cutter
- Stack: Electron + React + Vite + TypeScript
- Backend: Auto-Editor 31.1.2 / FFmpeg 8.0.1

## Current Round: 3 — Output Truth Repair
Fixed false-failure bug: UI reported "Output file was not created" when AE succeeded. Enhanced verifyOutput to search alternate paths, deterministic output path generation with collision handling, ANSI stripping.

## Key Commands
- `npx vitest run` — tests
- `npm run build` — full build
- `npm run typecheck` — tsc
- `npm run dev` — dev mode
