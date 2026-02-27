// Generates simple placeholder icons using Canvas API
// Run with: node generate_icons.js (requires Node.js with canvas package)
// OR just use any square PNG images renamed to icon16.png, icon48.png, icon128.png

const fs = require('fs');
const { createCanvas } = require('canvas');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#d4a017';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  // Letter D
  ctx.fillStyle = '#000';
  ctx.font = `bold ${size * 0.55}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DP', size / 2, size / 2);

  return canvas.toBuffer('image/png');
}

[16, 48, 128].forEach(size => {
  try {
    const buf = generateIcon(size);
    fs.writeFileSync(`icons/icon${size}.png`, buf);
    console.log(`Generated icon${size}.png`);
  } catch (e) {
    console.log(`Skipping icon${size}.png (canvas not available)`);
  }
});
