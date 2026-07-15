// Round 2S - Original failed video re-test
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

const inputVideo = 'C:\\Users\\Nilhan.dev\\Videos\\2026-07-06 17-19-01.mp4';
const outputDir = path.resolve('test_output');
const outputVideo = path.join(outputDir, '2026-07-06_17-19-01_cut.mp4');
const diagPackDir = path.join(os.tmpdir(), 'quietcut-r2s-pack');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (fs.existsSync(outputVideo)) fs.unlinkSync(outputVideo);

// Bundle backend
const tmpBundle = path.join(os.tmpdir(), 'quietcut_r2s_backend.cjs');
esbuild.buildSync({
  entryPoints: [path.resolve(__dirname, '..', 'electron', 'backend.ts')],
  bundle: true, platform: 'node', target: 'node22', format: 'cjs',
  external: ['electron'], outfile: tmpBundle,
});
const { ProcessingBackend } = require(tmpBundle);

function probeDuration(file) {
  try {
    return parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`, { encoding: 'utf-8' }).trim());
  } catch { return -1; }
}

function probeInfo(file) {
  try {
    const dur = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`, { encoding: 'utf-8' }).trim();
    const size = fs.statSync(file).size;
    const streams = execSync(`ffprobe -v error -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "${file}"`, { encoding: 'utf-8' }).trim();
    return { duration: parseFloat(dur) || -1, size, streams: streams.split('\n').filter(Boolean) };
  } catch { return { duration: -1, size: -1, streams: [] }; }
}

(async () => {
  const result = {};
  
  // Input info
  const inputInfo = probeInfo(inputVideo);
  result.inputPath = inputVideo;
  result.inputDuration = inputInfo.duration;
  result.inputSize = inputInfo.size;
  result.inputStreams = inputInfo.streams;

  // Backend diagnostics
  const backend = new ProcessingBackend();
  await backend.detectBackend();
  const diag = backend.getDiagnostics();
  result.backendDiagnostics = diag;
  result.selectedBackend = diag.selected;

  // Process
  const startTime = Date.now();
  const procResult = await backend.run(
    { inputPath: inputVideo, outputPath: outputVideo, margin: '0.2s', whenSilent: 'cut' },
    (line) => process.stdout.write(line + '\n')
  );
  result.processingTimeMs = Date.now() - startTime;
  result.success = procResult.success;
  result.exitCode = procResult.exitCode;
  result.error = procResult.error || null;
  result.runId = procResult.runId;
  result.runLogPath = procResult.runLogPath;
  result.structuredError = procResult.structuredError || null;
  result.summaryData = procResult.summary || null;

  // Output info
  if (fs.existsSync(outputVideo)) {
    const outInfo = probeInfo(outputVideo);
    result.outputPath = outputVideo;
    result.outputDuration = outInfo.duration;
    result.outputSize = outInfo.size;
    result.outputStreams = outInfo.streams;
    result.outputExists = true;
  } else {
    result.outputExists = false;
  }

  // Output report
  console.log('=== ROUND 2S RESULT ===');
  console.log(JSON.stringify(result, null, 2));
  console.log('=== END ===');

  // Export diagnostic pack (manually)
  if (result.runLogPath && fs.existsSync(result.runLogPath)) {
    if (!fs.existsSync(diagPackDir)) fs.mkdirSync(diagPackDir, { recursive: true });
    fs.copyFileSync(result.runLogPath, path.join(diagPackDir, 'latest_run.log'));
    fs.writeFileSync(path.join(diagPackDir, 'backend_diagnostics.json'), JSON.stringify(diag, null, 2));
    const lastOpts = backend.getLastOptions();
    if (lastOpts) fs.writeFileSync(path.join(diagPackDir, 'settings.json'), JSON.stringify(lastOpts, null, 2));
    const readme = `QuietCut Round 2S diagnostic pack.\nNo source video included.\nRun: ${result.runId}\nBackend: ${result.selectedBackend}\n`;
    fs.writeFileSync(path.join(diagPackDir, 'README.txt'), readme);
    const packZip = path.join(os.tmpdir(), 'quietcut-r2s-diagnostic-pack.zip');
    try { fs.unlinkSync(packZip); } catch {}
    execSync(`powershell -Command "Compress-Archive -Path '${diagPackDir}\\*' -DestinationPath '${packZip}' -Force"`, { timeout: 15000 });
    result.diagnosticPackPath = packZip;
    result.diagnosticPackContents = fs.readdirSync(diagPackDir);
  }

  // Cleanup
  try { fs.unlinkSync(tmpBundle); } catch {}
  try { fs.rmSync(diagPackDir, { recursive: true, force: true }); } catch {}

  console.log('\n=== PACK INFO ===');
  console.log(`Diagnostic pack: ${result.diagnosticPackPath}`);
  console.log(`Pack contents: ${result.diagnosticPackContents ? result.diagnosticPackContents.join(', ') : 'none'}`);

  const failures = !result.success ? 1 : 0;
  process.exit(failures);
})();
