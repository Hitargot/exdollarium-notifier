const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, 'assets', 'splash_1024.png');
const outDir = path.join(projectRoot, 'assets', 'AppIcon.appiconset');

if (!fs.existsSync(source)) {
  console.error('Source image not found:', source);
  process.exit(1);
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Define sizes according to Xcode AppIconset requirements
const iconDefinitions = [
  { size: 20, scales: [1,2,3], idiom: 'iphone', role: '', subtype: '' },
  { size: 29, scales: [1,2,3], idiom: 'iphone', role: '', subtype: '' },
  { size: 40, scales: [1,2,3], idiom: 'iphone', role: '', subtype: '' },
  { size: 60, scales: [2,3], idiom: 'iphone', role: '', subtype: '' },
  { size: 20, scales: [1,2], idiom: 'ipad', role: '', subtype: '' },
  { size: 29, scales: [1,2], idiom: 'ipad', role: '', subtype: '' },
  { size: 40, scales: [1,2], idiom: 'ipad', role: '', subtype: '' },
  { size: 76, scales: [1,2], idiom: 'ipad', role: '', subtype: '' },
  { size: 83.5, scales: [2], idiom: 'ipad', role: '', subtype: '' },
  // App Store
  { size: 1024, scales: [1], idiom: 'ios-marketing', role: '', subtype: '' },
];

const images = [];

async function generate() {
  for (const def of iconDefinitions) {
    for (const scale of def.scales) {
      const px = Math.round(def.size * scale);
      const filename = `Icon-${def.size}${scale === 1 ? '' : '@' + scale + 'x'}.png`;
      const outPath = path.join(outDir, filename);
      try {
        await sharp(source).resize(px, px, { fit: 'cover' }).png().toFile(outPath);
        images.push({
          idiom: def.idiom,
          size: `${def.size}x${def.size}`,
          scale: `${scale}x`,
          filename,
        });
        console.log('Wrote', outPath);
      } catch (e) {
        console.warn('Failed to write', outPath, e.message || e);
      }
    }
  }

  const contents = {
    images: images,
    info: { version: 1, author: 'xcode' }
  };

  fs.writeFileSync(path.join(outDir, 'Contents.json'), JSON.stringify(contents, null, 2), 'utf8');
  console.log('Wrote Contents.json in', outDir);
}

generate().catch(err => { console.error(err); process.exit(1); });
