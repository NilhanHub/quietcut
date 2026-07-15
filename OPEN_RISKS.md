# OPEN_RISKS.md — Round 3

## Active Risks

| Risk | Likelihood | Impact | Status |
|------|-----------|--------|--------|
| searchAlternateOutput finds wrong file (stale) | Low | Medium | Mitigated (mtime check) |
| 100+ collision fallback produces confusing name | Very Low | Low | Accepted |
| ANSI stripping removes legitimate content | Low | Low | Mitigated (raw logs preserved) |

## Eliminated Risks
- Silent overwrite of existing output file: ELIMINATED by generateOutputPath collision handling
- False failure when output exists: ELIMINATED by enhanced verifyOutput
- Real video smoke test corruption: ELIMINATED by unique output naming

## No Unmitigated Risks
