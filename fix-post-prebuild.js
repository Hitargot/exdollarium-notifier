const fs = require('fs');
const path = require('path');

// 1. Fix colors.xml - add notification_icon_color and splashscreen_background
const colorsPath = path.join(__dirname, 'android/app/src/main/res/values/colors.xml');
const colorsContent = [
  '<resources>',
  '  <color name="splashscreen_background">#162660</color>',
  '  <color name="colorPrimary">#023c69</color>',
  '  <color name="colorPrimaryDark">#ffffff</color>',
  '  <!-- Default notification color used by Firebase/Expo notifications -->',
  '  <color name="notification_icon_color">#162660</color>',
  '</resources>',
].join('\n');
fs.writeFileSync(colorsPath, colorsContent, 'utf8');
console.log('✅ Fixed colors.xml');

// 2. Create notification_icon.xml drawable
const drawablePath = path.join(__dirname, 'android/app/src/main/res/drawable/notification_icon.xml');
const drawableContent = [
  '<bitmap xmlns:android="http://schemas.android.com/apk/res/android"',
  '  android:src="@mipmap/notification_icon"',
  '  android:tint="@android:color/white" />',
].join('\n');
fs.writeFileSync(drawablePath, drawableContent, 'utf8');
console.log('✅ Created notification_icon.xml');

// 3. Fix AndroidManifest.xml - add missing permissions and attributes
const manifestPath = path.join(__dirname, 'android/app/src/main/AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');

// Add missing media permissions after READ_EXTERNAL_STORAGE
const readExtStorage = '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>';
const mediaPermissions = [
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>',
  '  <uses-permission android:name="android.permission.READ_MEDIA_AUDIO"/>',
  '  <uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>',
  '  <uses-permission android:name="android.permission.READ_MEDIA_VIDEO"/>',
  '  <uses-permission android:name="android.permission.READ_MEDIA_VISUAL_USER_SELECTED"/>',
].join('\n');

if (manifest.includes(readExtStorage) && !manifest.includes('READ_MEDIA_AUDIO')) {
  manifest = manifest.replace(readExtStorage, mediaPermissions);
  console.log('✅ Added READ_MEDIA_* permissions');
}

// Add android:supportsRtl and android:enableOnBackInvokedCallback to <application>
if (!manifest.includes('android:supportsRtl')) {
  manifest = manifest.replace(
    'android:requestLegacyExternalStorage="true">',
    'android:requestLegacyExternalStorage="true" android:supportsRtl="true" android:enableOnBackInvokedCallback="false">'
  );
  console.log('✅ Added supportsRtl and enableOnBackInvokedCallback');
}

fs.writeFileSync(manifestPath, manifest, 'utf8');
console.log('✅ Fixed AndroidManifest.xml');

console.log('\nAll post-prebuild fixes applied!');
