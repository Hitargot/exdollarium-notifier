# Copy the transparent foreground icon (Exdollarium-11.png) into Android mipmap folders
# and ensure an adaptive icon XML exists that references it.

$srcForeground = Resolve-Path .\assets\Exdollarium-11.png
$destBase = ".\android\app\src\main\res"
$densities = @("mipmap-mdpi","mipmap-hdpi","mipmap-xhdpi","mipmap-xxhdpi","mipmap-xxxhdpi","mipmap-ldpi","mipmap-tvdpi")

if (!(Test-Path $srcForeground)) {
  Write-Error "Source foreground icon not found: $srcForeground"
  exit 1
}

foreach ($d in $densities) {
  $destDir = Join-Path $destBase $d
  if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir | Out-Null }
  Copy-Item $srcForeground -Destination (Join-Path $destDir "ic_launcher_foreground.png") -Force
  Copy-Item $srcForeground -Destination (Join-Path $destDir "ic_launcher_foreground_round.png") -Force
}

# Ensure mipmap-anydpi-v26 exists (adaptive icons folder)
$mipmapAny = Join-Path $destBase "mipmap-anydpi-v26"
if (!(Test-Path $mipmapAny)) { New-Item -ItemType Directory -Path $mipmapAny | Out-Null }

# Create/overwrite adaptive icon xml to point to the foreground we just copied
$adaptiveXmlPath = Join-Path $mipmapAny "ic_launcher.xml"
@'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/launcher_background"/>
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'@ | Out-File -FilePath $adaptiveXmlPath -Encoding utf8

# Ensure values/colors_launcher.xml exists
$values = Join-Path $destBase "values"
if (!(Test-Path $values)) { New-Item -ItemType Directory -Path $values | Out-Null }
$colorsPath = Join-Path $values "colors_launcher.xml"
@'
<resources>
  <color name="launcher_background">#FFFFFF</color>
</resources>
'@ | Out-File -FilePath $colorsPath -Encoding utf8

Write-Host "Android icons updated. Run a clean build and uninstall previous app to see changes on device."