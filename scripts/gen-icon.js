// Genera resources/icon.png a 1024x1024 con un círculo anti-aliased,
// tomando el color del icono original. Sin dependencias externas (solo zlib de Node).
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

const SRC = path.join(__dirname, '..', 'resources', 'icon.png')
const SIZE = 1024

// ── CRC32 (para chunks PNG) ──────────────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ── Decodificar PNG RGBA-8 sin interlace (suficiente para el icono fuente) ─
function decodePng(file) {
  const buf = fs.readFileSync(file)
  let p = 8 // saltar firma
  let width, height, bitDepth, colorType
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('ascii', p + 4, p + 8)
    const data = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
    p += 12 + len
  }
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`fuente no es RGBA-8 (bd=${bitDepth} ct=${colorType})`)
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = 4
  const stride = width * bpp
  const out = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const rowIn = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0
      let v = rowIn[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      out[y * stride + x] = v & 0xff
    }
  }
  return { width, height, data: out }
}

// ── Codificar PNG RGBA-8 ──────────────────────────────────────────────────
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filtro none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ── 1) leer color + radio del icono fuente ────────────────────────────────
const src = decodePng(SRC)
const cx = src.width / 2, cy = src.height / 2
const px = (x, y) => src.data.subarray((y * src.width + x) * 4, (y * src.width + x) * 4 + 4)
const center = px(Math.floor(cx), Math.floor(cy))
const [R, G, B] = [center[0], center[1], center[2]]
// radio: escanear la fila central buscando alpha>128
let minX = src.width, maxX = -1
for (let x = 0; x < src.width; x++) {
  if (px(x, Math.floor(cy))[3] > 128) { if (x < minX) minX = x; if (x > maxX) maxX = x }
}
const srcRadius = (maxX - minX + 1) / 2
const ratio = srcRadius / src.width // proporción radio/lado del icono original (~0.94)
console.log(`color=rgb(${R},${G},${B}) ratio=${ratio.toFixed(3)}`)

// ── 2) dibujar un círculo anti-aliased a cualquier tamaño ──────────────────
function circlePng(size, fillRatio) {
  const out = Buffer.alloc(size * size * 4)
  const c = size / 2 - 0.5
  const radius = fillRatio * size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c)
      let cov = radius + 0.5 - d // 1 dentro, 0 fuera, transición de 1px en el borde
      cov = cov < 0 ? 0 : cov > 1 ? 1 : cov
      const i = (y * size + x) * 4
      out[i] = R; out[i + 1] = G; out[i + 2] = B; out[i + 3] = Math.round(cov * 255)
    }
  }
  return encodePng(size, size, out)
}

// Icono de la app (Finder / dock / .exe / instalador): 1024×1024, mismo margen que el original
fs.writeFileSync(SRC, circlePng(SIZE, ratio))
console.log('escrito', SRC, `(${SIZE}px)`)

// Icono del tray (barra de menú macOS / bandeja Windows): 32×32, casi lleno para que se vea
const TRAY = path.join(__dirname, '..', 'resources', 'tray.png')
fs.writeFileSync(TRAY, circlePng(32, 0.46))
console.log('escrito', TRAY, '(32px)')
