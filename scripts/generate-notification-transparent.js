const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const projectRoot = path.resolve(__dirname, '..');
const resRoot = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
// Prefer notification_icon.jpg, fall back to common names
let srcNotif = path.join(projectRoot, 'assets', 'notification_icon.jpg');
if (!fs.existsSync(srcNotif)) {
  const alt = ['notification.png', 'notification_icon.png', 'notification.jpg'].map(n => path.join(projectRoot, 'assets', n)).find(p => fs.existsSync(p));
  if (alt) srcNotif = alt;
}

const densities = {
  'mipmap-ldpi': 36,
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
  'mipmap-tvdpi': 96,
};

const targets = ['notification_icon.png','ic_notification_large.png'];

async function makeTransparentWhite(src, size) {
  // Resize source to size, create a binary mask by thresholding luminance
  const resized = await sharp(src).resize(size, size, { fit: 'contain', background: { r:0,g:0,b:0, alpha: 0 } }).png().toBuffer();
  const mask = await sharp(resized).grayscale().threshold(160).raw().toBuffer(); // single-channel mask

  // Prepare RGBA buffer: white RGB + mask as alpha
  const outBuf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const alpha = mask[i]; // 0 or 255
    const baseIdx = i * 4;
    outBuf[baseIdx] = 255; // R
    outBuf[baseIdx + 1] = 255; // G
    outBuf[baseIdx + 2] = 255; // B
    outBuf[baseIdx + 3] = alpha; // A
  }

  return { data: outBuf, info: { width: size, height: size, channels: 4 } };
}

async function generate() {
  if (!fs.existsSync(srcNotif)) {
    console.error('Source notification image not found at', srcNotif);
    process.exit(1);
  }

  for (const [dir, size] of Object.entries(densities)) {
    const fullDir = path.join(resRoot, dir);
    if (!fs.existsSync(fullDir)) continue;
    console.log('Processing', dir, size);

    const { data, info } = await makeTransparentWhite(srcNotif, size);
    for (const name of targets) {
      const out = path.join(fullDir, name);
      await sharp(data, { raw: info }).png().toFile(out);
      console.log('  wrote', out);
    }

    // Also write into drawable-<density> if exists
    const drawableDir = fullDir.replace('mipmap-', 'drawable-');
    if (fs.existsSync(drawableDir)) {
      for (const name of targets) {
        const out = path.join(drawableDir, name);
        await sharp(data, { raw: info }).png().toFile(out);
        console.log('  wrote', out);
      }
    }
  }

  // Also write a default drawable copy
  const drawableDefault = path.join(resRoot, 'drawable', 'ic_notification_large.png');
  try {
    await sharp(data, { raw: info }).png().toFile(drawableDefault);
    console.log('Wrote', drawableDefault);
  } catch (e) { /* ignore */ }

  console.log('Notification transparent icons generated.');
}

generate().catch(err => { console.error(err); process.exit(1); });
