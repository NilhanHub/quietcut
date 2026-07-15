import React, { useState } from 'react'
import type { BackendDiagnostics, ProcessingResult, StructuredError } from '../types'

interface DiagnosticsPanelProps {
  diagnostics: BackendDiagnostics | null
  onOpenLogsFolder: () => void
  onCopyDiagnosticSummary: () => Promise<string>
  onExportDiagnosticPack: () => Promise<{ zipPath: string | null; error: string | null }>
}

export function DiagnosticsPanel({
  diagnostics,
  onOpenLogsFolder,
  onCopyDiagnosticSummary,
  onExportDiagnosticPack
}: DiagnosticsPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [packMsg, setPackMsg] = useState<string | null>(null)

  const handleCopy = async () => {
    const text = await onCopyDiagnosticSummary()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const handleExport = async () => {
    const r = await onExportDiagnosticPack()
    if (r.zipPath) setPackMsg(`Saved to: ${r.zipPath}`)
    else if (r.error) setPackMsg(`Error: ${r.error}`)
    setTimeout(() => setPackMsg(null), 4000)
  }

  return (
    <div className="diagnostics-panel">
      <div className="diagnostics-header">
        <button className="btn btn-ghost" onClick={() => setExpanded(!expanded)}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          Backend Diagnostics
        </button>
        <div className="diagnostics-buttons">
          <button className="btn btn-ghost btn-small" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy Diagnostic Summary'}
          </button>
          <button className="btn btn-ghost btn-small" onClick={onOpenLogsFolder}>
            Open Logs Folder
          </button>
          <button className="btn btn-ghost btn-small" onClick={handleExport}>
            Export Diagnostic Pack
          </button>
        </div>
      </div>

      {packMsg && <div className="diag-message">{packMsg}</div>}

      {expanded && diagnostics && (
        <div className="diagnostics-content">
          <div className="diag-backend">
            <div className="diag-backend-title">
              Auto-Editor
              <span className={`diag-status ${diagnostics.autoEditor.available ? 'ok' : 'fail'}`}>
                {diagnostics.autoEditor.available ? 'AVAILABLE' : 'UNAVAILABLE'}
              </span>
            </div>
            <div className="diag-detail">version: {diagnostics.autoEditor.version || 'unknown'}</div>
            <div className="diag-detail">path: {diagnostics.autoEditor.path || 'not found'}</div>
            {diagnostics.autoEditor.reason && (
              <div className="diag-reason">reason: {diagnostics.autoEditor.reason}</div>
            )}
            <div className="diag-checked">
              <div className="diag-detail-title">Checked locations:</div>
              <ul>
                {diagnostics.autoEditor.checkedPaths.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="diag-backend">
            <div className="diag-backend-title">
              FFmpeg
              <span className={`diag-status ${diagnostics.ffmpeg.available ? 'ok' : 'fail'}`}>
                {diagnostics.ffmpeg.available ? 'AVAILABLE' : 'UNAVAILABLE'}
              </span>
            </div>
            <div className="diag-detail">version: {diagnostics.ffmpeg.version || 'unknown'}</div>
            <div className="diag-detail">path: {diagnostics.ffmpeg.path || 'not found'}</div>
            {diagnostics.ffmpeg.reason && (
              <div className="diag-reason">reason: {diagnostics.ffmpeg.reason}</div>
            )}
          </div>

          <div className="diag-selected">
            Selected backend: <strong>{diagnostics.selected}</strong>
          </div>
        </div>
      )}
    </div>
  )
}

export function StructuredErrorView({ error, result }: { error: StructuredError; result?: ProcessingResult | null }) {
  const [showTechnical, setShowTechnical] = useState(false)
  return (
    <div className="struct-error">
      <div className="struct-error-section">
        <div className="struct-error-label">Backend</div>
        <div className="struct-error-value">{error.backend}</div>
      </div>
      <div className="struct-error-section">
        <div className="struct-error-label">Step</div>
        <div className="struct-error-value">{error.step}</div>
      </div>
      <div className="struct-error-section">
        <div className="struct-error-label">Probable cause</div>
        <div className="struct-error-value">{error.probableCause}</div>
      </div>
      <div className="struct-error-section">
        <div className="struct-error-label">What you can do</div>
        <div className="struct-error-value">{error.suggestedAction}</div>
      </div>
      {result && result.runId && (
        <div className="struct-error-section">
          <div className="struct-error-label">Run ID</div>
          <div className="struct-error-value mono">{result.runId}</div>
        </div>
      )}
      {result && result.runLogPath && (
        <div className="struct-error-section">
          <div className="struct-error-label">Log file</div>
          <div className="struct-error-value mono">{result.runLogPath}</div>
        </div>
      )}
      <button className="btn btn-ghost btn-small" onClick={() => setShowTechnical(!showTechnical)}>
        {showTechnical ? 'Hide technical details' : 'Show technical details'}
      </button>
      {showTechnical && (
        <pre className="struct-error-tech">{error.technicalCause}</pre>
      )}
    </div>
  )
}