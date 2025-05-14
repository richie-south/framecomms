import {defineConfig} from 'vite'

// Only used for tests, bundles an umd so it cane injected into iframe

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'testFramecomms',
      fileName: 'testFramecomms',
      formats: ['umd'],
    },
    rollupOptions: {
      output: {
        globals: {},
      },
    },
  },
})
