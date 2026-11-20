import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Uncommon port + strictPort: fail loudly instead of drifting onto another project's port.
  server: { port: 5310, strictPort: true },
  preview: { port: 5310, strictPort: true },
});
