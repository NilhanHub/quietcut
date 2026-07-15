// Round 2 real smoke test driver.
// Run: node test/smoke_runner.js
// Bundles electron/backend.ts at runtime via esbuild (no separate build step).

const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

// Resolve TS files: bundle backend.ts to a temp .js at runtime
const tmpBundle = path.join(os.tmpdir(), 'quietcut_test_backend.cjs');
esbuild.buildSync({
  entryPoints: [path.resolve(__dirname, '..', 'electron', 'backend.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['electron'],
  outfile: tmpBundle,
});

const { ProcessingBackend } = require(tmpBundle);

function execProbeDuration(file) {
  try {
    return parseFloat(
      execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`, { encoding: 'utf-8' }).trim()
    );
  } catch {
    return -1;
  }
}

async function runSmoke(input, outName, margin) {
  const output = path.resolve(outName);
  const startTime = Date.now();

  const inputDur = execProbeDuration(input);
  console.log(`INPUT: ${input}`);
  console.log(`  duration: ${inputDur}s`);
  console.log(`  size: ${fs.statSync(input).size} bytes`);

  const backend = new ProcessingBackend();
  await backend.detectBackend();
  const diag = backend.getDiagnostics();
  console.log('BACKEND DIAGNOSTICS:');
  console.log(`  AE available:     ${diag.autoEditor.available} (version: ${diag.autoEditor.version || 'unknown'})`);
  console.log(`  AE path:          ${diag.autoEditor.path || 'none'}`);
  console.log(`  AE reason:        ${diag.autoEditor.reason || 'n/a'}`);
  diag.autoEditor.checkedPaths.forEach(p => console.log(`    AE checked: ${p}`));
  console.log(`  FF available:     ${diag.ffmpeg.available} (version: ${diag.ffmpeg.version || 'unknown'})`);
  console.log(`  FF reason:        ${diag.ffmpeg.reason || 'n/a'}`);
  console.log(`  Selected backend: ${diag.selected}`);

  if (fs.existsSync(output)) fs.unlinkSync(output);

  let lastLogTime = Date.now();
  let logCount = 0;
  const result = await backend.run(
    { inputPath: input, outputPath: output, margin: margin || '0.2s', whenSilent: 'cut' },
    (line) => {
      logCount++;
      if (Date.now() - lastLogTime > 50) {
        process.stdout.write('·');
        lastLogTime = Date.now();
      }
    }
  );
  process.stdout.write('\n');

  const elapsedMs = Date.now() - startTime;
  console.log('RESULT:');
  console.log(`  success:           ${result.success}`);
  console.log(`  exitCode:          ${result.exitCode}`);
  console.log(`  error:             ${result.error || '(none)'}`);
  console.log(`  outputPath:        ${result.outputPath}`);
  console.log(`  elapsed wallclock: ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`  internal processingMs: ${result.processingTime}ms`);
  console.log(`  structuredError:   ${result.structuredError ? 'YES' : 'none'}`);
  if (result.structuredError) {
    console.log(`    backend:         ${result.structuredError.backend}`);
    console.log(`    step:            ${result.structuredError.step}`);
    console.log(`    probableCause:   ${result.structuredError.probableCause}`);
    console.log(`    technicalCause:  ${result.structuredError.technicalCause}`);
    console.log(`    suggestedAction: ${result.structuredError.suggestedAction}`);
    console.log(`    logPath:         ${result.structuredError.logPath}`);
    console.log(`    runId:           ${result.structuredError.runId}`);
  }
  console.log(`  runId:             ${result.runId}`);
  console.log(`  runLogPath:        ${result.runLogPath}`);
  if (result.summary) {
    console.log('  SUMMARY:');
    console.log(`    backend:           ${result.summary.backend}`);
    console.log(`    commandArgCount:   ${result.summary.commandArgCount}`);
    console.log(`    commandTotalLength: ${result.summary.commandTotalLength}`);
    console.log(`    silentSections:    ${result.summary.silentSections}`);
    console.log(`    keepSections:      ${result.summary.keepSections}`);
    console.log(`    exitCode:          ${result.summary.exitCode}`);
    console.log(`    success:           ${result.summary.success}`);
    console.log(`    errorMessage:      ${result.summary.errorMessage}`);
  }

  if (result.success && fs.existsSync(output)) {
    const outStat = fs.statSync(output);
    const outDur = execProbeDuration(output);
    console.log('OUTPUT METRICS:');
    console.log(`  size:     ${outStat.size} bytes`);
    console.log(`  duration: ${outDur}s (input ${inputDur}s, ratio ${(outDur/inputDur).toFixed(3)})`);
    console.log(`  shorter:  ${outDur < inputDur ? 'YES' : 'NO'}`);
  }

  if (result.logs && result.logs.length) {
    console.log(`LOG (last 8 of ${result.logs.length}:)`);
    result.logs.slice(-8).forEach(l => console.log(`  ${l}`));
  }

  try { fs.unlinkSync(tmpBundle); } catch {}

  return { result, inputDur };
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'many';
  if (cmd === 'many') {
    const input = path.resolve('test_many_segments_input.mp4');
    const out = 'test_many_segments_output.mp4';
    if (!fs.existsSync(input)) { console.error('Missing input: ' + input); process.exit(1); }
    const { result, inputDur } = await runSmoke(input, out, process.env.QUIETCUT_MARGIN || '0.2s');
    if (!result.success || !fs.existsSync(out)) { console.log('OVERALL: FAIL'); process.exit(3); }
    const outStat = fs.statSync(out);
    const outDur = execProbeDuration(out);
    if (outStat.size > 0 && outDur < inputDur) {
      console.log('OVERALL: PASS');
      process.exit(0);
    }
    console.log('OVERALL: FAIL (output not valid)');
    process.exit(2);
  }
  if (cmd === 'short') {
    const input = path.resolve('test_silence_input.mp4');
    const out = 'test_silence_output_r2.mp4';
    if (!fs.existsSync(input)) { console.error('Missing input: ' + input); process.exit(1); }
    const { result, inputDur } = await runSmoke(input, out, process.env.QUIETCUT_MARGIN || '0.2s');
    if (!result.success || !fs.existsSync(out)) { console.log('OVERALL: FAIL'); process.exit(3); }
    const outStat = fs.statSync(out);
    const outDur = execProbeDuration(out);
    if (outStat.size > 0 && outDur < inputDur) {
      console.log('OVERALL: PASS');
      process.exit(0);
    }
    console.log('OVERALL: FAIL');
    process.exit(2);
  }
  console.error('Usage: node test/smoke_runner.js [many|short]');
  process.exit(1);
}

main().catch(err => { console.error('Crash:', err.stack || err.message); process.exit(99); });