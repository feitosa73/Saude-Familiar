import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, r, g, b, isMaskable = false) {
  // Simple PNG encoder for solid / styled badge
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: 6 (RGBA)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw image scanlines
  // Each scanline starts with filter byte 0
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.45;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    scanlines[offset++] = 0; // Filter byte none
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Heart / Medical cross coordinates
      const isCrossVertical = Math.abs(dx) <= width * 0.08 && Math.abs(dy) <= height * 0.25;
      const isCrossHorizontal = Math.abs(dy) <= height * 0.08 && Math.abs(dx) <= width * 0.25;

      let pixelR = r;
      let pixelG = g;
      let pixelB = b;
      let pixelA = 255;

      if (!isMaskable && dist > radius) {
        // Outside circle corner
        pixelA = 0;
      } else if (isCrossVertical || isCrossHorizontal) {
        // Medical cross in white
        pixelR = 255;
        pixelG = 255;
        pixelB = 255;
      } else {
        // Subtle gradient
        const factor = 1 - (y / height) * 0.2;
        pixelR = Math.round(r * factor);
        pixelG = Math.round(g * factor);
        pixelB = Math.round(b * factor);
      }

      scanlines[offset++] = pixelR;
      scanlines[offset++] = pixelG;
      scanlines[offset++] = pixelB;
      scanlines[offset++] = pixelA;
    }
  }

  const compressedData = zlib.deflateSync(scanlines);
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = crc32(crcInput);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

// CRC32 implementation
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

// Generate PWA icons in royal blue (#1d4ed8 => 29, 78, 216)
fs.writeFileSync('public/pwa-192x192.png', createPNG(192, 192, 29, 78, 216));
fs.writeFileSync('public/pwa-512x512.png', createPNG(512, 512, 29, 78, 216));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPNG(512, 512, 29, 78, 216, true));
fs.writeFileSync('public/apple-touch-icon.png', createPNG(180, 180, 29, 78, 216));
fs.writeFileSync('public/favicon.ico', createPNG(32, 32, 29, 78, 216));

console.log('PWA icons created successfully in /public');
