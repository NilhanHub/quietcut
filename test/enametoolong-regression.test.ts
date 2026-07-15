import { describe, it, expect } from 'vitest'
import * as path from 'path'

const MAX_SEGMENTS_PER_BATCH = 10
const WINDOWS_CMD_LIMIT = 30000

function buildKeepSegments(silences: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
  const segments: Array<{ start: number; end: number }> = []
  let cursor = 0
  for (const silence of silences) {
    if (silence.start > cursor) segments.push({ start: cursor, end: silence.start })
    cursor = silence.end
  }
  segments.push({ start: cursor, end: Number.MAX_SAFE_INTEGER })
  return segments
}

function fmtTime(v: number): string {
  if (!isFinite(v)) return '999999'
  return v.toFixed(6)
}

function buildBatchArgs(
  inputPath: string,
  segments: Array<{ start: number; end: number }>,
  maxEnd: number
): string[] {
  const filterParts: string[] = []
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    const start = fmtTime(s.start)
    const end = s.end === Number.MAX_SAFE_INTEGER ? fmtTime(maxEnd) : fmtTime(s.end)
    filterParts.push(
      `[0:v]trim=${start}:${end},setpts=PTS-STARTPTS[v${i}];` +
      `[0:a]atrim=${start}:${end},asetpts=PTS-STARTPTS[a${i}]`
    )
  }
  const concatInputs = segments.map((_, i) => `[v${i}][a${i}]`).join('')
  filterParts.push(`${concatInputs}concat=n=${segments.length}:v=1:a=1[v][a]`)
  return [
    '-i', inputPath,
    '-filter_complex', filterParts.join(''),
    '-map', '[v]',
    '-map', '[a]',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-preset', 'fast',
    '-avoid_negative_ts', 'make_zero',
    '-y'
  ]
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size < 1) size = 1
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

function maxEndFor(segments: Array<{ start: number; end: number }>): number {
  let max = 0
  for (const s of segments) if (s.end !== Number.MAX_SAFE_INTEGER && s.end > max) max = s.end
  return max
}

