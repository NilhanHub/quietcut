import { contextBridge, ipcRenderer } from 'electron'
import type { ProcessingOptions, BackendInfo, BackendDiagnostics, FileInfo, ProcessingResult, DiagnosticPackResult } from './types'

contextBridge.exposeInMainWorld('electronAPI', {
  selectInputFile: () => ipcRenderer.invoke('select-input-file'),
  selectOutputFile: (defaultPath?: string) => ipcRenderer.invoke('select-output-file', defaultPath),
  runProcessing: (options: ProcessingOptions) => ipcRenderer.invoke('run-processing', options),
  cancelProcessing: () => ipcRenderer.invoke('cancel-processing'),
  getBackendInfo: () => ipcRenderer.invoke('get-backend-info'),
  getBackendDiagnostics: () => ipcRenderer.invoke('get-backend-diagnostics'),
  getFileInfo: (filePath: string) => ipcRenderer.invoke('get-file-info', filePath),
  openFolder: (folderPath: string) => ipcRenderer.invoke('open-folder', folderPath),
  openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  copyDiagnosticSummary: () => ipcRenderer.invoke('copy-diagnostic-summary'),
  exportDiagnosticPack: () => ipcRenderer.invoke('export-diagnostic-pack'),
  generateOutputPath: (inputPath: string) => ipcRenderer.invoke('generate-output-path', inputPath),
  onProcessingLog: (callback: (data: string) => void) => {
    const handler = (_event: any, data: string) => callback(data)
    ipcRenderer.on('processing-log', handler)
    return () => ipcRenderer.removeListener('processing-log', handler)
  }
})