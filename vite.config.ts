/// <reference types="vitest" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import postcssMixins from 'postcss-mixins'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import svgr from 'vite-plugin-svgr'
import tsconfigPaths from 'vite-tsconfig-paths'

const ext = {
  cjs: 'cjs',
  es: 'js',
} as const

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
}

const externalPackages = [
  ...Object.keys(packageJson.dependencies),
  ...Object.keys(packageJson.peerDependencies),
  /@lexical\/react\/.*/,
  'react/jsx-runtime',
  'react/jsx-dev-runtime'
]

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    dts({
      rollupTypes: true,
      staticImport: true,
      compilerOptions: {
        skipLibCheck: true,
      },
    }),
    svgr({
      svgrOptions: {
        svgo: true,
        replaceAttrValues: { 'black': 'currentColor' }
      }
    }),
    tsconfigPaths()
  ],
  build: {
    minify: false,
    cssMinify: false,
    lib: {
      cssFileName: 'styles',
      entry: {
        core: resolve(__dirname, 'src/core.ts'),
        index: resolve(__dirname, 'src/index.ts'),
        persistence: resolve(__dirname, 'src/persistence.ts')
      },
      formats: ['es'],
      fileName: (format, entryName) => {
        return `${entryName}.${ext[format as 'cjs' | 'es']}`
      },
    },
    rollupOptions: {
      output: {
        exports: 'named',
        preserveModules: true,
        preserveModulesRoot: 'src'
      },
      external: externalPackages,
    },
  },
  test: {
    include: ['src/test/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
  },
  css: {
    modules: {
      scopeBehaviour: 'local',
      localsConvention: 'camelCaseOnly'
    },
    postcss: {
      plugins: [postcssMixins()]
    }
  }
})
