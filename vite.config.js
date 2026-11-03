import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { collectBuildInfo } from './scripts/build-info.mjs'
import { formatBuildTime, formatBuildTitle } from './src/build-info.js'

function readStampedBuildInfo() {
  try {
    return JSON.parse(readFileSync(resolve('.build-info.json'), 'utf8'))
  } catch {
    // `vite build` invoked directly (without the npm script) still works.
    return collectBuildInfo()
  }
}

function escapeHtmlAttribute(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

// Replaces the footer placeholders in index.html at build time, so the update
// date is present even before JavaScript runs. The same date is stamped into
// every generated landing page by scripts/generate-seo-pages.mjs.
function buildInfoPlugin(info) {
  const replacements = {
    '%BUILD_TIME%': escapeHtmlAttribute(formatBuildTime(info.builtAt)),
    '%BUILD_ISO%': escapeHtmlAttribute(info.builtAt),
    '%BUILD_TITLE%': escapeHtmlAttribute(formatBuildTitle(info))
  }
  return {
    name: 'toolbox-build-info',
    transformIndexHtml(html) {
      let output = html
      for (const [placeholder, value] of Object.entries(replacements)) {
        output = output.replaceAll(placeholder, value)
      }
      return output
    }
  }
}

export default defineConfig(({ command }) => {
  const buildInfo = command === 'serve' ? collectBuildInfo() : readStampedBuildInfo()
  return {
    base: './',
    define: {
      __BUILD_INFO__: JSON.stringify(buildInfo)
    },
    plugins: [buildInfoPlugin(buildInfo)],
    build: {
      outDir: 'dist',
      assetsInlineLimit: 0,
      // The gpt-tokenizer BPE vocabularies are ~2.0 MB (o200k_base) and
      // ~0.95 MB (cl100k_base) before minification. They are reached only
      // through dynamic import() from the two AI tools that need them, so they
      // never touch the first paint — the default 500 kB warning is expected
      // noise here. The ceiling is set just above the larger vocabulary so a
      // genuinely new oversized chunk still trips it.
      chunkSizeWarningLimit: 2100
    },
    server: {
      port: 3000
    }
  }
})
