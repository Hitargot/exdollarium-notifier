const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to the RN codegen script shipped with react-native
const rnScript = path.join(__dirname, '..', 'node_modules', 'react-native', 'scripts', 'generate-codegen-artifacts.js');

if (!fs.existsSync(rnScript)) {
  console.log('React Native codegen script not found at', rnScript, '\nSkipping codegen.');
  process.exit(0);
}

console.log('Running React Native codegen for Android...');

const outDir = path.join('android', 'app', 'build', 'generated', 'codegen');

function runArgs(args) {
  return spawnSync(process.execPath, [rnScript].concat(args), {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
  });
}

// Try the newer CLI style first (--platform / --output-dir). If that fails because
// the script expects the older -p/-t/-o args, retry with the legacy flags.
let attempt = runArgs(['--platform', 'android', '--output-dir', outDir]);
if (attempt.error) {
  console.error('Failed to spawn codegen script:', attempt.error);
  process.exit(1);
}

if (attempt.status === 0) {
  // print stdout/stderr from attempt
  process.stdout.write(attempt.stdout || '');
  process.stderr.write(attempt.stderr || '');
  process.exit(0);
}

const stdout = attempt.stdout || '';
const stderr = attempt.stderr || '';
const combined = (stdout + stderr).toLowerCase();

// Some libraries (notably older community libs) may not include JS specs
// or Fabric JS sources and the codegen script may emit ENOENT/lstat errors
// referencing '<module>/src/specs' or '<module>/src/fabric'. These are
// non-fatal for our app; log and continue.
const combinedLower = combined.toLowerCase();
const missingSpecsOrFabric = (combinedLower.includes('lstat') || combinedLower.includes('enoent') || combinedLower.includes('no such file'))
  && (
    combinedLower.includes('src/specs') || combinedLower.includes('src\\specs') || combinedLower.includes('src\\\\specs') ||
    combinedLower.includes('src/fabric') || combinedLower.includes('src\\fabric') || combinedLower.includes('src\\\\fabric')
  );
if (missingSpecsOrFabric) {
  console.log('[codegen] non-fatal: missing specs or fabric JS in a dependency (ignored).');
  process.exit(0);
}

if (combined.includes('missing required arguments') || combined.includes('options:') || combined.includes('usage: generate-codegen-artifacts.js')) {
  console.log('Retrying codegen with legacy CLI flags (-p -t -o)...');
  const legacyArgs = ['-p', path.join(__dirname, '..'), '-t', 'android', '-o', outDir];
  const legacy = runArgs(legacyArgs);
  if (legacy.error) {
    console.error('Failed to spawn legacy codegen script:', legacy.error);
    process.exit(1);
  }
  // handle the legacy attempt stderr similarly (ignore missing specs)
  const legacyStdout = legacy.stdout || '';
  const legacyStderr = legacy.stderr || '';
  const legacyCombined = (legacyStdout + legacyStderr).toLowerCase();
  const legacyMissingSpecsOrFabric = (legacyCombined.includes('lstat') || legacyCombined.includes('enoent') || legacyCombined.includes('no such file'))
    && (
      legacyCombined.includes('src/specs') || legacyCombined.includes('src\\specs') || legacyCombined.includes('src\\\\specs') ||
      legacyCombined.includes('src/fabric') || legacyCombined.includes('src\\fabric') || legacyCombined.includes('src\\\\fabric')
    );
  if (legacyMissingSpecsOrFabric) {
    console.log('[codegen] non-fatal: missing specs or fabric JS in a dependency (ignored, legacy attempt).');
    process.exit(0);
  }
  process.stdout.write(legacy.stdout || '');
  process.stderr.write(legacy.stderr || '');
  process.exit(legacy.status || 0);
} else {
  // Unknown failure, print outputs and exit non-zero so the caller can see the reason
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  process.exit(attempt.status || 1);
}