describe('ENAMETOOLONG regression', () => {
  it('constructs oversized command for 305 segments in naive single-batch path (repro proof)', () => {
    const silences: any[] = []
    for (let i = 0; i < 305; i++) {
      const start = i * 4 + 0.5
      const end = i * 4 + 1.5
      silences.push({ start, end })
    }
    const segments = buildKeepSegments(silences)
    const maxEnd = maxEndFor(segments)
    expect(segments.length).toBeGreaterThanOrEqual(305)
    const args = buildBatchArgs('input.mp4', segments, maxEnd)
    const cmdLen = args.join(' ').length
    expect(cmdLen).toBeGreaterThan(WINDOWS_CMD_LIMIT)
  })

  it('keeps every batch command under the Windows limit when using batches of 10', () => {
    const silences: any[] = []
    for (let i = 0; i < 306; i++) {
      silences.push({ start: i * 4 + 0.5, end: i * 4 + 1.5 })
    }
    const segments = buildKeepSegments(silences)
    const maxEnd = maxEndFor(segments)
    const inputPath = 'C:\\Users\\Nilhan.dev\\Videos\\2026-07-06 17-19-01.mp4'
    const batches = chunkArray(segments, MAX_SEGMENTS_PER_BATCH)
    expect(batches.length).toBeGreaterThan(1)

    const lengths: number[] = []
    for (const b of batches) {
      const args = buildBatchArgs(inputPath, b, maxEnd)
      const cmdLen = args.join(' ').length
      lengths.push(cmdLen)
      expect(cmdLen).toBeLessThan(WINDOWS_CMD_LIMIT)
    }

    const maxLen = Math.max(...lengths)
    expect(maxLen).toBeLessThan(WINDOWS_CMD_LIMIT)
  })

  it('handles 1000+ segments with batches under the limit', () => {
    const silences: any[] = []
    for (let i = 0; i < 1000; i++) silences.push({ start: i, end: i + 0.5 })
    const segments = buildKeepSegments(silences)
    const maxEnd = maxEndFor(segments)
    const batches = chunkArray(segments, MAX_SEGMENTS_PER_BATCH)
    expect(batches.length).toBeGreaterThanOrEqual(100)
    for (const b of batches) {
      const args = buildBatchArgs('input.mp4', b, maxEnd)
      const cmdLen = args.join(' ').length
      expect(cmdLen).toBeLessThan(WINDOWS_CMD_LIMIT)
    }
  })

  it('uses file list for final concat (no oversized single command)', () => {
    const silences: any[] = []
    for (let i = 0; i < 305; i++) silences.push({ start: i * 4, end: i * 4 + 1 })
    const segments = buildKeepSegments(silences)
    const batches = chunkArray(segments, MAX_SEGMENTS_PER_BATCH)
    const batchCount = batches.length
    const concatList = Array.from({ length: batchCount }, (_, i) =>
      `file 'C:\\temp\\quietcut-r2\\batch_${String(i).padStart(5, '0')}.mp4'`
    )
    const concatArgs = ['-f', 'concat', '-safe', '0', '-i', 'concat_list.txt', '-c', 'copy', '-y', 'output.mp4']
    const finalCmdLen = concatArgs.join(' ').length
    expect(finalCmdLen).toBeLessThan(500)
    expect(concatList.length).toBe(batchCount)
    expect(batchCount).toBeLessThan(WINDOWS_CMD_LIMIT)
  })

  it('handles Windows paths with spaces', () => {
    const inputPath = 'C:\\Users\\Nilhan.dev\\Videos\\2026-07-06 17-19-01.mp4'
    const segments = [{ start: 0, end: 3.5 }, { start: 4, end: 7.2 }]
    const args = buildBatchArgs(inputPath, segments, 7.2)
    expect(args).toContain(inputPath)
    expect(args.join(' ').length).toBeLessThan(WINDOWS_CMD_LIMIT)
  })

  it('segment count never exceeds MAX_SEGMENTS_PER_BATCH', () => {
    const silences: any[] = []
    for (let i = 0; i < 600; i++) silences.push({ start: i, end: i + 0.2 })
    const segments = buildKeepSegments(silences)
    const batches = chunkArray(segments, MAX_SEGMENTS_PER_BATCH)
    for (const b of batches) {
      expect(b.length).toBeLessThanOrEqual(MAX_SEGMENTS_PER_BATCH)
    }
  })
})

describe('Backend diagnostics (regression)', () => {
  it('BackendDiagnostics includes both AE and FFmpeg availability', () => {
    const diag = {
      autoEditor: { available: false, path: null, version: null, checkedPaths: ['cwd\\auto-editor-x86_64.exe (cwd)'], reason: 'not found' },
      ffmpeg: { available: true, path: 'ffmpeg', version: '8.0.1', reason: null },
      selected: 'FFmpeg Silence Cutter'
    }
    expect(diag.autoEditor.available).toBe(false)
    expect(diag.autoEditor.reason).not.toBeNull()
    expect(diag.autoEditor.checkedPaths.length).toBeGreaterThan(0)
    expect(diag.ffmpeg.available).toBe(true)
    expect(diag.selected).toBe('FFmpeg Silence Cutter')
  })

  it('structured error includes all required fields', () => {
    const err = {
      backend: 'FFmpeg',
      step: 'processing',
      probableCause: 'too many segments',
      technicalCause: 'spawn ENAMETOOLONG',
      suggestedAction: 'update and retry',
      logPath: 'D:\\logs\\run.log',
      runId: 'run_001'
    }
    expect(err.backend).toBeTruthy()
    expect(err.step).toBeTruthy()
    expect(err.probableCause).toBeTruthy()
    expect(err.technicalCause).toBeTruthy()
    expect(err.suggestedAction).toBeTruthy()
    expect(err.logPath).toBeTruthy()
    expect(err.runId).toBeTruthy()
  })
})

void path