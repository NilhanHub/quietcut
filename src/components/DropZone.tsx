import React, { useCallback, useEffect, useState } from 'react'

interface DropZoneProps {
  inputFile: string | null
  inputInfo: { name: string; size: string; duration: string } | null
  onSelect: () => void
  onDrop: (filePath: string) => void
  dragOver: boolean
  setDragOver: (v: boolean) => void
}

export function DropZone({ inputFile, inputInfo, onSelect, onDrop, dragOver, setDragOver }: DropZoneProps) {
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    setIsElectron(!!window.electronAPI)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [setDragOver])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [setDragOver])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (isElectron) {
        onDrop((file as any).path || file.name)
      }
    }
  }, [isElectron, onDrop, setDragOver])

  if (inputFile && inputInfo) {
    return (
      <div className="drop-zone has-file">
        <div className="file-info">
          <div className="file-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <div className="file-details">
            <div className="file-name">{inputInfo.name}</div>
            <div className="file-meta">{inputInfo.size} &middot; {inputInfo.duration}</div>
          </div>
          <button className="btn btn-ghost btn-small" onClick={onSelect}>
            Change
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onSelect}
    >
      <div className="drop-content">
        <div className="drop-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div className="drop-text">
          <span className="drop-title">Drop your video here</span>
          <span className="drop-subtitle">or click to browse</span>
        </div>
      </div>
    </div>
  )
}
