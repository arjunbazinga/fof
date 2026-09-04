import { defineConfig } from 'vite';

// Served from https://arjunbazinga.github.io/fof/
export default defineConfig({
  base: '/fof/',
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    reportCompressedSize: true,
  },
});
