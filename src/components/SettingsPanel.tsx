import React from 'react'
import type { Settings } from '../App'

interface SettingsPanelProps {
  settings: Settings
  onChange: (settings: Settings) => void
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const update = (key: keyof Settings, value: string | boolean) => {
    onChange({ ...settings, [key]: value })
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
        <span>Settings</span>
      </div>

      <div className="settings-grid">
        <div className="field">
          <label className="field-label">Margin before/after speech</label>
          <input
            type="text"
            className="field-input"
            value={settings.margin}
            onChange={(e) => update('margin', e.target.value)}
            placeholder="0.2s"
          />
          <span className="field-hint">Time before and after non-silent sections to keep (e.g. 0.3s, 0.5s)</span>
        </div>

        <div className="field">
          <label className="field-label">Edit detection method</label>
          <select
            className="field-input"
            value={settings.editMethod}
            onChange={(e) => update('editMethod', e.target.value)}
          >
            <option value="audio">Audio (silence detection)</option>
            <option value="motion">Motion detection</option>
            <option value="not_audio">Not audio (inverse)</option>
            <option value="not_motion">Not motion (inverse)</option>
            <option value="audio_or_motion">Audio or motion</option>
            <option value="audio_and_motion">Audio and motion</option>
          </select>
          <span className="field-hint">Method to detect which sections to edit</span>
        </div>

        <div className="field">
          <label className="field-label">When silent (action)</label>
          <select
            className="field-input"
            value={settings.whenSilent}
            onChange={(e) => update('whenSilent', e.target.value)}
          >
            <option value="cut">Cut (remove)</option>
            <option value="">Keep as-is</option>
            <option value="speed:8">Speed up 8x</option>
            <option value="speed:16">Speed up 16x</option>
            <option value="speed:30">Speed up 30x</option>
          </select>
          <span className="field-hint">What to do with silent sections</span>
        </div>

        <div className="field">
          <label className="field-label">When normal (action)</label>
          <select
            className="field-input"
            value={settings.whenNormal}
            onChange={(e) => update('whenNormal', e.target.value)}
          >
            <option value="">Keep as-is (default)</option>
            <option value="speed:2">Speed up 2x</option>
            <option value="speed:1.5">Speed up 1.5x</option>
          </select>
          <span className="field-hint">What to do with non-silent sections</span>
        </div>
      </div>

      <div className="settings-advanced-toggle">
        <button
          className="btn btn-ghost"
          onClick={() => update('showAdvanced', !settings.showAdvanced)}
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: settings.showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {settings.showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
        </button>
      </div>

      {settings.showAdvanced && (
        <div className="settings-advanced">
          <div className="settings-grid">
            <div className="field">
              <label className="field-label">Video codec</label>
              <input
                type="text"
                className="field-input"
                value={settings.videoCodec}
                onChange={(e) => update('videoCodec', e.target.value)}
                placeholder="libx264 (default)"
              />
            </div>

            <div className="field">
              <label className="field-label">Audio codec</label>
              <input
                type="text"
                className="field-input"
                value={settings.audioCodec}
                onChange={(e) => update('audioCodec', e.target.value)}
                placeholder="aac (default)"
              />
            </div>

            <div className="field">
              <label className="field-label">Video bitrate</label>
              <input
                type="text"
                className="field-input"
                value={settings.videoBitrate}
                onChange={(e) => update('videoBitrate', e.target.value)}
                placeholder="e.g. 2M, 5000k"
              />
            </div>

            <div className="field">
              <label className="field-label">Audio bitrate</label>
              <input
                type="text"
                className="field-input"
                value={settings.audioBitrate}
                onChange={(e) => update('audioBitrate', e.target.value)}
                placeholder="e.g. 192k"
              />
            </div>

            <div className="field">
              <label className="field-label">Resolution</label>
              <input
                type="text"
                className="field-input"
                value={settings.resolution}
                onChange={(e) => update('resolution', e.target.value)}
                placeholder="WIDTH,HEIGHT e.g. 1920,1080"
              />
            </div>

            <div className="field">
              <label className="field-label">Frame rate</label>
              <input
                type="text"
                className="field-input"
                value={settings.frameRate}
                onChange={(e) => update('frameRate', e.target.value)}
                placeholder="e.g. 30, 60, ntsc, pal"
              />
            </div>

            <div className="field">
              <label className="field-label">Sample rate</label>
              <input
                type="text"
                className="field-input"
                value={settings.sampleRate}
                onChange={(e) => update('sampleRate', e.target.value)}
                placeholder="e.g. 44100, 48000"
              />
            </div>

            <div className="field">
              <label className="field-label">Scale factor</label>
              <input
                type="text"
                className="field-input"
                value={settings.scale}
                onChange={(e) => update('scale', e.target.value)}
                placeholder="e.g. 0.5 (half size)"
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Extra Auto-Editor Arguments</label>
            <textarea
              className="field-input field-textarea"
              value={settings.extraArgs}
              onChange={(e) => update('extraArgs', e.target.value)}
              placeholder="--progress modern --debug --temp-dir C:\temp&#10;Add any supported auto-editor CLI arguments here"
              rows={3}
            />
            <span className="field-hint">Any additional arguments passed directly to Auto-Editor</span>
          </div>
        </div>
      )}
    </div>
  )
}
