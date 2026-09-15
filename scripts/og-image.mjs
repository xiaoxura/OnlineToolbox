// Generates Open Graph cards as real PNGs with no image dependency.
//
// PNG is just zlib-compressed scanlines, and Node ships zlib, so the encoder is
// small. Text is drawn from an embedded 5x7 bitmap font — tool ids are ASCII, so
// no CJK font (which would be megabytes) is needed. Scaling the glyphs up gives
// the cards a deliberate technical look rather than a blurry upscale.
import { deflateSync } from 'node:zlib'

const WIDTH = 1200
const HEIGHT = 630

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xFFFFFFFF
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, crc])
}

export function encodePng(width, height, rgb) {
  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter type 0 (None)
    rgb.copy
      ? rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
      : Buffer.from(rgb.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // colour type: truecolour RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// --- 5x7 bitmap font (ASCII subset used by tool ids) -------------------------

const FONT = {
  A: [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11], B: [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
  C: [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E], D: [0x1E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1E],
  E: [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F], F: [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
  G: [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F], H: [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  I: [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1F], J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11], L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
  M: [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11], N: [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
  O: [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E], P: [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
  Q: [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D], R: [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
  S: [0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E], T: [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E], V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1B, 0x11], X: [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04], Z: [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
  0: [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E], 1: [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
  2: [0x0E, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1F], 3: [0x1F, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0E],
  4: [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02], 5: [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
  6: [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E], 7: [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  8: [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E], 9: [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
  '-': [0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10]
}

const GLYPH_W = 5
const GLYPH_H = 7

function measureText(text, scale, tracking) {
  return text.length * (GLYPH_W * scale + tracking) - tracking
}

function drawText(surface, text, x, y, scale, tracking, color) {
  let cursor = x
  for (const raw of text.toUpperCase()) {
    const glyph = FONT[raw] || FONT[' ']
    for (let row = 0; row < GLYPH_H; row++) {
      for (let col = 0; col < GLYPH_W; col++) {
        if (!(glyph[row] & (1 << (GLYPH_W - 1 - col)))) continue
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            setPixel(surface, cursor + col * scale + dx, y + row * scale + dy, color)
          }
        }
      }
    }
    cursor += GLYPH_W * scale + tracking
  }
  return cursor
}

function setPixel(surface, x, y, [r, g, b]) {
  if (x < 0 || y < 0 || x >= surface.width || y >= surface.height) return
  const offset = (y * surface.width + x) * 3
  surface.data[offset] = r
  surface.data[offset + 1] = g
  surface.data[offset + 2] = b
}

function fillRect(surface, x, y, w, h, color) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) setPixel(surface, px, py, color)
  }
}

// --- Card composition -------------------------------------------------------

// Per-category accents keep the 157 cards visually distinguishable while the
// layout stays identical, so they read as one set.
const CATEGORY_ACCENTS = {
  encoding: [129, 140, 248], crypto: [244, 114, 182], text: [52, 211, 153],
  generator: [251, 191, 36], converter: [96, 165, 250], formatter: [167, 139, 250],
  devtool: [34, 211, 238], image: [251, 146, 60], network: [45, 212, 191],
  math: [248, 113, 113], ai: [192, 132, 252]
}

const BACKGROUND_TOP = [0x17, 0x18, 0x22]
const BACKGROUND_BOTTOM = [0x0d, 0x0e, 0x14]
const MUTED = [0x6b, 0x72, 0x88]

export function renderOgCard({ id, category }) {
  const surface = { width: WIDTH, height: HEIGHT, data: Buffer.alloc(WIDTH * HEIGHT * 3) }
  const accent = CATEGORY_ACCENTS[category] || CATEGORY_ACCENTS.devtool

  // Vertical gradient background.
  for (let y = 0; y < HEIGHT; y++) {
    const t = y / (HEIGHT - 1)
    const color = [
      Math.round(BACKGROUND_TOP[0] + (BACKGROUND_BOTTOM[0] - BACKGROUND_TOP[0]) * t),
      Math.round(BACKGROUND_TOP[1] + (BACKGROUND_BOTTOM[1] - BACKGROUND_TOP[1]) * t),
      Math.round(BACKGROUND_TOP[2] + (BACKGROUND_BOTTOM[2] - BACKGROUND_TOP[2]) * t)
    ]
    fillRect(surface, 0, y, WIDTH, 1, color)
  }

  // Faint diagonal hatch, drawn as a dark overlay so it stays subtle.
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if ((x + y) % 34 === 0) {
        const offset = (y * WIDTH + x) * 3
        surface.data[offset] = Math.min(255, surface.data[offset] + 9)
        surface.data[offset + 1] = Math.min(255, surface.data[offset + 1] + 9)
        surface.data[offset + 2] = Math.min(255, surface.data[offset + 2] + 14)
      }
    }
  }

  // Accent bar along the top edge and a matching rule under the title.
  fillRect(surface, 0, 0, WIDTH, 10, accent)

  const padding = 84
  drawText(surface, 'onlinetoolbox', padding, 96, 3, 6, MUTED)

  // Tool id as the headline, scaled to fit the available width.
  const label = id
  let scale = 13
  while (scale > 4 && measureText(label, scale, scale) > WIDTH - padding * 2) scale -= 1
  const tracking = scale
  const textWidth = measureText(label, scale, tracking)
  drawText(surface, label, padding, 260, scale, tracking, [0xf4, 0xf5, 0xf8])

  fillRect(surface, padding, 260 + GLYPH_H * scale + 44, Math.min(textWidth, 420), 8, accent)

  // Squares echoing the logo mark, bottom-right.
  const markSize = 26
  const markGap = 12
  const markOriginX = WIDTH - padding - markSize * 2 - markGap
  const markOriginY = HEIGHT - padding - markSize * 2 - markGap
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const isAccent = row === 1 && col === 1
      fillRect(
        surface,
        markOriginX + col * (markSize + markGap),
        markOriginY + row * (markSize + markGap),
        markSize,
        markSize,
        isAccent ? accent : [0x2c, 0x2f, 0x3d]
      )
    }
  }

  return encodePng(WIDTH, HEIGHT, surface.data)
}
