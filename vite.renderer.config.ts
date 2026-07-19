import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  html: {
    cspNonce: 'simforge-local-styles',
  },
  build: {
    sourcemap: true,
  },
});
