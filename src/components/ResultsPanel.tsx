import React from 'react'
import type { ProcessingResult } from '../types'
import { StructuredErrorView } from './DiagnosticsPanel'

interface ResultsPanelProps {
  status: 'completed' | 'failed' | 'cancelled'
  result: ProcessingResult | null
  outputPath: string
  onOpenFolder?: () => void
  onReset: () => void
  onOpenLogsFolder?: () => void
}

export function ResultsPanel({ status, result, outputPath, onOpenFolder, onReset, onOpenLogsFolder }: ResultsPanelProps) {
  const formatTime = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    const mins = Math.floor(ms / 60000)
    const secs = ((ms % 60000) / 1000).toFixed(0)
    return `${mins}m ${secs}s`
  }

  const isSuccess = status === 'completed'
  const hasStructured = !!result?.structuredError
  const hasPathMismatch = result?.pathMismatch && result?.alternateOutputPath

  return (
    <div className="results-panel">
      <div className={`result-icon ${isSuccess ? 'success' : status === 'cancelled' ? 'warning' : 'error'}`}>
        {isSuccess ? (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) : status === 'cancelled' ? (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ) : (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </div>

      <h2 className="result-title">
        {isSuccess ? 'Processing Complete' : status === 'cancelled' ? 'Processing Cancelled' : 'Processing Failed'}
      </h2>

      {hasPathMismatch && (
        <div className="result-warning">
          <strong>Output saved at different path</strong>
          <p>Expected: {outputPath}</p>
          <p>Actual: {result?.alternateOutputPath}</p>
        </div>
      )}

      {result && result.summary && (
        <div className="result-summary-strip">
          <span>Backend: <strong>{result.summary.backend}</strong></span>
          {result.summary.silentSections >= 0 && (
            <span>Silent: {result.summary.silentSections}</span>
          )}
          {result.summary.keepSections >= 0 && (
            <span>Keep: {result.summary.keepSections}</span>
          )}
          {result.summary.commandTotalLength >= 0 && (
            <span>Cmd len: {result.summary.commandTotalLength}</span>
          )}
        </div>
      )}

      {result && (
        <div className="result-details">
          {isSuccess && (
            <div className="result-row">
              <span className="result-label">Output File</span>
              <span className="result-value">{outputPath}</span>
            </div>
          )}
          {result.processingTime !== undefined && (
            <div className="result-row">
              <span className="result-label">Processing Time</span>
              <span className="result-value">{formatTime(result.processingTime)}</span>
            </div>
          )}
          {result.exitCode !== undefined && (
            <div className="result-row">
              <span className="result-label">Exit Code</span>
              <span className="result-value">{result.exitCode ?? 'N/A'}</span>
            </div>
          )}
          {!isSuccess && !hasStructured && result?.error && (
            <div className="result-row error">
              <span className="result-label">Error</span>
              <span className="result-value">{result.error}</span>
            </div>
          )}
          {!isSuccess && result && result.logs && result.logs.length > 0 && (
            <div className="result-row">
              <span className="result-label">Last Log Lines</span>
              <div className="result-log-snippet">
                {result.logs.slice(-5).map((line, i) => (
                  <div key={i} className="log-line-snippet">{line}</div>
                ))}
              </div>
            </div>
          )}
          {hasStructured && result.structuredError && (
            <StructuredErrorView error={result.structuredError} result={result} />
          )}
        </div>
      )}

      <div className="result-actions">
        {isSuccess && onOpenFolder && (
          <button className="btn btn-primary" onClick={onOpenFolder}>
            Open Output Folder
          </button>
        )}
        {!isSuccess && onOpenLogsFolder && (
          <button className="btn btn-secondary" onClick={onOpenLogsFolder}>
            Open Logs Folder
          </button>
        )}
        <button className="btn btn-secondary" onClick={onReset}>
          Process Another Video
        </button>
      </div>
    </div>
  )
}