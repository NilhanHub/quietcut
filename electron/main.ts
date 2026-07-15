import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { ProcessingBackend } from './backend'
import { ProcessingOptions } from './types'
import { Logger } from './logger'

let mainWindow: BrowserWindow | null = null
let backend: ProcessingBackend

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 650,
    title: 'QuietCut',
    backgroundColor: '#0a0a0f',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })
}

function writeDiagnosticPack(logDir: string): { zipPath: string | null; error: string | null } {
  const osName = `${os.type()} ${os.release()} ${os.platform()}`
  const toolVersions: { name: string; value: string }[] = []
  try {
    const ffmpegV = require('child_process').execSync('ffmpeg -version', { timeout: 3000, encoding: 'utf-8' }).split('\n')[0]
    toolVersions.push({ name: 'ffmpeg', value: ffmpegV })
  } catch { toolVersions.push({ name: 'ffmpeg', value: 'unavailable' }) }
  try {
    const ffprobeV = require('child_process').execSync('ffprobe -version', { timeout: 3000, encoding: 'utf-8' }).split('\n')[0]
    toolVersions.push({ name: 'ffprobe', value: ffprobeV })
  } catch { toolVersions.push({ name: 'ffprobe', value: 'unavailable' }) }
  toolVersions.push({ name: 'os', value: osName })
  toolVersions.push({ name: 'node', value: process.version })
  toolVersions.push({ name: 'electron', value: process.versions.electron || 'unknown' })

  const BACKGROUND = `QuietCut diagnostic pack. No source video is included by default.`

  const packDir = path.join(os.tmpdir(), 'quietcut-pack-' + Logger.name)
  if (fs.existsSync(packDir)) fs.rmSync(packDir, { recursive: true, force: true })
  fs.mkdirSync(packDir, { recursive: true })

  fs.writeFileSync(path.join(packDir, 'README.txt'), BACKGROUND + '\n\nTool Versions:\n' + toolVersions.map(t => `${t.name}: ${t.value}`).join('\n'))

  const diagnostic = {
    generatedAt: new Date().toISOString(),
    backendDiagnostics: backend.getDiagnostics(),
    toolVersions,
    hostname: os.hostname(),
    nodeVersion: process.version
  }
  fs.writeFileSync(path.join(packDir, 'backend_diagnostics.json'), JSON.stringify(diagnostic, null, 2))

  const lastOpts = backend.getLastOptions()
  if (lastOpts) {
    fs.writeFileSync(path.join(packDir, 'settings.json'), JSON.stringify(lastOpts, null, 2))
  }

  if (fs.existsSync(logDir)) {
    const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log')).map(f => fs.statSync(path.join(logDir, f)).mtimeMs + '|' + f).sort().reverse()
    if (files.length > 0) {
      const latest = files[0].split('|').slice(1).join('|')
      fs.copyFileSync(path.join(logDir, latest), path.join(packDir, 'latest_run.log'))
    }
  }

  const outZip = path.join(os.tmpdir(), 'quietcut-diagnostic-pack.zip')
  try { fs.unlinkSync(outZip) } catch {}
  const archiver = require('child_process').execSync
  try {
    require('child_process').execSync(`powershell -Command "Compress-Archive -Path '${packDir}\\*' -DestinationPath '${outZip}' -Force"`, { timeout: 20000 })
  } catch (e: any) {
    fs.rmSync(packDir, { recursive: true, force: true })
    return { zipPath: null, error: 'Failed to build ZIP: ' + e.message }
  }
  fs.rmSync(packDir, { recursive: true, force: true })
  return { zipPath: outZip, error: null }
}

app.whenReady().then(async () => {
  backend = new ProcessingBackend()
  await backend.detectBackend()

  createWindow()

  ipcMain.handle('select-input-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('select-output-file', async (_event, defaultPath: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultPath || undefined,
      filters: [
        { name: 'MP4 Video', extensions: ['mp4'] },
        { name: 'MOV Video', extensions: ['mov'] },
        { name: 'MKV Video', extensions: ['mkv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled) return null
    return result.filePath
  })

  ipcMain.handle('run-processing', async (_event, options: ProcessingOptions) => {
    return await backend.run(options, (data) => {
      mainWindow?.webContents.send('processing-log', data)
    })
  })

  ipcMain.handle('cancel-processing', async () => {
    backend.cancel()
  })

  ipcMain.handle('get-backend-info', async () => {
    return backend.getInfo()
  })

  ipcMain.handle('get-backend-diagnostics', async () => {
    return backend.getDiagnostics()
  })

  ipcMain.handle('get-file-info', async (_event, filePath: string) => {
    return await backend.getFileInfo(filePath)
  })

  ipcMain.handle('open-folder', async (_event, folderPath: string) => {
    shell.showItemInFolder(folderPath)
  })

  ipcMain.handle('open-logs-folder', async () => {
    const logDir = Logger.appLogDir()
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
    shell.openPath(logDir)
    return logDir
  })

  ipcMain.handle('get-app-version', async () => {
    return app.getVersion()
  })

  ipcMain.handle('copy-diagnostic-summary', async () => {
    const summary = `QuietCut Diagnostic Summary\n` +
      `Generated: ${new Date().toISOString()}\n` +
      `OS: ${os.type()} ${os.release()} ${os.platform()}\n` +
      `Node: ${process.version}\n` +
      `Backend Diagnostics: ${JSON.stringify(backend.getDiagnostics(), null, 2)}\n`
    return summary
  })

  ipcMain.handle('export-diagnostic-pack', async () => {
    const logDir = Logger.appLogDir()
    const result = writeDiagnosticPack(logDir)
    return result
  })

  ipcMain.handle('generate-output-path', async (_event, inputPath: string) => {
    return ProcessingBackend.generateOutputPath(inputPath)
  })
})

app.on('window-all-closed', () => {
  backend?.cancel()
  if (process.platform !== 'darwin') app.quit()
})