/// <reference types="vite/client" />
import type { ProcessingOptions, BackendInfo, BackendDiagnostics, FileInfo, ProcessingResult } from './types'

interface ElectronAPI {
  selectInputFile: () => Promise<string | null>
  selectOutputFile: (defaultPath?: string) => Promise<string | null>
  runProcessing: (options: ProcessingOptions) => Promise<ProcessingResult>
  cancelProcessing: () => Promise<void>
  getBackendInfo: () => Promise<BackendInfo>
  getBackendDiagnostics: () => Promise<BackendDiagnostics>
  getFileInfo: (filePath: string) => Promise<FileInfo | null>
  openFolder: (folderPath: string) => Promise<void>
  openLogsFolder: () => Promise<string>
  getAppVersion: () => Promise<string>
  copyDiagnosticSummary: () => Promise<string>
  exportDiagnosticPack: () => Promise<{ zipPath: string | null; error: string | null }>
  generateOutputPath: (inputPath: string) => Promise<string>
  onProcessingLog: (callback: (data: string) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}