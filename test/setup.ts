import '@testing-library/jest-dom'

// Mock electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    selectInputFile: async () => null,
    selectOutputFile: async () => null,
    runProcessing: async () => ({ success: true, logs: [] }),
    cancelProcessing: async () => {},
    getBackendInfo: async () => ({ available: true, name: 'Auto-Editor', version: '31.1.2', path: '/test' }),
    getFileInfo: async () => null,
    openFolder: async () => {},
    onProcessingLog: () => () => {}
  },
  writable: true
})
