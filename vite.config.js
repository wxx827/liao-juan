import { defineConfig } from 'vite';

// base:'./' 让构建产物可以部署在任意子路径（如 GitHub Pages 项目页）
export default defineConfig({
  base: './',
  build: {
    target: 'es2018',
    assetsInlineLimit: 4096,
  },
  server: {
    host: true,
    port: 5173,
  },
});
