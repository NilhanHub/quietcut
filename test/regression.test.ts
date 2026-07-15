import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const FIXTURES = path.resolve('test/fixtures')
const TEST_FILE = path.join(FIXTURES, 'test_video.mp4')
const TEST_FILE_ALT = path.join(FIXTURES, 'other_video.mov')

beforeAll(() => {
  if (!fs.existsSync(FIXTURES)) {
    fs.mkdirSync(FIXTURES, { recursive: true })
  }
})

afterAll(() => {
  for (const f of fs.readdirSync(FIXTURES)) {
    const fp = path.join(FIXTURES, f)
    if (fp !== TEST_FILE && fp !== TEST_FILE_ALT) {
      try { fs.unlinkSync(fp) } catch {}
    }
  }
})

// ── stripAnsi ──
function stripAnsi(str: string): string {
  return str.replace(/\x1B(?:\[[0-9;]*[a-zA-Z]|\]\d+;[^\x07]*\x07|.)/g, '').replace(/[▏▎▍▌▋▊▉█▐▖▗▘▙▚▛▜▝▞▟░▒▓⎺⎻⎼⎽⏳⏩⏪◉◌○●⬤✔✘⚠⬜⬛☐☑☒⟳…𑁍]/g, '').replace(/\s*\d+%\s*ETA[^\n]*/g, '').replace(/⎼.*$/gm, '').trim()
}

describe('stripAnsi', () => {
  it('removes ANSI escape codes', () => {
    const input = '\x1B[32mhello\x1B[0m world'
    expect(stripAnsi(input)).toBe('hello world')
  })

  it('removes progress bar spinner chars', () => {
    const input = 'Processing: █████ 50% ETA 10s'
    expect(stripAnsi(input)).toBe('Processing:')
  })

  it('removes percentage progress lines', () => {
    const input = ' 42% ETA 2:30\nreal content'
    expect(stripAnsi(input)).toBe('real content')
  })

  it('handles clean text without escaping', () => {
    const input = 'Finished. took 139.63 seconds'
    expect(stripAnsi(input)).toBe('Finished. took 139.63 seconds')
  })
})

// ── generateOutputPath ──

function makeTempDir(): string {
  const d = path.join(FIXTURES, `genpath_${Date.now()}`)
  fs.mkdirSync(d, { recursive: true })
  return d
}

function cleanTempDir(d: string) {
  try {
    for (const f of fs.readdirSync(d)) fs.unlinkSync(path.join(d, f))
    fs.rmdirSync(d)
  } catch {}
}

describe('generateOutputPath', () => {
  it('returns _cut path in same folder', () => {
    const dir = makeTempDir()
    const input = path.join(dir, 'video.mp4')
    fs.writeFileSync(input, 'fake')
    const result = generateOutputPath(input)
    expect(result).toBe(path.join(dir, 'video_cut.mp4'))
    cleanTempDir(dir)
  })

  it('appends _cut_1 when _cut exists', () => {
    const dir = makeTempDir()
    const input = path.join(dir, 'video.mp4')
    const existing = path.join(dir, 'video_cut.mp4')
    fs.writeFileSync(input, 'fake')
    fs.writeFileSync(existing, 'fake')
    const result = generateOutputPath(input)
    expect(result).toBe(path.join(dir, 'video_cut_1.mp4'))
    cleanTempDir(dir)
  })

  it('appends _cut_2 when _cut and _cut_1 exist', () => {
    const dir = makeTempDir()
    const input = path.join(dir, 'video.mp4')
    fs.writeFileSync(input, 'fake')
    fs.writeFileSync(path.join(dir, 'video_cut.mp4'), 'fake')
    fs.writeFileSync(path.join(dir, 'video_cut_1.mp4'), 'fake')
    const result = generateOutputPath(input)
    expect(result).toBe(path.join(dir, 'video_cut_2.mp4'))
    cleanTempDir(dir)
  })

  it('handles absolute paths', () => {
    const dir = makeTempDir()
    const input = path.join(dir, 'subdir', 'video.mp4')
    fs.mkdirSync(path.join(dir, 'subdir'), { recursive: true })
    fs.writeFileSync(input, 'fake')
    const result = generateOutputPath(input)
    expect(result).toBe(path.join(dir, 'subdir', 'video_cut.mp4'))
    expect(path.isAbsolute(result)).toBe(true)
    cleanTempDir(dir)
  })

  it('uses Date.now fallback after 100 collisions', () => {
    const dir = makeTempDir()
    const input = path.join(dir, 'video.mp4')
    fs.writeFileSync(input, 'fake')
    for (let i = 0; i < 100; i++) {
      const name = i === 0 ? 'video_cut.mp4' : `video_cut_${i}.mp4`
      fs.writeFileSync(path.join(dir, name), 'fake')
    }
    const result = generateOutputPath(input)
    expect(result).toContain('video_cut_')
    expect(result).toMatch(/\d{13,}/)
    cleanTempDir(dir)
  })
})

