import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': { target: 'http://127.0.0.1:5174', changeOrigin: false },
    },
  },
  build: {
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'flow-vendor', test: /node_modules[\\/]@xyflow[\\/]/ },
            { name: 'motion-vendor', test: /node_modules[\\/](motion|framer-motion)[\\/]/ },
          ],
        },
      },
    },
  },
});
