import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Prevent ELECTRON_RUN_AS_NODE from parent process (e.g. Claude Code)
// from disabling Electron APIs in our app
delete process.env.ELECTRON_RUN_AS_NODE

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@main': resolve('src/main')
      }
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [tailwindcss(), react()]
  }
})