function generateOutputPath(inputPath: string): string {
  const dir = path.dirname(inputPath)
  const ext = path.extname(inputPath)
  const base = path.basename(inputPath, ext)
  let candidate = path.join(dir, `${base}_cut${ext}`)
  if (!fs.existsSync(candidate)) return candidate
  for (let i = 1; i < 100; i++) {
    candidate = path.join(dir, `${base}_cut_${i}${ext}`)
    if (!fs.existsSync(candidate)) return candidate
  }
  return path.join(dir, `${base}_cut_${Date.now()}${ext}`)
}

// ── searchAlternateOutput ──

describe('searchAlternateOutput', () => {
  it('finds _ALTERED file in input dir', () => {
    const dir = makeTempDir()
    const input = path.join(dir, 'video.mp4')
    const altered = path.join(dir, 'video_ALTERED.mp4')
    fs.writeFileSync(input, 'fake')
    fs.writeFileSync(altered, 'content')
    fs.utimesSync(altered, new Date(), new Date())
    const result = searchAlternateOutput(path.join(dir, 'nonexistent_cut.mp4'), input)
    expect(result).toBe(path.resolve(altered))
    cleanTempDir(dir)
  })

  it('finds _cut file in input dir when path differs', () => {
    const dir = makeTempDir()
    const input = path.join(dir, 'video.mp4')
    const cut = path.join(dir, 'video_cut.mp4')
    fs.writeFileSync(input, 'fake')
    fs.writeFileSync(cut, 'content')
    fs.utimesSync(cut, new Date(), new Date())
    const result = searchAlternateOutput(path.join(dir, 'other', 'output.mp4'), input)
    expect(result).toBe(path.resolve(cut))
    cleanTempDir(dir)
  })

  it('returns null when no alternate exists', () => {
    const dir = makeTempDir()
    const input = path.join(dir, 'video.mp4')
    fs.writeFileSync(input, 'fake')
    const result = searchAlternateOutput(path.join(dir, 'nonexistent.mp4'), input)
    expect(result).toBeNull()
    cleanTempDir(dir)
  })

  it('returns null on empty alternate file', () => {
    const dir = makeTempDir()
    const input = path.join(dir, 'video.mp4')
    const altered = path.join(dir, 'video_ALTERED.mp4')
    fs.writeFileSync(input, 'fake')
    fs.writeFileSync(altered, '')
    const result = searchAlternateOutput(path.join(dir, 'nonexistent.mp4'), input)
    expect(result).toBeNull()
    cleanTempDir(dir)
  })
})

