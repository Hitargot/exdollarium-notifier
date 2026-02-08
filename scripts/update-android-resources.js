const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcIcon = path.join(root, 'assets', 'IMG_940.PNG');
const notifIcon = path.join(root, 'assets', 'IMG_940.PNG');
const destBase = path.join(root, 'android', 'app', 'src', 'main', 'res');

const densities = ['mipmap-mdpi','mipmap-hdpi','mipmap-xhdpi','mipmap-xxhdpi','mipmap-xxxhdpi','mipmap-ldpi','mipmap-tvdpi'];
const filesToWrite = [
  'ic_launcher.png',
  'ic_launcher_round.png',
  'ic_launcher_foreground.png',
  'ic_launcher_foreground_round.png',
  'ic_notification_large.png'
];

function copyIfExists(src, dest) {
  try {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${src} -> ${dest}`);
  } catch (e) {
    console.warn(`Failed to copy ${src} -> ${dest}: ${e.message}`);
  }
}

if (!fs.existsSync(srcIcon)) {
  console.error('Source icon not found:', srcIcon);
  process.exit(1);
}

console.log('Using source icon:', srcIcon);
console.log('Destination base:', destBase);

densities.forEach(d => {
  const destDir = path.join(destBase, d);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  filesToWrite.forEach(fname => {
    const dest = path.join(destDir, fname);
    try { if (fs.existsSync(dest)) fs.unlinkSync(dest); } catch(e) {}
    copyIfExists(srcIcon, dest);
  });
});

if (fs.existsSync(notifIcon)) {
  console.log('Found notification icon:', notifIcon);
  densities.forEach(d => {
    const dest = path.join(destBase, d, 'notification_icon.png');
    try { if (fs.existsSync(dest)) fs.unlinkSync(dest); } catch(e) {}
    copyIfExists(notifIcon, dest);
  });
  const drawableDest = path.join(destBase, 'drawable');
  if (!fs.existsSync(drawableDest)) fs.mkdirSync(drawableDest, { recursive: true });
  const destDrawableNotif = path.join(drawableDest, 'notification_icon.png');
  try { if (fs.existsSync(destDrawableNotif)) fs.unlinkSync(destDrawableNotif); } catch (e) {}
  // avoid overwriting vector xmls
  const collidingXml = path.join(drawableDest, 'notification_icon.xml');
  if (!fs.existsSync(collidingXml)) copyIfExists(notifIcon, destDrawableNotif);
}

const drawable = path.join(destBase, 'drawable');
if (!fs.existsSync(drawable)) fs.mkdirSync(drawable, { recursive: true });
const destDrawable = path.join(drawable, 'ic_notification_large.png');
try { if (fs.existsSync(destDrawable)) fs.unlinkSync(destDrawable); } catch(e) {}
copyIfExists(srcIcon, destDrawable);

console.log('Resource update complete. Please rebuild the Android app (clean build) and reinstall on device/emulator.');
