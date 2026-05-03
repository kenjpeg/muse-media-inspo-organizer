import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'better-sqlite3',
        'sharp',
        'chokidar',
        'node-vibrant',
        'node-vibrant/node',
      ],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
  resolve: {
    browserField: false,
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
});
