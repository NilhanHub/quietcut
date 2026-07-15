import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface RunLogEntry {
  timestamp: string
  runId: string
  appVersion: string
  platform: string
  backendSelected: string
  backendDiagnostics: any
  inputPath: string
  outputPath: string
  inputMetadata: any
  settings: any
  commandPreview: string
  commandArgCount: number
  commandTotalLength: number
  silenceThreshold: string
  silentSectionCount: number
  keepSectionCount: number
  stages: Array<{ name: string; startMs: number; endMs: number; durationMs: number; ok: boolean; note?: string }>
  stdout: string[]
  stderr: string[]
  exitCode: number | null
  errorStack: string | null
  finalOutputVerification: any
}

export class Logger {
  private runId: string
  private logDir: string
  private logPath: string
  private lines: string[] = []
  private startMs: number

  constructor(logDir: string) {
    this.startMs = Date.now()
    const now = new Date()
    const ts = now.toISOString().replace(/[:T]/g, '-').replace(/\..+/, '')
    this.runId = `run_${ts}_${Math.random().toString(36).slice(2, 8)}`
    this.logDir = logDir
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
    this.logPath = path.join(logDir, `${this.runId}.log`)
  }

  get runIdStr(): string { return this.runId }
  get filePath(): string { return this.logPath }

  append(line: string): void {
    this.lines.push(line)
  }

  appendSection(label: string, data: any): void {
    this.append(`--- ${label} ---`)
    if (typeof data === 'string') {
      for (const ln of data.split(/\r?\n/)) this.append(ln)
    } else if (data && typeof data === 'object') {
      for (const [k, v] of Object.entries(data)) {
        const vs = typeof v === 'object' ? JSON.stringify(v) : String(v)
        const truncated = vs.length > 2000 ? vs.slice(0, 2000) + '...[truncated]' : vs
        this.append(`  ${k}: ${truncated}`)
      }
    }
  }

  flush(): void {
    const header = [
      `QuietCut Run Log`,
      `run_id: ${this.runId}`,
      `started: ${new Date(this.startMs).toISOString()}`,
      `written: ${new Date().toISOString()}`,
      '',
    ].join('\n')
    fs.writeFileSync(this.logPath, header + this.lines.join('\n') + '\n', 'utf-8')
  }

  buildSummary(entry: Partial<RunLogEntry>): string {
    const lines: string[] = []
    lines.push(`run_id: ${this.runId}`)
    if (entry.timestamp) lines.push(`timestamp: ${entry.timestamp}`)
    if (entry.appVersion) lines.push(`app_version: ${entry.appVersion}`)
    if (entry.platform) lines.push(`platform: ${entry.platform}`)
    if (entry.backendSelected) lines.push(`backend_selected: ${entry.backendSelected}`)
    if (entry.inputPath) lines.push(`input: ${entry.inputPath}`)
    if (entry.outputPath) lines.push(`output: ${entry.outputPath}`)
    if (entry.commandArgCount !== undefined) lines.push(`command_arg_count: ${entry.commandArgCount}`)
    if (entry.commandTotalLength !== undefined) lines.push(`command_total_length: ${entry.commandTotalLength}`)
    if (entry.silenceThreshold) lines.push(`silence_threshold: ${entry.silenceThreshold}`)
    if (entry.silentSectionCount !== undefined) lines.push(`silent_sections: ${entry.silentSectionCount}`)
    if (entry.keepSectionCount !== undefined) lines.push(`keep_sections: ${entry.keepSectionCount}`)
    if (entry.exitCode !== null && entry.exitCode !== undefined) lines.push(`exit_code: ${entry.exitCode}`)
    if (entry.finalOutputVerification) lines.push(`output_ok: ${JSON.stringify(entry.finalOutputVerification)}`)
    if (entry.errorStack) lines.push(`error: ${entry.errorStack.slice(0, 500)}`)
    return lines.join('\n')
  }

  static appLogDir(): string {
    const envDir = process.env.QUIETCUT_LOG_DIR
    if (envDir) return envDir
    const projectDir = process.cwd()
    return path.join(projectDir, 'logs')
  }
}