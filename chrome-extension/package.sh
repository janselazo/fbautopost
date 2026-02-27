#!/bin/bash
# Package the extension as a ZIP file for sideloading or Chrome Web Store
echo "Packaging DealerPost Pro Chrome Extension..."
cd "$(dirname "$0")"

# Create icons directory if needed
mkdir -p icons

# Generate simple PNG icons using Python (available on most systems)
python3 - <<'PYEOF'
import struct, zlib, os

def make_png(size, r, g, b):
    def chunk(name, data):
        c = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)

    raw = b''
    for y in range(size):
        raw += b'\x00'
        for x in range(size):
            # Simple rounded square logo
            cx, cy = size//2, size//2
            rad = size * 0.45
            dist = ((x-cx)**2 + (y-cy)**2)**0.5
            if dist <= rad:
                raw += bytes([r, g, b, 255])
            else:
                raw += bytes([0, 0, 0, 0])

    compressed = zlib.compress(raw)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', compressed)
    png += chunk(b'IEND', b'')
    return png

os.makedirs('icons', exist_ok=True)
for size in [16, 48, 128]:
    png = make_png(size, 212, 160, 23)  # #d4a017 gold color
    with open(f'icons/icon{size}.png', 'wb') as f:
        f.write(png)
    print(f'Generated icons/icon{size}.png')
PYEOF

# Create ZIP
zip -r dealerpost-pro.zip . \
  --exclude "*.sh" \
  --exclude "generate_icons.js" \
  --exclude "*.md" \
  --exclude ".DS_Store" \
  --exclude "dealerpost-pro.zip"

echo "Created dealerpost-pro.zip"
echo ""
echo "To install in Chrome:"
echo "1. Open chrome://extensions/"
echo "2. Enable 'Developer mode'"
echo "3. Click 'Load unpacked' and select this folder"
echo "   OR drag dealerpost-pro.zip to the extensions page"
