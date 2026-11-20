import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Function to generate a PNG file from raw RGBA buffer
function createPngBuffer(width, height, rgbaBuffer) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image data with scanline filter byte (0)
  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rawOffset = y * scanlineLength;
    rawData[rawOffset] = 0; // None filter
    const bufferOffset = y * width * 4;
    rgbaBuffer.copy(rawData, rawOffset + 1, bufferOffset, bufferOffset + width * 4);
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  const crc32 = calcCrc32(buf.subarray(4, 4 + 4 + len));
  buf.writeUInt32BE(crc32, 4 + 4 + len);
  return buf;
}

// CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function calcCrc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function drawIcon(width, height, isMaskable = false) {
  const buf = Buffer.alloc(width * height * 4);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.45;
  const safeRadius = isMaskable ? width * 0.35 : radius;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background: Dark Slate #0f172a
      let r = 15;
      let g = 23;
      let b = 42;
      let a = 255;

      // Rounded background box
      if (!isMaskable) {
        const cornerRadius = width * 0.2;
        const qx = Math.abs(dx) - (cx - cornerRadius);
        const qy = Math.abs(dy) - (cy - cornerRadius);
        const cornerDist = Math.sqrt(Math.max(0, qx) ** 2 + Math.max(0, qy) ** 2);
        if (qx > 0 && qy > 0 && cornerDist > cornerRadius) {
          a = 0; // Transparent corners for standard icons
        }
      }

      if (a > 0) {
        // Glowing inner gradient ring (Indigo #6366f1 -> Cyan #06b6d4)
        const ringInner = safeRadius * 0.55;
        const ringOuter = safeRadius * 0.85;

        if (dist >= ringInner && dist <= ringOuter) {
          const factor = (dist - ringInner) / (ringOuter - ringInner);
          r = Math.round(99 + (6 - 99) * factor);
          g = Math.round(102 + (182 - 102) * factor);
          b = Math.round(241 + (212 - 241) * factor);
        } else if (dist < ringInner) {
          // Center core glow
          const coreFactor = 1 - (dist / ringInner);
          r = Math.round(15 + (99 - 15) * coreFactor * 0.5);
          g = Math.round(23 + (102 - 23) * coreFactor * 0.5);
          b = Math.round(42 + (241 - 42) * coreFactor * 0.5);
        }
      }

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = a;
    }
  }

  return createPngBuffer(width, height, buf);
}

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate all PNG icons
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), drawIcon(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), drawIcon(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), drawIcon(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), drawIcon(180, 180, false));

// Write SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
    <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="50%" stop-color="#a855f7" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#bgGrad)" />
  <circle cx="256" cy="256" r="140" fill="none" stroke="url(#iconGrad)" stroke-width="24" filter="url(#glow)" />
  <path d="M 196 256 C 196 200, 316 200, 316 256 C 316 312, 196 312, 196 256 Z" fill="none" stroke="url(#iconGrad)" stroke-width="20" stroke-linecap="round" />
  <circle cx="256" cy="256" r="32" fill="url(#iconGrad)" />
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf-8');

console.log('Successfully generated all PWA PNG icons and SVG brand assets in public/!');
