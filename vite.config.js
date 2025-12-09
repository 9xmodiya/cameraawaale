import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // FIX: Increases the warning threshold for large JS chunks from the default 500kb to 1000kb (1MB).
    // This addresses the warning you saw in the build logs.
    chunkSizeWarningLimit: 1000, 
  }
})
