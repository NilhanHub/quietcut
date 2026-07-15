import { spawn, ChildProcess, execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import type {
  ProcessingOptions,
  BackendInfo,
  BackendDiagnostics,
  FileInfo,
  ProcessingResult,
  StructuredError,
  RunSummary,
  DiagnosticPackResult
} from './types'
import { Logger } from './logger'

const APP_VERSION = '1.1.0'
const MAX_SEGMENTS_PER_BATCH = 10
const WINDOWS_CMD_LIMIT = 30000
const DIAGNOSTIC_PACK_DIR_ENV = 'QUIETCUT_LOG_DIR'

function stripAnsi(str: string): string {
  return str.replace(/\x1B(?:\[[0-9;]*[a-zA-Z]|\]\d+;[^\x07]*\x07|.)/g, '').replace(/[▏▎▍▌▋▊▉█▐▖▗▘▙▚▛▜▝▞▟░▒▓⎺⎻⎼⎽⏳⏩⏪◉◌○●⬤✔✘⚠⬜⬛☐☑☒⟳…𑁍]/g, '').replace(/\s*\d+%\s*ETA[^\n]*/g, '').replace(/⎼.*$/gm, '').trim()
}

export class ProcessingBackend {
  private currentProcess: ChildProcess | null = null
  private cancelRequested = false
  private logs: string[] = []
  lastOptions: ProcessingOptions | null = null

  private aePath: string | null = null
  private aeVersion: string | null = null
  private aeAvailable = false
  private aeReason: string | null = null
  private aeCheckedPaths: string[] = []

  private ffmpegAvailable = false
  private ffmpegVersion: string | null = null
  private ffmpegPath: string | null = null
  private ffmpegReason: string | null = null

  async detectBackend(): Promise<void> {
    this.checkAutoEditor()
    this.checkFfmpeg()
  }

  private checkAutoEditor(): void {
    const candidates: Array<{ p: string; label: string }> = []

    if (process.resourcesPath) {
      candidates.push({ p: path.join(process.resourcesPath, 'auto-editor-x86_64.exe'), label: 'packaged-resource' })
    }

    const cwd = process.cwd()
    candidates.push({ p: path.join(cwd, 'auto-editor-x86_64.exe'), label: 'cwd' })
    candidates.push({ p: path.join(cwd, 'auto-editor.exe'), label: 'cwd-generic' })

    const dirOfMain = path.dirname(process.argv[1] || __dirname)
    candidates.push({ p: path.join(dirOfMain, '../auto-editor-x86_64.exe'), label: 'main-dir-parent' })
    candidates.push({ p: path.join(dirOfMain, '../../auto-editor-x86_64.exe'), label: 'main-dir-2up' })

    candidates.push({ p: 'auto-editor', label: 'PATH' })
    candidates.push({ p: 'auto-editor.exe', label: 'PATH-exe' })

    for (const c of candidates) {
      this.aeCheckedPaths.push(`${c.p} (${c.label})`)
      try {
        if (!fs.existsSync(c.p) && !c.label.startsWith('PATH')) continue
        const result = execSync(`"${c.p}" --version`, { timeout: 5000, encoding: 'utf-8' })
        const version = result.trim()
        if (version.length > 0 && version.length < 50) {
          this.aePath = c.p
          this.aeVersion = version
          this.aeAvailable = true
          this.aeReason = null
          return
        }
        this.aeReason = `Found at ${c.p} but returned empty version`
      } catch (e: any) {
        if (e.status !== undefined && e.code !== 'ENOENT') {
          this.aeReason = `Checked ${c.p}: ${e.code || e.message || 'failed'}`
        }
      }
    }

    if (!this.aeReason) {
      this.aeReason = `Auto-Editor binary not found in any of ${candidates.length} checked locations`
    }
  }

  private checkFfmpeg(): void {
    try {
      const out = execSync('ffmpeg -version', { timeout: 5000, encoding: 'utf-8' })
      this.ffmpegAvailable = true
      this.ffmpegPath = 'ffmpeg'
      const m = out.match(/ffmpeg version\s+([^\s]+)/)
      this.ffmpegVersion = m ? m[1] : 'unknown'
      this.ffmpegReason = null
    } catch (e: any) {
      this.ffmpegAvailable = false
      this.ffmpegReason = `ffmpeg not on PATH: ${e.code || e.message}`
    }
  }

  getInfo(): BackendInfo {
    if (this.aeAvailable) {
      return {
        available: true,
        name: 'Auto-Editor',
        version: this.aeVersion,
        path: this.aePath
      }
    }
    if (this.ffmpegAvailable) {
      return {
        available: true,
        name: 'FFmpeg Silence Cutter',
        version: null,
        path: 'ffmpeg'
      }
    }
    return {
      available: false,
      name: 'None',
      version: null,
      path: null
    }
  }

  getDiagnostics(): BackendDiagnostics {
    let selected = 'None'
    if (this.aeAvailable) selected = 'Auto-Editor'
    else if (this.ffmpegAvailable) selected = 'FFmpeg Silence Cutter'
    return {
      autoEditor: {
        available: this.aeAvailable,
        path: this.aePath,
        version: this.aeVersion,
        checkedPaths: this.aeCheckedPaths,
        reason: this.aeReason
      },
      ffmpeg: {
        available: this.ffmpegAvailable,
        path: this.ffmpegPath,
        version: this.ffmpegVersion,
        reason: this.ffmpegReason
      },
      selected
    }
  }

  getLastOptions(): ProcessingOptions | null {
    return this.lastOptions
  }

  buildStructuredError(
    backend: string,
    step: string,
    probableCause: string,
    technicalCause: string,
    suggestedAction: string,
    logger: Logger
  ): StructuredError {
    return {
      backend,
      step,
      probableCause,
      technicalCause,
      suggestedAction,
      logPath: logger.filePath,
      runId: logger.runIdStr
    }
  }

  async getFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
      const stats = fs.statSync(filePath)
      const name = path.basename(filePath)
      let duration: number | null = null
      try {
        const result = execSync(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
          { timeout: 10000, encoding: 'utf-8' }
        )
        duration = parseFloat(result.trim()) || null
      } catch {
        // duration unavailable
      }
      return { duration, size: stats.size, path: filePath, name }
    } catch {
      return null
    }
  }

  async run(
    options: ProcessingOptions,
    onLog: (data: string) => void
  ): Promise<ProcessingResult> {
    this.cancelRequested = false
    this.logs = []
    this.lastOptions = { ...options }
    const startTime = Date.now()

    const logger = new Logger(Logger.appLogDir())
    logger.appendSection('Backend Diagnostics', this.getDiagnostics())

    this.addLog(`Run ID: ${logger.runIdStr}`, onLog)
    this.addLog(`Backend: ${this.getInfo().name}`, onLog)
    this.addLog(`Input: ${options.inputPath}`, onLog)
    this.addLog(`Output: ${options.outputPath}`, onLog)
    logger.appendSection('Input', options.inputPath)
    logger.appendSection('Output', options.outputPath)
    logger.appendSection('Settings', options)

    try {
      if (this.aeAvailable) {
        const r = await this.runAutoEditor(options, onLog, startTime, logger)
        logger.flush()
        return r
      } else if (this.ffmpegAvailable) {
        const r = await this.runFFmpegSilenceCutter(options, onLog, startTime, logger)
        logger.flush()
        return r
      } else {
        logger.appendSection('Error', 'No processing backend available')
        logger.flush()
        return {
          success: false,
          error: 'No processing backend available. Install Auto-Editor or FFmpeg.',
          structuredError: this.buildStructuredError(
            'None',
            'init',
            'No backend installed',
            'Auto-Editor and FFmpeg both unavailable',
            'Install Auto-Editor (download from GitHub releases) or add FFmpeg to PATH',
            logger
          ),
          logs: this.logs,
          processingTime: Date.now() - startTime,
          runId: logger.runIdStr,
          runLogPath: logger.filePath
        }
      }
    } catch (err: any) {
      logger.appendSection('Unhandled Error', err.stack || err.message)
      logger.flush()
      return {
        success: false,
        error: err.message,
        structuredError: this.buildStructuredError(
          this.aeAvailable ? 'Auto-Editor' : 'FFmpeg',
          'unknown',
          'Unexpected error during processing',
          err.message,
          'Review the run log file for details',
          logger
        ),
        logs: this.logs,
        processingTime: Date.now() - startTime,
        runId: logger.runIdStr,
        runLogPath: logger.filePath
      }
    }
  }

  private async runAutoEditor(
    options: ProcessingOptions,
    onLog: (data: string) => void,
    startTime: number,
    logger: Logger
  ): Promise<ProcessingResult> {
    const args = this.buildAutoEditorArgs(options)

    const cmdPreview = `${this.aePath} ${args.join(' ')}`
    const cmdLen = cmdPreview.length
    this.addLog(`Command: ${this.aePath} ${args.join(' ')}`, onLog)
    this.addLog(`Command arg count: ${args.length}, total length: ${cmdLen}`, onLog)
    logger.appendSection('Command Preview', cmdPreview)
    logger.append(`  arg_count: ${args.length}`)
    logger.append(`  total_length: ${cmdLen}`)

    return new Promise((resolve) => {
      const proc = spawn(this.aePath!, args, { stdio: ['pipe', 'pipe', 'pipe'] })
      this.currentProcess = proc

      let stdout = ''
      const stderrLines: string[] = []

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        stdout += text
        const clean = stripAnsi(text).trim()
        if (clean) this.addLog(clean, onLog)
      })

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        stderrLines.push(text)
        if (text.trim()) this.addLog(text.trim(), onLog)
      })

      proc.on('close', (exitCode) => {
        this.currentProcess = null
        const processingTime = Date.now() - startTime

        logger.appendSection('stdout', stdout)
        logger.appendSection('stderr', stderrLines.join(''))
        logger.append(`exit_code: ${exitCode}`)

        if (this.cancelRequested) {
          this.addLog('Processing cancelled by user.', onLog)
          logger.flush()
          resolve({
            success: false,
            exitCode,
            error: 'Cancelled',
            processingTime,
            logs: this.logs,
            runId: logger.runIdStr,
            runLogPath: logger.filePath
          })
          return
        }

        if (exitCode !== 0) {
          this.addLog(`Auto-Editor exited with code ${exitCode}`, onLog)
          logger.flush()
          resolve({
            success: false,
            exitCode,
            error: `Auto-Editor exited with code ${exitCode}`,
            structuredError: this.buildStructuredError(
              'Auto-Editor',
              'run',
              'Auto-Editor returned a non-zero exit code',
              `exit_code=${exitCode}`,
              'Check the run log for Auto-Editor stderr; verify input file format',
              logger
            ),
            processingTime,
            logs: this.logs,
            runId: logger.runIdStr,
            runLogPath: logger.filePath
          })
          return
        }

        const result = this.verifyOutput(options.outputPath, startTime, options.inputPath)
        logger.appendSection('Output Verification', result)
        logger.flush()
        resolve({
          ...result,
          logs: this.logs,
          runId: logger.runIdStr,
          runLogPath: logger.filePath,
          summary: {
            runId: logger.runIdStr,
            logPath: logger.filePath,
            backend: 'Auto-Editor',
            commandArgCount: args.length,
            commandTotalLength: cmdLen,
            silentSections: -1,
            keepSections: -1,
            exitCode,
            success: result.success,
            errorMessage: result.error || null
          }
        })
      })

      proc.on('error', (err) => {
        this.currentProcess = null
        this.addLog(`Process error: ${err.message}`, onLog)
        logger.flush()
        resolve({
          success: false,
          error: `Failed to start Auto-Editor: ${err.message}`,
          structuredError: this.buildStructuredError(
            'Auto-Editor',
            'spawn',
            'Failed to spawn Auto-Editor process',
            err.message,
            'Verify auto-editor binary exists at the detected path and is executable',
            logger
          ),
          processingTime: Date.now() - startTime,
          logs: this.logs,
          runId: logger.runIdStr,
          runLogPath: logger.filePath
        })
      })
    })
  }

  buildAutoEditorArgs(options: ProcessingOptions): string[] {
    const args: string[] = []
    args.push(options.inputPath)
    args.push('-o', options.outputPath)
    args.push('--no-open')

    if (options.margin) args.push('--margin', options.margin)
    if (options.editMethod) args.push('--edit', options.editMethod)
    if (options.whenSilent) args.push('--when-silent', options.whenSilent)
    if (options.whenNormal) args.push('--when-normal', options.whenNormal)
    if (options.videoCodec) args.push('--video-codec', options.videoCodec)
    if (options.audioCodec) args.push('--audio-codec', options.audioCodec)
    if (options.videoBitrate) args.push('--video-bitrate', options.videoBitrate)
    if (options.audioBitrate) args.push('--audio-bitrate', options.audioBitrate)
    if (options.resolution) args.push('--resolution', options.resolution)
    if (options.frameRate) args.push('--frame-rate', options.frameRate)
    if (options.sampleRate) args.push('--sample-rate', options.sampleRate)
    if (options.scale) args.push('--scale', options.scale)
    if (options.extraArgs) {
      const extra = options.extraArgs.split(/\s+/).filter(a => a.length > 0)
      args.push(...extra)
    }
    return args
  }

  private async runFFmpegSilenceCutter(
    options: ProcessingOptions,
    onLog: (data: string) => void,
    startTime: number,
    logger: Logger
  ): Promise<ProcessingResult> {
    this.addLog('Using FFmpeg-based silence cutter (Auto-Editor unavailable)', onLog)
    logger.append(`backend_note: Auto-Editor unavailable (${this.aeReason || 'unknown reason'}). Using FFmpeg fallback.`)

    const inputPath = options.inputPath
    const outputPath = options.outputPath

    if (!fs.existsSync(inputPath)) {
      const err = this.buildStructuredError(
        'FFmpeg',
        'precheck',
        'Input file does not exist',
        `File not found: ${inputPath}`,
        'Choose a valid video file and try again',
        logger
      )
      logger.flush()
      return {
        success: false,
        error: `Input file not found: ${inputPath}`,
        structuredError: err,
        processingTime: Date.now() - startTime,
        logs: this.logs,
        runId: logger.runIdStr,
        runLogPath: logger.filePath
      }
    }

    const workDir = path.join(os.tmpdir(), 'quietcut-' + logger.runIdStr)
    fs.mkdirSync(workDir, { recursive: true })
    logger.appendSection('Work Directory', workDir)

    const stages: { name: string; startMs: number; endMs: number; ok: boolean; note?: string }[] = []

    try {
      stages.push({ name: 'silence_detect', startMs: Date.now(), endMs: 0, ok: false } as any)
      const stageStart0 = Date.now()

      this.addLog('Step 1: Detecting silence in audio...', onLog)
      const marginMs = this.parseMarginToMs(options.margin || '0.2')
      const thresholdStr = marginMs > 500 ? '-50dB' : '-30dB'
      const durationStr = marginMs > 500 ? '1' : '0.3'

      logger.append(`silence_threshold: noise=${thresholdStr}, duration=${durationStr}, margin_ms=${marginMs}`)

      const silencedetect = await this.runFfmpegSilenceDetect(inputPath, thresholdStr, durationStr)
      ;(stages[0] as any).endMs = Date.now()
      ;(stages[0] as any).ok = true
      ;(stages[0] as any).note = `${silencedetect.length} silent sections detected`

      if (this.cancelRequested) {
        this.tryCleanup(workDir)
        logger.flush()
        return {
          success: false,
          error: 'Cancelled',
          processingTime: Date.now() - startTime,
          logs: this.logs,
          runId: logger.runIdStr,
          runLogPath: logger.filePath
        }
      }

      if (silencedetect.length === 0) {
        this.addLog('No silence detected, copying file directly.', onLog)
        fs.copyFileSync(inputPath, outputPath)
        this.tryCleanup(workDir)
        logger.appendSection('Output Verification', { success: true, copied: true })
        logger.flush()
        return {
          success: true,
          outputPath,
          exitCode: 0,
          processingTime: Date.now() - startTime,
          logs: this.logs,
          runId: logger.runIdStr,
          runLogPath: logger.filePath,
          summary: {
            runId: logger.runIdStr,
            logPath: logger.filePath,
            backend: 'FFmpeg Silence Cutter',
            commandArgCount: 0,
            commandTotalLength: 0,
            silentSections: 0,
            keepSections: 0,
            exitCode: 0,
            success: true,
            errorMessage: null
          }
        }
      }

      this.addLog(`Found ${silencedetect.length} silent section(s)`, onLog)
      const segments = this.buildKeepSegments(silencedetect)
      this.addLog(`Step 2: Creating output (${segments.length} section(s) to keep)...`, onLog)

      logger.append(`silent_section_count: ${silencedetect.length}`)
      logger.append(`keep_section_count: ${segments.length}`)

      const stageStart1 = Date.now()
      await this.runFfmpegConcat(inputPath, outputPath, segments, onLog, logger, workDir)
      stages.push({ name: 'concat', startMs: stageStart1, endMs: Date.now(), ok: true } as any)

      if (this.cancelRequested) {
        this.tryCleanup(workDir)
        logger.flush()
        return {
          success: false,
          error: 'Cancelled',
          processingTime: Date.now() - startTime,
          logs: this.logs,
          runId: logger.runIdStr,
          runLogPath: logger.filePath
        }
      }

      const verification = this.verifyOutput(outputPath, startTime)
      logger.appendSection('Output Verification', verification)
      const keepDebug = !process.env.QUIETCUT_DEBUG
      if (keepDebug) this.tryCleanup(workDir)
      else logger.append('workdir kept because QUIETCUT_DEBUG set')

      logger.appendSection('Stages', stages)
      logger.flush()

      return {
        ...verification,
        logs: this.logs,
        runId: logger.runIdStr,
        runLogPath: logger.filePath,
        summary: {
          runId: logger.runIdStr,
          logPath: logger.filePath,
          backend: 'FFmpeg Silence Cutter',
          commandArgCount: -1,
          commandTotalLength: -1,
          silentSections: silencedetect.length,
          keepSections: segments.length,
          exitCode: 0,
          success: verification.success,
          errorMessage: verification.error || null
        }
      }
    } catch (err: any) {
      const keepDebug = !!process.env.QUIETCUT_DEBUG
      if (!keepDebug) this.tryCleanup(workDir)
      logger.appendSection('Stage Error', err.stack || err.message)
      logger.flush()

      const isNameTooLong = err.code === 'ENAMETOOLONG' || /ENAMETOOLONG/.test(err.message || '')
      const probable = isNameTooLong
        ? 'FFmpeg command was too long for Windows (too many segments in one command)'
        : 'An FFmpeg processing error occurred'
      const suggested = isNameTooLong
        ? 'This should not occur after the fix. Report it with the run log.'
        : 'Check the run log and the FFmpeg version'

      return {
        success: false,
        error: `FFmpeg processing error: ${err.message}`,
        structuredError: this.buildStructuredError(
          'FFmpeg',
          'processing',
          probable,
          err.message,
          suggested,
          logger
        ),
        processingTime: Date.now() - startTime,
        logs: this.logs,
        runId: logger.runIdStr,
        runLogPath: logger.filePath
      }
    }
  }

  private parseMarginToMs(margin: string): number {
    const match = margin.match(/^([\d.]+)(s|ms)?$/)
    if (!match) return 200
    const val = parseFloat(match[1])
    const unit = match[2] || 's'
    return unit === 's' ? val * 1000 : val
  }

  private runFfmpegSilenceDetect(
    inputPath: string,
    threshold: string,
    duration: string
  ): Promise<Array<{ start: number; end: number }>> {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', inputPath,
        '-af', `silencedetect=noise=${threshold}:d=${duration}`,
        '-f', 'null',
        '-'
      ]

      const proc = spawn('ffmpeg', args)
      this.currentProcess = proc
      let stderr = ''

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        this.currentProcess = null
        if (code !== 0 && code !== null && !this.cancelRequested) {
          reject(new Error(`FFmpeg silence detect exited with code ${code}`))
          return
        }
        const silences: Array<{ start: number; end: number }> = []
        const starts: number[] = []
        const ends: number[] = []
        for (const m of stderr.matchAll(/silence_start:\s*([\d.]+)/g)) starts.push(parseFloat(m[1]))
        for (const m of stderr.matchAll(/silence_end:\s*([\d.]+)/g)) ends.push(parseFloat(m[1]))
        for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
          silences.push({ start: starts[i], end: ends[i] })
        }
        resolve(silences)
      })

      proc.on('error', (err) => {
        this.currentProcess = null
        reject(err)
      })
    })
  }

  private buildKeepSegments(
    silences: Array<{ start: number; end: number }>
  ): Array<{ start: number; end: number }> {
    const segments: Array<{ start: number; end: number }> = []
    let cursor = 0
    for (const silence of silences) {
      if (silence.start > cursor) {
        segments.push({ start: cursor, end: silence.start })
      }
      cursor = silence.end
    }
    segments.push({ start: cursor, end: Number.MAX_SAFE_INTEGER })
    return segments
  }

  /**
   * Batch-safe concat. Splits the keep segments into batches of
   * MAX_SEGMENTS_PER_BATCH and runs a filter_complex per batch, then
   * concatenates the batch outputs using the concat demuxer with a
   * file list to avoid single oversized commands.
   */
  private async runFfmpegConcat(
    inputPath: string,
    outputPath: string,
    segments: Array<{ start: number; end: number }>,
    onLog: (data: string) => void,
    logger: Logger,
    workDir: string
  ): Promise<void> {
    const total = segments.length
    this.addLog(`Concatenating ${total} keep segments in batches of ${MAX_SEGMENTS_PER_BATCH}...`, onLog)
    logger.append(`total_keep_segments: ${total}`)
    logger.append(`max_segments_per_batch: ${MAX_SEGMENTS_PER_BATCH}`)

    if (total <= MAX_SEGMENTS_PER_BATCH) {
      this.addLog('Single-batch path (segments <= MAX_SEGMENTS_PER_BATCH)', onLog)
      const maxEnd = this.maxEndFor(segments)
      const args = this.buildBatchArgs(inputPath, segments, maxEnd)
      this.logBatchArgs(args, logger)
      await this.runFfmpegProc(args, outputPath, onLog, 'single-batch-concat')
      return
    }

    const batches = this.chunkArray(segments, MAX_SEGMENTS_PER_BATCH)
    this.addLog(`Split into ${batches.length} batches`, onLog)
    logger.append(`batch_count: ${batches.length}`)

    const batchFiles: string[] = []
    let maxBatchArgLen = 0
    let maxBatchArgCount = 0

    for (let i = 0; i < batches.length; i++) {
      if (this.cancelRequested) throw new Error('Cancelled')
      const batch = batches[i]
      const batchFile = path.join(workDir, `batch_${String(i).padStart(5, '0')}.mp4`)
      const maxEnd = this.maxEndFor(batch)
      const args = this.buildBatchArgs(inputPath, batch, maxEnd)
      const cmdLen = args.join(' ').length
      if (cmdLen > maxBatchArgLen) maxBatchArgLen = cmdLen
      if (args.length > maxBatchArgCount) maxBatchArgCount = args.length

      this.addLog(`Batch ${i + 1}/${batches.length} (${batch.length} segments, cmdLen=${cmdLen})...`, onLog)
      logger.append(`batch_${i}: segments=${batch.length}, cmd_len=${cmdLen}, args=${args.length}`)

      if (cmdLen >= WINDOWS_CMD_LIMIT) {
        throw new Error(`Batch ${i + 1} command length ${cmdLen} still exceeds limit ${WINDOWS_CMD_LIMIT}`)
      }

      logger.appendSection(`batch_${i}_args`, args)
      await this.runFfmpegProc(args, batchFile, onLog, `batch-${i + 1}`)
      batchFiles.push(batchFile)
    }

    this.addLog(`Concatenating ${batchFiles.length} batch outputs via concat demuxer...`, onLog)
    logger.append(`max_batch_cmd_len: ${maxBatchArgLen}`)
    logger.append(`max_batch_arg_count: ${maxBatchArgCount}`)

    const concatListPath = path.join(workDir, 'concat_list.txt')
    const lines = batchFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`)
    fs.writeFileSync(concatListPath, lines.join('\n') + '\n', 'utf-8')
    logger.appendSection('Concat List', lines.join('\n'))

    const finalArgs = ['-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', '-y', outputPath]
    this.logBatchArgs(finalArgs, logger)
    await this.runFfmpegProc(finalArgs, outputPath, onLog, 'final-concat-demuxer')
  }

  private buildBatchArgs(
    inputPath: string,
    segments: Array<{ start: number; end: number }>,
    maxEnd: number
  ): string[] {
    const filterParts: string[] = []
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i]
      const start = this.fmtTime(s.start)
      const end = s.end === Number.MAX_SAFE_INTEGER ? this.fmtTime(maxEnd) : this.fmtTime(s.end)
      // Note: trailing ';' after [aN] is REQUIRED so when filterParts.join('') runs,
      // the next segment's [0:v]trim isn't glued onto [aN].
      filterParts.push(
        `[0:v]trim=${start}:${end},setpts=PTS-STARTPTS[v${i}];` +
        `[0:a]atrim=${start}:${end},asetpts=PTS-STARTPTS[a${i}];`
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

  private fmtTime(v: number): string {
    if (!isFinite(v)) return '999999'
    return v.toFixed(6)
  }

  private maxEndFor(segments: Array<{ start: number; end: number }>): number {
    let max = 0
    for (const s of segments) if (s.end !== Number.MAX_SAFE_INTEGER && s.end > max) max = s.end
    return max
  }

  private logBatchArgs(args: string[], logger: Logger): void {
    const preview = 'ffmpeg ' + args.join(' ')
    const truncated = preview.length > 1500 ? preview.slice(0, 1500) + '...[truncated]' : preview
    logger.append(`command_preview: ${truncated}`)
    logger.append(`command_arg_count: ${args.length}`)
    logger.append(`command_total_length: ${preview.length}`)
  }

  private runFfmpegProc(
    args: string[],
    outputPath: string,
    onLog: (data: string) => void,
    stageName: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // outputPath is the FINAL positional argument so ffmpeg knows where to write
      const fullArgs = [...args, outputPath]
      const proc = spawn('ffmpeg', fullArgs)
      this.currentProcess = proc
      let lastProgress = -1
      let stderrBuffer = ''

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        stderrBuffer += text
        const mt = text.match(/time=(\d+):(\d+):(\d+\.\d+)/)
        if (mt) {
          const secs = parseInt(mt[1]) * 3600 + parseInt(mt[2]) * 60 + parseFloat(mt[3])
          const intSecs = Math.floor(secs)
          if (intSecs !== lastProgress) {
            lastProgress = intSecs
            this.addLog(`[${stageName}] progress ${secs.toFixed(1)}s`, onLog)
          }
        }
      })

      proc.on('close', (code) => {
        this.currentProcess = null
        if (code === 0) {
          resolve()
          return
        }
        // Capture last meaningful ffmpeg error line
        const tail = stderrBuffer.split(/\r?\n/).filter(l => /error|invalid|broken|cannot/i.test(l)).slice(-3).join(' | ')
        const msg = tail ? `FFmpeg ${stageName} exited with code ${code}: ${tail}` : `FFmpeg ${stageName} exited with code ${code}`
        reject(new Error(msg))
      })

      proc.on('error', (err) => {
        this.currentProcess = null
        reject(err)
      })
    })
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    if (size < 1) size = 1
    const chunks: T[][] = []
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
    return chunks
  }

  private verifyOutput(outputPath: string, startTime: number, inputPath?: string): { success: boolean; outputPath?: string; alternateOutputPath?: string; pathMismatch?: boolean; exitCode?: number; error?: string; processingTime: number } {
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
      const altPath = ProcessingBackend.searchAlternateOutput(outputPath, inputPath)
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

  static generateOutputPath(inputPath: string): string {
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

  static searchAlternateOutput(expectedPath: string, inputPath: string): string | null {
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

  cancel(): void {
    this.cancelRequested = true
    if (this.currentProcess && !this.currentProcess.killed) {
      this.currentProcess.kill('SIGTERM')
      setTimeout(() => {
        if (this.currentProcess && !this.currentProcess.killed) {
          this.currentProcess.kill('SIGKILL')
        }
      }, 3000)
    }
  }

  private addLog(message: string, onLog: (data: string) => void): void {
    const timestamp = new Date().toLocaleTimeString()
    const entry = `[${timestamp}] ${message}`
    this.logs.push(entry)
    onLog(entry)
  }

  private tryCleanup(dir: string): void {
    try {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      // best effort cleanup
    }
  }
}