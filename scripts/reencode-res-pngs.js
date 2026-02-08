const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const resRoot = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

function findPngs(dir) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) {
      results.push(...findPngs(p));
    } else if (it.isFile() && it.name === 'ic_notification_large.png') {
      results.push(p);
    }
  }
  return results;
}

(async () => {
  try {
    if (!fs.existsSync(resRoot)) {
      console.error('res folder not found:', resRoot);
      process.exit(1);
    }
    const files = findPngs(resRoot);
    if (files.length === 0) {
      console.log('No ic_notification_large.png files found.');
      return;
    }
    console.log('Found', files.length, 'files');
    for (const f of files) {
      const temp = f + '.tmp.png';
      try {
        // Try writing to a temp file first
        await sharp(f)
          .png({ compressionLevel: 6, adaptiveFiltering: false })
          .toFile(temp);
        try {
          // Try atomic rename first (works across platforms when possible)
          fs.renameSync(temp, f);
          console.log('Re-encoded', f);
          continue;
        } catch (copyErr) {
          // If copy to original fails (locked or permission), try writing directly
          try {
            await sharp(f)
              .png({ compressionLevel: 6, adaptiveFiltering: false })
              .toFile(f);
            if (fs.existsSync(temp)) fs.unlinkSync(temp);
            console.log('Re-encoded (direct)', f);
            continue;
          } catch (directErr) {
            console.error('Failed to write directly for', f, directErr.message);
          }
        }
      } catch (err) {
        console.error('Failed to re-encode', f, err.message);
      }
    }
    console.log('Done');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();