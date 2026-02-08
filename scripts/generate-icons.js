const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const projectRoot = path.resolve(__dirname, '..');
const resRoot = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

const sources = {
  launcher: path.join(projectRoot, 'assets', 'IMG_940.PNG'),
  notification: path.join(projectRoot, 'assets', 'IMG_940.PNG'),
};

// Background color for images with transparency. Can be overridden via
// the ICON_BG environment variable (e.g. ICON_BG="#ffffff").
// If ICON_BG is set to the string 'transparent', the script will preserve
// alpha and not flatten the image. This is useful for masks and adaptive icons.
const BG_COLOR = process.env.ICON_BG || '#ffffff';
const PRESERVE_ALPHA = String(BG_COLOR).toLowerCase() === 'transparent';

const densities = {
  'mipmap-ldpi': 36,
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
  'mipmap-tvdpi': 96,
};

const launcherTargets = ['ic_launcher.png','ic_launcher_round.png','ic_launcher_foreground.png','ic_launcher_foreground_round.png'];
const notificationTargets = ['notification_icon.png','ic_notification_large.png'];
const drawableSplashTargets = ['splashscreen_logo.png'];

function ensure(file) {
  if (!fs.existsSync(file)) throw new Error('Missing file: ' + file);
}

async function generate() {
  try {
    ensure(sources.launcher);
    ensure(sources.notification);
  } catch (e) {
    console.error('Source images missing:', e.message);
    process.exit(1);
  }

  for (const [dir, size] of Object.entries(densities)) {
    const fullDir = path.join(resRoot, dir);
    if (!fs.existsSync(fullDir)) continue;
    console.log('Processing', dir, 'size', size);

    // launcher images
    for (const name of launcherTargets) {
      const out = path.join(fullDir, name);
      // Resize and flatten (apply background color) to ensure no transparency
      let pipe = sharp(sources.launcher).resize(size, size, { fit: 'cover' });
      if (!PRESERVE_ALPHA) pipe = pipe.flatten({ background: BG_COLOR });
      await pipe.png().toFile(out);
      console.log('  wrote', out);
    }

    // notification images
    for (const name of notificationTargets) {
      const out = path.join(fullDir, name);
      let pipe = sharp(sources.notification).resize(size, size, { fit: 'cover' });
      if (!PRESERVE_ALPHA) pipe = pipe.flatten({ background: BG_COLOR });
      await pipe.png().toFile(out);
      console.log('  wrote', out);
    }

    // splash drawable (put launcher source)
    // some projects use drawable-<density> folders; map to drawable-<density> equivalent
    const drawableDir = fullDir.replace('mipmap-', 'drawable-');
    if (fs.existsSync(drawableDir)) {
      for (const name of drawableSplashTargets) {
        const out = path.join(drawableDir, name);
        let pipe = sharp(sources.launcher).resize(size, size, { fit: 'cover' });
        if (!PRESERVE_ALPHA) pipe = pipe.flatten({ background: BG_COLOR });
        await pipe.png().toFile(out);
        console.log('  wrote', out);
      }
    }
  }

  // Also handle default drawable folders (without density suffix) - put a large 512 PNG
  const splashLarge = path.join(resRoot, 'drawable', 'splashscreen_logo.png');
  try {
    let pipe = sharp(sources.launcher).resize(512, 512, { fit: 'cover' });
    if (!PRESERVE_ALPHA) pipe = pipe.flatten({ background: BG_COLOR });
    await pipe.png().toFile(splashLarge);
    console.log('Wrote', splashLarge);
  } catch (e) { /* ignore */ }

  // Produce high-resolution square splash images suitable for platform-specific
  // guidelines (iOS 1024, Android adaptive up to 1152). These are written to
  // the project `assets/` folder for manual integration into Xcode/Android.
  const hiResSizes = [1152, 1024, 960, 768, 640];
  for (const s of hiResSizes) {
    const out = path.join(projectRoot, 'assets', `splash_${s}.png`);
    try {
      let pipe = sharp(sources.launcher).resize(s, s, { fit: 'cover' });
      if (!PRESERVE_ALPHA) pipe = pipe.flatten({ background: BG_COLOR });
      await pipe.png().toFile(out);
      console.log('Wrote hi-res splash', out);
    } catch (e) {
      console.warn('Failed to write hi-res splash', out, e.message || e);
    }
  }

  console.log('Icon generation complete.');
}

generate().catch(err => { console.error(err); process.exit(1); });
