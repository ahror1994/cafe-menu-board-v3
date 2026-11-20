import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/cafe-menu-board-v3/',
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      targets: ['chrome >= 49', 'android >= 5', 'safari >= 10', 'ios >= 10', 'not dead'],
    }),
  ],
  build: {
    target: 'es2015',
  },
})
