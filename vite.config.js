import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    // The gpt-tokenizer BPE vocabularies are ~2.0 MB (o200k_base) and
    // ~0.95 MB (cl100k_base) before minification. They are reached only
    // through dynamic import() from the two AI tools that need them, so they
    // never touch the first paint — the default 500 kB warning is expected
    // noise here. The ceiling is set just above the larger vocabulary so a
    // genuinely new oversized chunk still trips it.
    chunkSizeWarningLimit: 2100,
  },
  server: {
    port: 3000,
  },
})
