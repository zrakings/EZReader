import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base makes the same build work on github.io/<repository>/,
// a custom domain, or any static host.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          pdf: ['pdfjs-dist'],
          epub: ['epubjs'],
          archive: ['jszip', 'libarchive.js'],
          documents: ['mammoth', 'dompurify'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['libarchive.js'],
  },
})
