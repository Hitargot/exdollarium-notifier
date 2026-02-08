# PowerShell script: update-android-resources.ps1
# Purpose: Replace launcher/notification images under android/res with a provided PNG (IMG_940.PNG)
# Usage: run from the project root (exdollarium-notifier)
# Example: pwsh .\scripts\update-android-resources.ps1

Param(
    [string]$SourceFile = ".\assets\IMG_940.PNG",
    [switch]$RemoveWebP
)

if (!(Test-Path $SourceFile)) {
    Write-Error "Source image not found: $SourceFile"
    exit 1
}

$destBase = ".\android\app\src\main\res"
$densities = @("mipmap-mdpi","mipmap-hdpi","mipmap-xhdpi","mipmap-xxhdpi","mipmap-xxxhdpi","mipmap-ldpi","mipmap-tvdpi")

# Filenames to produce per density
$filesToWrite = @(
    'ic_launcher.png',
    'ic_launcher_round.png',
    'ic_launcher_foreground.png',
    'ic_launcher_foreground_round.png',
    'ic_notification_large.png'
)

Write-Host "Using source: $SourceFile"
Write-Host "Destination base: $destBase"

foreach ($d in $densities) {
    $destDir = Join-Path $destBase $d
    if (!(Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir | Out-Null
        Write-Host "Created directory: $destDir"
    }
    foreach ($fname in $filesToWrite) {
        $dest = Join-Path $destDir $fname
        if (Test-Path $dest) {
            Remove-Item $dest -Force -ErrorAction SilentlyContinue
            Write-Host "Removed existing: $dest"
        }
        Copy-Item $SourceFile -Destination $dest -Force
        Write-Host "Copied $SourceFile -> $dest"
    }
}

# If the repository contains a dedicated white notification icon at
# assets/notification_icon.png, copy it into drawable/ and into each
# density as notification_icon.png. Android prefers a white-only
# silhouette for the small status-bar icon.
$notifSource = ".\assets\notification_icon.png"
if (Test-Path $notifSource) {
    Write-Host "Found dedicated notification icon: $notifSource — copying to res folders"
    foreach ($d in $densities) {
        $destDir = Join-Path $destBase $d
        $dest = Join-Path $destDir "notification_icon.png"
        if (Test-Path $dest) { Remove-Item $dest -Force -ErrorAction SilentlyContinue; Write-Host "Removed existing: $dest" }
        Copy-Item $notifSource -Destination $dest -Force
        Write-Host "Copied $notifSource -> $dest"
    }
    # also copy into drawable/ only if there is no colliding vector XML resource
    $drawableDest = Join-Path $destBase "drawable"
    if (!(Test-Path $drawableDest)) { New-Item -ItemType Directory -Path $drawableDest | Out-Null }
    $destDrawableNotif = Join-Path $drawableDest "notification_icon.png"
    $collidingXml = Join-Path $drawableDest "notification_icon.xml"
    $collidingXmlAlt = Join-Path $drawableDest "notification_icon_vector.xml"
    if (Test-Path $collidingXml -or Test-Path $collidingXmlAlt) {
        Write-Host "Found existing drawable XML for notification_icon; skipping copying into drawable to avoid duplicate resource."
    } else {
        if (Test-Path $destDrawableNotif) { Remove-Item $destDrawableNotif -Force -ErrorAction SilentlyContinue }
        Copy-Item $notifSource -Destination $destDrawableNotif -Force
        Write-Host "Copied $notifSource -> $destDrawableNotif"
    }
}

# Also copy the notification large icon into drawable/ for broader compatibility
$drawable = Join-Path $destBase "drawable"
if (!(Test-Path $drawable)) { New-Item -ItemType Directory -Path $drawable | Out-Null; Write-Host "Created directory: $drawable" }
$destDrawable = Join-Path $drawable "ic_notification_large.png"
if (Test-Path $destDrawable) { Remove-Item $destDrawable -Force -ErrorAction SilentlyContinue; Write-Host "Removed existing: $destDrawable" }
Copy-Item $SourceFile -Destination $destDrawable -Force
Write-Host "Copied $SourceFile -> $destDrawable"

# Optionally remove any .webp files in res folders if requested
if ($RemoveWebP) {
    Write-Host "Removing .webp files under $destBase"
    Get-ChildItem -Path $destBase -Recurse -Include *.webp -File | ForEach-Object {
        try { Remove-Item $_.FullName -Force; Write-Host "Deleted: $($_.FullName)" } catch { Write-Warning "Failed to delete: $($_.FullName)" }
    }
}

Write-Host "Resource update complete. Rebuild required to apply changes to installed app."