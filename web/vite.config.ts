import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const basePath = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  plugins: [react()],
  base: basePath,
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    allowedHosts: ['vilenarios.com', '.vilenarios.com'],
    proxy: {
      [`${basePath}api`]: {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (p) => p.replace(new RegExp(`^${basePath}api`), ''),
      },
    },
  },
});
