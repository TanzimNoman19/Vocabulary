import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // Polyfill process.env so usage of process.env.API_KEY works in the browser.
      // We default to "" to prevent 'undefined' errors if the var is missing in Vercel.
      'process.env': JSON.stringify({
        API_KEY: env.API_KEY || "" 
      })
    }
  };
});