// Rasterises the favicon into the PNG sizes required by browsers and PWA
// installers. Run `npm run icons` after changing public/favicon.svg.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const outputDir = resolve('public/icons')
const source = await readFile(resolve('public/favicon.svg'), 'utf8')
const pathData = source.match(/<path[^>]*\bd="([^"]+)"/)?.[1]
if (!pathData) throw new Error('favicon.svg does not contain a path')

const iconSvg = (size, { safe = false } = {}) => {
  const padding = safe ? size * 0.22 : size * 0.16
  const inner = size - padding * 2
  const scale = inner / 24
  const radius = safe ? 0 : size * 0.22
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="#4f46d9"/>
    <g transform="translate(${padding} ${padding}) scale(${scale})" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="${pathData}"/>
    </g>
  </svg>`
}

await mkdir(outputDir, { recursive: true })
const variants = [
  { name: 'icon-180.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512, safe: true }
]

for (const variant of variants) {
  const svg = iconSvg(variant.size, variant)
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: variant.size } }).render().asPng()
  await writeFile(resolve(outputDir, variant.name), png)
  console.log(`icons/${variant.name} (${png.length} bytes)`)
}
