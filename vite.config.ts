/**
 * Vite configuration for OHIF Viewer development.
 *
 * This is a development-only config to enable fast HMR during development.
 * Production builds still use Webpack for full compatibility.
 *
 * Usage: npx vite (from project root)
 *
 * Note: This requires `vite` and `@vitejs/plugin-react` as devDependencies.
 * Install with: yarn add -D vite @vitejs/plugin-react
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: 'platform/app',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'platform/app/src'),
      '@components': path.resolve(__dirname, 'platform/app/src/components'),
      '@hooks': path.resolve(__dirname, 'platform/app/src/hooks'),
      '@routes': path.resolve(__dirname, 'platform/app/src/routes'),
      '@state': path.resolve(__dirname, 'platform/app/src/state'),
      '@ohif/core': path.resolve(__dirname, 'platform/core/src'),
      '@ohif/ui': path.resolve(__dirname, 'platform/ui/src'),
      '@ohif/ui-next': path.resolve(__dirname, 'platform/ui-next/src'),
      '@ohif/i18n': path.resolve(__dirname, 'platform/i18n/src'),
      '@ohif/extension-default': path.resolve(__dirname, 'extensions/default/src'),
      '@ohif/extension-cornerstone': path.resolve(__dirname, 'extensions/cornerstone/src'),
      '@ohif/extension-measurement-tracking': path.resolve(
        __dirname,
        'extensions/measurement-tracking/src'
      ),
      '@ohif/extension-cornerstone-dicom-sr': path.resolve(
        __dirname,
        'extensions/cornerstone-dicom-sr/src'
      ),
      '@ohif/extension-cornerstone-dicom-seg': path.resolve(
        __dirname,
        'extensions/cornerstone-dicom-seg/src'
      ),
      '@ohif/extension-cornerstone-dicom-pmap': path.resolve(
        __dirname,
        'extensions/cornerstone-dicom-pmap/src'
      ),
      '@ohif/extension-cornerstone-dicom-rt': path.resolve(
        __dirname,
        'extensions/cornerstone-dicom-rt/src'
      ),
      '@ohif/extension-dicom-pdf': path.resolve(__dirname, 'extensions/dicom-pdf/src'),
      '@ohif/extension-dicom-video': path.resolve(__dirname, 'extensions/dicom-video/src'),
      '@ohif/extension-dicom-ecg': path.resolve(__dirname, 'extensions/dicom-ecg/src'),
      '@ohif/extension-ai': path.resolve(__dirname, 'extensions/ai/src'),
      '@ohif/extension-collaboration': path.resolve(__dirname, 'extensions/collaboration/src'),
      '@ohif/mode-basic': path.resolve(__dirname, 'modes/basic/src'),
      '@ohif/mode-longitudinal': path.resolve(__dirname, 'modes/longitudinal/src'),
      '@ohif/mode-segmentation': path.resolve(__dirname, 'modes/segmentation/src'),
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/dicom-web': {
        target: 'http://localhost:8042',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'i18next', 'react-i18next'],
    exclude: ['@cornerstonejs/core', '@cornerstonejs/tools'],
  },
  build: {
    outDir: '../../dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-i18n': ['i18next', 'react-i18next'],
        },
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.PUBLIC_URL': JSON.stringify(process.env.PUBLIC_URL || '/'),
    'process.env.BUILD_NUM': JSON.stringify('0'),
    'process.env.VERSION_NUMBER': JSON.stringify('3.12.0'),
  },
});