function searchAlternateOutput(expectedPath: string, inputPath: string): string | null {
  const candidates: string[] = []
  const dir = path.dirname(expectedPath)
  const ext = path.extname(expectedPath)
  const base = path.basename(expectedPath, ext)
  const inputDir = path.dirname(inputPath)
  const inputExt = path.extname(inputPath)
  const inputBase = path.basename(inputPath, inputExt)

  candidates.push(path.join(dir, `${base}_ALTERED${ext}`))
  candidates.push(path.join(dir, `${base}_cut${ext}`))
  candidates.push(path.join(inputDir, `${inputBase}_cut${inputExt}`))
  candidates.push(path.join(inputDir, `${inputBase}_ALTERED${inputExt}`))
  candidates.push(expectedPath.replace(/\\/g, '/'))
  candidates.push(expectedPath.replace(/\//g, '\\'))

  try {
    const cwdFiles = fs.readdirSync(process.cwd())
    for (const f of cwdFiles) {
      if (f.endsWith('_cut.mp4') || f.endsWith('_ALTERED.mp4') || f.endsWith('_cut.mov') || f.endsWith('_ALTERED.mov')) {
        candidates.push(path.join(process.cwd(), f))
      }
    }
  } catch {}

  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).size > 0) return path.resolve(c)
    } catch {}
  }
  return null
}

// ── verifyOutput ──

describe('verifyOutput', () => {
  it('returns success when file exists with recent mtime', () => {
    const dir = makeTempDir()
    const fp = path.join(dir, 'output.mp4')
    fs.writeFileSync(fp, 'content')
    const start = Date.now() - 100
    fs.utimesSync(fp, new Date(), new Date())
    const result = verifyOutput(fp, start)
    expect(result.success).toBe(true)
    expect(result.outputPath).toBe(fp)
    expect(result.pathMismatch).toBeUndefined()
    cleanTempDir(dir)
  })

  it('returns false-failure when output missing and no alternate', () => {
    const result = verifyOutput(path.join(FIXTURES, 'definitely_not_here_12345.mp4'), Date.now())
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/was not created/)
  })

  it('rejects empty file', () => {
    const dir = makeTempDir()
    const fp = path.join(dir, 'empty.mp4')
    fs.writeFileSync(fp, '')
    const result = verifyOutput(fp, Date.now() - 1000)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/empty/)
    cleanTempDir(dir)
  })

  it('returns pathMismatch when output found at alternate location', () => {
    const dir = makeTempDir()
    const input = path.join(dir, 'video.mp4')
    const altered = path.join(dir, 'video_ALTERED.mp4')
    fs.writeFileSync(input, 'fake')
    fs.writeFileSync(altered, 'real content')
    const start = Date.now() - 500
    const result = verifyOutput(path.join(dir, 'nonexistent_cut.mp4'), start, input)
    expect(result.success).toBe(true)
    expect(result.pathMismatch).toBe(true)
    expect(result.alternateOutputPath).toBeTruthy()
    expect(result.outputPath).toBeTruthy()
    cleanTempDir(dir)
  })
})

function verifyOutput(outputPath: string, startTime: number, inputPath?: string): {
  success: boolean
  outputPath?: string
  alternateOutputPath?: string
  pathMismatch?: boolean
  exitCode?: number
  error?: string
  processingTime: number
} {
  const processingTime = Date.now() - startTime

  if (fs.existsSync(outputPath)) {
    const stat = fs.statSync(outputPath)
    if (stat.size === 0) {
      return { success: false, error: 'Output file is empty.', processingTime }
    }
    if (stat.mtimeMs >= startTime) {
      return { success: true, outputPath, exitCode: 0, processingTime }
    }
  }

  if (inputPath) {
    const altPath = searchAlternateOutput(outputPath, inputPath)
    if (altPath) {
      const altStat = fs.statSync(altPath)
      if (altStat.size > 0 && altStat.mtimeMs >= startTime) {
        return { success: true, outputPath: altPath, alternateOutputPath: altPath, pathMismatch: true, exitCode: 0, processingTime }
      }
    }

    const inputDir = path.dirname(inputPath)
    try {
      const files = fs.readdirSync(inputDir).filter(f => {
        const fp = path.join(inputDir, f)
        try { return fs.statSync(fp).mtimeMs >= startTime && fs.statSync(fp).size > 0 } catch { return false }
      })
      if (files.length === 1) {
        const found = path.join(inputDir, files[0])
        return { success: true, outputPath: found, alternateOutputPath: found, pathMismatch: true, exitCode: 0, processingTime }
      }
    } catch {}
  }

  return { success: false, error: 'Output file was not created.', processingTime }
}
