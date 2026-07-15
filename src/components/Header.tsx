import React from 'react'
import type { BackendInfo, BackendDiagnostics } from '../types'

interface HeaderProps {
  backendInfo: BackendInfo | null
  diagnostics: BackendDiagnostics | null
}

export function Header({ backendInfo, diagnostics }: HeaderProps) {
  const aeAvailable = diagnostics?.autoEditor.available ?? backendInfo?.available ?? false
  const ffAvailable = diagnostics?.ffmpeg.available ?? false
  const anyBackend = !!backendInfo?.available

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
          </svg>
        </div>
        <h1 className="header-title">QuietCut</h1>
        <span className="header-version">v1.1</span>
      </div>
      <div className="header-right">
        {backendInfo && (
          <div className="backend-badge" data-available={backendInfo.available}>
            <span className="backend-dot" />
            <span className="backend-name">
              {backendInfo.available ? backendInfo.name : 'No Backend'}
            </span>
            {backendInfo.version && (
              <span className="backend-version">{backendInfo.version}</span>
            )}
          </div>
        )}
        <span className={`backend-pill ${aeAvailable ? 'pill-ok' : 'pill-fail'}`} title={diagnostics?.autoEditor.reason || 'Auto-Editor'}>
          AE {aeAvailable ? '✓' : '✗'}
        </span>
        <span className={`backend-pill ${ffAvailable ? 'pill-ok' : 'pill-fail'}`} title={diagnostics?.ffmpeg.reason || 'FFmpeg'}>
          FF {ffAvailable ? '✓' : '✗'}
        </span>
      </div>
    </header>
  )
}