import * as esbuild from 'esbuild'
import * as path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

async function build() {
  const electronDir = path.join(root, 'electron')
  const outDir = path.join(root, 'dist-electron')

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  // Build main process
  await esbuild.build({
    entryPoints: [path.join(electronDir, 'main.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    outfile: path.join(outDir, 'main.js'),
    external: ['electron'],
    format: 'cjs',
    sourcemap: true
  })

  // Build preload
  await esbuild.build({
    entryPoints: [path.join(electronDir, 'preload.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    outfile: path.join(outDir, 'preload.js'),
    external: ['electron'],
    format: 'cjs',
    sourcemap: true
  })

  // Build backend (bundled into main, so skip if not needed separately)
  // Backend is imported by main, so esbuild bundles it automatically

  console.log('Electron build complete')
}

build().catch(err => {
  console.error(err)
  process.exit(1)
})
