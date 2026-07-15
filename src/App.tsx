import React, { useState, useCallback, useEffect, useRef } from 'react'
import { DropZone } from './components/DropZone'
import { SettingsPanel } from './components/SettingsPanel'
import { ResultsPanel } from './components/ResultsPanel'
import { DiagnosticsPanel } from './components/DiagnosticsPanel'
import { Header } from './components/Header'
import type { BackendInfo, BackendDiagnostics, ProcessingOptions, ProcessingResult } from './types'
import './styles/app.css'

type AppStatus = 'ready' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface Settings {
  margin: string
  editMethod: string
  whenSilent: string
  whenNormal: string
  videoCodec: string
  audioCodec: string
  videoBitrate: string
  audioBitrate: string
  resolution: string
  frameRate: string
  sampleRate: string
  scale: string
  extraArgs: string
  showAdvanced: boolean
}

const defaultSettings: Settings = {
  margin: '0.2s',
  editMethod: 'audio',
  whenSilent: 'cut',
  whenNormal: '',
  videoCodec: '',
  audioCodec: '',
  videoBitrate: '',
  audioBitrate: '',
  resolution: '',
  frameRate: '',
  sampleRate: '',
  scale: '',
  extraArgs: '',
  showAdvanced: false
}

export default function App() {
  const [status, setStatus] = useState<AppStatus>('ready')
  const [inputFile, setInputFile] = useState<string | null>(null)
  const [inputInfo, setInputInfo] = useState<{ name: string; size: string; duration: string } | null>(null)
  const [outputPath, setOutputPath] = useState<string>('')
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [logs, setLogs] = useState<string[]>([])
  const [result, setResult] = useState<ProcessingResult | null>(null)
  const [backendInfo, setBackendInfo] = useState<BackendInfo | null>(null)
  const [backendDiagnostics, setBackendDiagnostics] = useState<BackendDiagnostics | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getBackendInfo().then(setBackendInfo)
      window.electronAPI.getBackendDiagnostics().then(setBackendDiagnostics)
    }
  }, [])

  useEffect(() => {
    if (window.electronAPI) {
      cleanupRef.current = window.electronAPI.onProcessingLog((data) => {
        setLogs(prev => [...prev, data])
      })
    }
    return () => cleanupRef.current?.()
  }, [])

  const handleSelectInput = useCallback(async () => {
    if (!window.electronAPI) return
    const file = await window.electronAPI.selectInputFile()
    if (file) {
      setInputFile(file)
      const info = await window.electronAPI.getFileInfo(file)
      if (info) {
        setInputInfo({
          name: info.name,
          size: formatSize(info.size),
          duration: info.duration ? `${info.duration.toFixed(1)}s` : 'Unknown'
        })
      }
      const suggested = await window.electronAPI.generateOutputPath(file)
      setOutputPath(suggested)
    }
  }, [])

  const handleFileDrop = useCallback(async (filePath: string) => {
    setInputFile(filePath)
    if (window.electronAPI) {
      const info = await window.electronAPI.getFileInfo(filePath)
      if (info) {
        setInputInfo({
          name: info.name,
          size: formatSize(info.size),
          duration: info.duration ? `${info.duration.toFixed(1)}s` : 'Unknown'
        })
      }
      const suggested = await window.electronAPI.generateOutputPath(filePath)
      setOutputPath(suggested)
    }
  }, [])

  const handleSelectOutput = useCallback(async () => {
    if (!window.electronAPI) return
    const defaultName = inputFile
      ? inputFile.replace(/\.[^.]+$/, '') + '_cut.mp4'
      : 'output_cut.mp4'
    const file = await window.electronAPI.selectOutputFile(defaultName)
    if (file) setOutputPath(file)
  }, [inputFile])

  const handleRun = useCallback(async () => {
    if (!window.electronAPI || !inputFile) return

    const finalOutput = outputPath || inputFile.replace(/\.[^.]+$/, '') + '_cut.mp4'
    setOutputPath(finalOutput)

    setStatus('processing')
    setLogs([])
    setResult(null)

    try {
      const options: ProcessingOptions = {
        inputPath: inputFile,
        outputPath: finalOutput,
        margin: settings.margin || undefined,
        editMethod: settings.editMethod || undefined,
        whenSilent: settings.whenSilent || undefined,
        whenNormal: settings.whenNormal || undefined,
        videoCodec: settings.videoCodec || undefined,
        audioCodec: settings.audioCodec || undefined,
        videoBitrate: settings.videoBitrate || undefined,
        audioBitrate: settings.audioBitrate || undefined,
        resolution: settings.resolution || undefined,
        frameRate: settings.frameRate || undefined,
        sampleRate: settings.sampleRate || undefined,
        scale: settings.scale || undefined,
        extraArgs: settings.extraArgs || undefined
      }

      const res = await window.electronAPI.runProcessing(options)
      setResult(res)

      if (res.success) {
        setStatus('completed')
        if (res.alternateOutputPath && res.pathMismatch) {
          setOutputPath(res.alternateOutputPath)
        }
      } else if (res.error === 'Cancelled') {
        setStatus('cancelled')
      } else {
        setStatus('failed')
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message, logs: [] })
      setStatus('failed')
    }
  }, [inputFile, outputPath, settings])

  const handleCancel = useCallback(async () => {
    if (window.electronAPI) {
      await window.electronAPI.cancelProcessing()
    }
  }, [])

  const handleOpenFolder = useCallback(async () => {
    if (window.electronAPI && result?.outputPath) {
      await window.electronAPI.openFolder(result.outputPath)
    }
  }, [result])

  const handleOpenOutputFolder = useCallback(async () => {
    if (window.electronAPI && outputPath) {
      await window.electronAPI.openFolder(outputPath)
    }
  }, [outputPath])

  const handleReset = useCallback(() => {
    setStatus('ready')
    setInputFile(null)
    setInputInfo(null)
    setOutputPath('')
    setLogs([])
    setResult(null)
  }, [])

  const commandPreview = buildCommandPreview(inputFile, outputPath, settings)

  return (
    <div className="app">
      <Header backendInfo={backendInfo} diagnostics={backendDiagnostics} />

      <div className="app-content">
        <div className="main-panel">
          {window.electronAPI && (
            <DiagnosticsPanel
              diagnostics={backendDiagnostics}
              onOpenLogsFolder={() => window.electronAPI.openLogsFolder()}
              onCopyDiagnosticSummary={() => window.electronAPI.copyDiagnosticSummary()}
              onExportDiagnosticPack={() => window.electronAPI.exportDiagnosticPack()}
            />
          )}
          {status === 'ready' || status === 'cancelled' ? (
            <>
              <DropZone
                inputFile={inputFile}
                inputInfo={inputInfo}
                onSelect={handleSelectInput}
                onDrop={handleFileDrop}
                dragOver={dragOver}
                setDragOver={setDragOver}
              />

              <div className="output-section">
                <label className="field-label">Output File</label>
                <div className="output-row">
                  <input
                    type="text"
                    className="field-input"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    placeholder="Select or type output path..."
                  />
                  <button className="btn btn-secondary" onClick={handleSelectOutput}>
                    Browse
                  </button>
                </div>
              </div>

              <SettingsPanel settings={settings} onChange={setSettings} />

              {settings.showAdvanced && commandPreview && (
                <div className="command-preview">
                  <div className="field-label">Command Preview</div>
                  <pre className="command-text">{commandPreview}</pre>
                </div>
              )}

              <div className="action-bar">
                <button
                  className="btn btn-primary btn-large"
                  onClick={handleRun}
                  disabled={!inputFile || !outputPath}
                >
                  Cut Silence
                </button>
              </div>
            </>
          ) : status === 'processing' ? (
            <div className="processing-container">
              <div className="processing-status">
                <div className="spinner" />
                <span>Processing video...</span>
              </div>
              <button className="btn btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          ) : (
            <ResultsPanel
              status={status}
              result={result}
              outputPath={result?.outputPath || outputPath}
              onOpenFolder={result?.outputPath ? handleOpenFolder : undefined}
              onReset={handleReset}
              onOpenLogsFolder={window.electronAPI ? () => window.electronAPI.openLogsFolder() : undefined}
            />
          )}
        </div>

        <div className="log-panel">
          <div className="log-header">Process Log</div>
          <div className="log-content" ref={(el) => {
            if (el) el.scrollTop = el.scrollHeight
          }}>
            {logs.length === 0 ? (
              <div className="log-empty">Log output will appear here...</div>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="log-line">{line}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function buildCommandPreview(input: string | null, output: string, settings: Settings): string {
  if (!input || !output) return ''
  const parts: string[] = []
  if (window.electronAPI) {
    parts.push('auto-editor')
    parts.push(`"${input}"`)
    parts.push(`-o "${output}"`)
    parts.push('--no-open')
    if (settings.margin) parts.push(`--margin ${settings.margin}`)
    if (settings.editMethod) parts.push(`--edit ${settings.editMethod}`)
    if (settings.whenSilent) parts.push(`--when-silent ${settings.whenSilent}`)
    if (settings.whenNormal) parts.push(`--when-normal ${settings.whenNormal}`)
    if (settings.videoCodec) parts.push(`--video-codec ${settings.videoCodec}`)
    if (settings.audioCodec) parts.push(`--audio-codec ${settings.audioCodec}`)
    if (settings.extraArgs) parts.push(settings.extraArgs)
  }
  return parts.join(' ')
}
