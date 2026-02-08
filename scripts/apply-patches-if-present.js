const { execSync } = require('child_process');
const { existsSync, readdirSync, renameSync, mkdirSync } = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const patchesDir = path.join(repoRoot, 'patches');
const archivedDir = path.join(repoRoot, 'patches-archived');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function listPatchFiles() {
  if (!existsSync(patchesDir)) return [];
  return readdirSync(patchesDir).filter((f) => f.endsWith('.patch'));
}

function packageInstalledFromPatchName(patchFileName) {
  // patch file names are usually like 'package+version.patch' or may have prefixes
  const base = patchFileName.replace(/\.patch$/i, '');
  // remove disabled- prefix if present
  const cleaned = base.replace(/^disabled-/, '');
  // package name is before the first '+'
  const packageName = cleaned.split('+')[0];
  const candidate = path.join(repoRoot, 'node_modules', packageName);
  return existsSync(candidate);
}

ensureDir(archivedDir);
const patches = listPatchFiles();
if (patches.length === 0) {
  console.log('No patch files found, skipping patch-package.');
  process.exit(0);
}

// Move patches whose target package is not installed into archive
for (const p of patches) {
  try {
    if (!packageInstalledFromPatchName(p)) {
      console.log(`Archiving patch ${p} because target package is not installed`);
      const from = path.join(patchesDir, p);
      const to = path.join(archivedDir, p);
      renameSync(from, to);
    }
  } catch (err) {
    console.warn('Failed to process patch', p, err.message);
  }
}

const remaining = listPatchFiles();
if (remaining.length === 0) {
  console.log('No applicable patch files remain after archival. Skipping patch-package.');
  process.exit(0);
}

console.log('Applying remaining patches:', remaining.join(', '));
try {
  execSync('npx patch-package', { stdio: 'inherit' });
} catch (err) {
  console.error('patch-package failed:', err.message);
  process.exit(1);
}

