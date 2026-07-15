export interface ProcessingOptions {
  inputPath: string
  outputPath: string
  editMethod?: string
  margin?: string
  whenSilent?: string
  whenNormal?: string
  videoCodec?: string
  audioCodec?: string
  videoBitrate?: string
  audioBitrate?: string
  resolution?: string
  frameRate?: string
  sampleRate?: string
  scale?: string
  extraArgs?: string
}

export interface BackendInfo {
  available: boolean
  name: string
  version: string | null
  path: string | null
}

export interface BackendDiagnostics {
  autoEditor: {
    available: boolean
    path: string | null
    version: string | null
    checkedPaths: string[]
    reason: string | null
  }
  ffmpeg: {
    available: boolean
    path: string | null
    version: string | null
    reason: string | null
  }
  selected: string
}

export interface DiagnosticPackResult {
  success: boolean
  zipPath: string | null
  error: string | null
}

export interface RunSummary {
  runId: string
  logPath: string
  backend: string
  commandArgCount: number
  commandTotalLength: number
  silentSections: number
  keepSections: number
  exitCode: number | null
  success: boolean
  errorMessage: string | null
}

export interface StructuredError {
  backend: string
  step: string
  probableCause: string
  technicalCause: string
  suggestedAction: string
  logPath: string
  runId: string
}

export interface FileInfo {
  duration: number | null
  size: number
  path: string
  name: string
}

export interface ProcessingResult {
  success: boolean
  outputPath?: string
  alternateOutputPath?: string
  pathMismatch?: boolean
  exitCode?: number | null
  error?: string
  structuredError?: StructuredError
  processingTime?: number
  logs: string[]
  runId?: string
  runLogPath?: string
  summary?: RunSummary
}