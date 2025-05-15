/* eslint-disable no-undef */
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000, // チャンクサイズの警告制限を1000kBに設定
  },
});
