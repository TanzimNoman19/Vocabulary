import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['vite.svg'],
        manifest: {
          name: 'Infinite Vocabulary',
          short_name: 'InfVocab',
          description: 'Expand your vocabulary with AI-generated definitions and stories.',
          lang: 'en',
          categories: ['education', 'productivity', 'utilities'],
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          orientation: 'portrait',
          icons: [
            {
              src: '/vite.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: '/vite.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any'
            }
          ],
          shortcuts: [
            {
              name: "Story Mode",
              short_name: "Story",
              description: "Start a vocabulary story",
              url: "/?mode=story",
              icons: [{ src: "/vite.svg", sizes: "192x192", type: "image/svg+xml" }]
            },
            {
              name: "Saved Words",
              short_name: "Saved",
              description: "View your collection",
              url: "/?mode=saved",
              icons: [{ src: "/vite.svg", sizes: "192x192", type: "image/svg+xml" }]
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
        }
      })
    ],
    define: {
      // Safely define API_KEY without overwriting the entire process.env object
      'process.env.API_KEY': JSON.stringify(env.API_KEY || "")
    }
  };
});