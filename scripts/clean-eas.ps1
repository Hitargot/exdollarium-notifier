<#
Stops Gradle daemons and removes native/build intermediates that cause EAS upload
errors (locked files under android/app/.cxx). Run this from the project root like:

# PowerShell (from notifier repo root)
# .\scripts\clean-eas.ps1

# This script is safe to run: it only removes build artifacts that Gradle will
# regenerate. If files are locked the script will silently continue; you may
# need to close IDEs or restart to release locks.
#>

Set-StrictMode -Version Latest

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptRoot "..")
$androidDir = Join-Path $projectRoot "android"

Write-Host "[clean-eas] Project root: $projectRoot"
Write-Host "[clean-eas] Android dir: $androidDir"

if (Test-Path (Join-Path $androidDir 'gradlew')) {
    Push-Location $androidDir
    Write-Host "[clean-eas] Stopping Gradle daemons..."
    & .\gradlew --stop 2>$null
    Pop-Location
} else {
    Write-Host "[clean-eas] gradlew not found in android dir, skipping daemon stop."
}

$toRemove = @(
    Join-Path $androidDir 'app\.cxx',
    Join-Path $androidDir 'app\build',
    Join-Path $androidDir '.externalNativeBuild',
    Join-Path $androidDir 'build',
    Join-Path $androidDir '.gradle'
)

foreach ($p in $toRemove) {
    if (Test-Path $p) {
        Write-Host "[clean-eas] Removing: $p"
        try {
            Remove-Item -Recurse -Force -ErrorAction Stop $p
        } catch {
            Write-Warning ("[clean-eas] Failed to remove {0}: {1}. You may have a locked file; close IDEs or restart and try again." -f $p, $_.Exception.Message)
        }
    } else {
        Write-Host "[clean-eas] Not present: $p"
    }
}

Write-Host "[clean-eas] Done. You can now retry 'eas build' or run the EAS upload again."

Exit 0
