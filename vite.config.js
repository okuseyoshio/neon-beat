import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config tuned to also work inside Tauri's bundled webview.
//   - base: './' so generated asset URLs are relative (works under tauri://)
//   - clearScreen: false keeps Tauri build/dev logs visible
//   - strictPort: true so Tauri's hard-coded devUrl always matches
export default defineConfig({
  plugins: [react()],
  base: './',
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
});
