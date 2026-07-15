# NEXT_ACTIONS.md — Round 3

## Immediate
- Git commit Round 3 changes (source, tests, evidence, docs)

## Next Round Candidates (priority order)
1. **Silent section count display** — Parse AE stdout to extract silent/keep section counts and show in UI (currently -1)
2. **Progress percentage** — Parse AE progress (% complete) from stdout and display during processing
3. **VAD threshold control** — Expose AE's silence threshold as a user-adjustable setting
4. **Batch processing** — Queue and process multiple files sequentially

## If Nilhan Reports Issues
- Check: output path auto-suggestion working?
- Check: path mismatch warning appearing when applicable?
- Check: failure state showing log lines?
- Check: ANSI noise removed from log panel?

## Known Limitations
- Silent section count not parsed from AE output
- Progress percentage not displayed during processing
- No dark/light theme toggle
- No persistent settings between sessions
