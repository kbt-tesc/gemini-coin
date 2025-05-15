/* eslint-disable no-undef */
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // 相対パスを使用するように設定
  build: {
    chunkSizeWarningLimit: 3000, // チャンクサイズの警告制限を1000kBに設定
  },
});
