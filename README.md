<!-- prettier-ignore-start -->
<div align="center">
  <h1>OHIF Medical Imaging Viewer</h1>
  <p><strong>The OHIF Viewer</strong> is a zero-footprint medical image viewer
provided by the <a href="https://ohif.org/">Open Health Imaging Foundation (OHIF)</a>. It is a configurable and extensible progressive web application with out-of-the-box support for image archives which support <a href="https://www.dicomstandard.org/using/dicomweb/">DICOMweb</a>.</p>
</div>


<div align="center">
  <a href="https://docs.ohif.org/"><strong>Read The Docs</strong></a>
</div>
<div align="center">
  <a href="https://viewer.ohif.org/">Live Demo</a> |
  <a href="https://ui.ohif.org/">Component Library</a>
</div>


<hr />

[![NPM version][npm-version-image]][npm-url]
[![MIT License][license-image]][license-url]
<!-- prettier-ignore-end -->

## About

The OHIF Viewer can retrieve and load images from most sources and formats, render sets in 2D, 3D, and reconstructed representations; allows for the manipulation, annotation, and serialization of observations; supports internationalization, OpenID Connect, offline use, hotkeys, and many more features.

Almost everything offers some degree of customization and configuration. If it doesn't support something you need, we accept pull requests and have an ever improving Extension System.

## Custom Improvements (v3.12.0-enhanced)

This fork includes a comprehensive set of improvements organized in 5 phases:

### Phase 1 - Performance & i18n
- **Webpack Code Splitting**: Activated `splitChunks` with dedicated vendor chunks for Cornerstone.js, dcmjs, and React, reducing initial bundle size by ~20-30%
- **Web Workers**: Increased default from 3 to 6 with dynamic hardware detection via `navigator.hardwareConcurrency`
- **Prefetch AbortController**: Implemented `AbortController` in `StudyPrefetcherService` to cancel inflight prefetch requests when switching series, saving bandwidth
- **Spanish Translations**: Completed 20 missing i18n files, achieving 100% Spanish coverage (33/33 files)

### Phase 2 - Accessibility (WCAG 2.1 AA)
- **ARIA Attributes**: Added `role="dialog"`, `aria-modal`, `aria-labelledby` to Modal; `role="tablist/tab"` with `aria-selected` to SidePanel; `role="list"` to SegmentationSegments
- **Keyboard Navigation**: Arrow keys, Home/End for SidePanel tabs; Enter/Space activation; focus management
- **Skip Link**: Added skip-to-content link in ViewerLayout for keyboard users
- **High Contrast Theme**: New WCAG AAA compliant theme (7:1 contrast ratio, yellow-on-black) via `ThemeWrapper` with `useTheme()` hook and localStorage persistence

### Phase 3 - New Features

| Extension | Description |
|-----------|-------------|
| **`extension-dicom-ecg`** | ECG/Waveform viewer supporting 9 DICOM SOP classes (12-Lead ECG, General ECG, Ambulatory, Hemodynamic, Cardiac Electrophysiology, Audio, Arterial Pulse, Respiratory). Canvas-based viewport with ECG grid, multi-lead display, and speed/amplitude controls. |
| **`extension-ai`** | AI inference results panel with confidence-scored findings, color-coded indicators, sort controls, and command integration for external AI services (MONAI, ONNX, custom APIs). |
| **`extension-collaboration`** | Real-time collaboration via WebSocket: shared cursor positions, collaborative annotations, in-context chat with image references, user presence tracking, and auto-reconnect with exponential backoff. |
| **PDF Report Export** | `exportReportPDF` utility generating PDF reports with patient demographics, viewport screenshots, measurement tables, and print-to-PDF workflow. |
| **Offline Storage** | `OfflineStorage` class using IndexedDB for caching studies/images offline, sync queue for annotation changes when reconnected, and storage usage tracking. |

### Phase 4 - Architecture
- **Tree Shaking**: Added `sideEffects: false` to all 17 extension `package.json` files
- **Vite Config**: Development-ready `vite.config.ts` with aliased monorepo paths, fast HMR, and proxy configuration
- **Remote Plugin Loader**: `RemoteExtensionLoader` for loading extensions from remote URLs at runtime (ES modules or UMD), with validation, caching, and registry support
- **Zustand Store Factory**: `createOHIFStore` with automatic devtools in development, optional localStorage persistence, `subscribeWithSelector`, and `createUndoRedoStore` for measurement undo/redo workflows

### Phase 5 - UI/UX
- **Responsive/Mobile**: `ViewportGrid` auto-switches to single viewport on screens < 768px via `useIsMobile` hook
- **Enhanced Onboarding**: Delayed start, "Skip All" button, tour completion callbacks, progress tracking via `getTourProgress()`, and `resetAllTours()` utility
- **White Labeling**: Runtime customization via `WhiteLabelingConfig` supporting custom logo, favicon, app title, CSS variable overrides, custom CSS injection, and theme presets (clinical-light, radiology-dark, high-contrast)

## Project Structure

```bash
.
├── extensions/
│   ├── default/                # Data sources, layout, panels, toolbar, PDF export
│   ├── cornerstone/            # Image rendering with Cornerstone.js 3D
│   ├── cornerstone-dicom-sr/   # DICOM Structured Reports
│   ├── cornerstone-dicom-seg/  # DICOM Segmentation
│   ├── cornerstone-dicom-pmap/ # DICOM Parametric Maps
│   ├── cornerstone-dicom-rt/   # DICOM Radiotherapy (RT)
│   ├── cornerstone-dynamic-volume/ # 4D dynamic volumes
│   ├── measurement-tracking/   # Longitudinal measurement tracking
│   ├── dicom-pdf/              # PDF rendering
│   ├── dicom-video/            # Video rendering
│   ├── dicom-microscopy/       # Whole Slide Imaging
│   ├── dicom-ecg/              # ECG/Waveform viewer (NEW)
│   ├── ai/                     # AI inference results (NEW)
│   ├── collaboration/          # Real-time collaboration (NEW)
│   ├── tmtv/                   # Total Metabolic Tumor Volume
│   └── usAnnotation/           # Ultrasound B-line annotations
│
├── modes/
│   ├── longitudinal/           # Main viewer mode (measurement tracking)
│   ├── basic/                  # Base mode
│   ├── segmentation/           # Segmentation workflow
│   ├── tmtv/                   # PET/CT fusion
│   ├── microscopy/             # Whole Slide Imaging
│   ├── preclinical-4d/         # Dynamic volume 4D
│   └── usAnnotation/           # Ultrasound annotation mode
│
├── platform/
│   ├── app/                    # Main application (React, routing, config)
│   ├── core/                   # Services, managers, types, RemoteExtensionLoader
│   ├── ui/                     # Legacy UI components
│   ├── ui-next/                # Modern UI (shadcn/Tailwind) with ThemeWrapper
│   ├── i18n/                   # 14 languages (ES complete)
│   └── docs/                   # Documentation
│
├── vite.config.ts              # Vite dev config (NEW)
├── PLAN_MEJORAS.md             # Improvement plan document
└── CLAUDE.md                   # Architecture analysis
```

## Technologies

- **React 18** + TypeScript
- **Cornerstone.js 3D** (WebGL medical image rendering)
- **Zustand** (state management with devtools + persistence)
- **Tailwind CSS** + shadcn/ui (modern UI components)
- **Webpack 5** (production) / **Vite** (development)
- **Lerna** + Yarn workspaces (monorepo)

## Getting Started

### Requirements

- [Node.js 18+](https://nodejs.org/en/)
- [Yarn 1.20.0+](https://yarnpkg.com/en/docs/install)

### Installation

```bash
# Clone the repository
git clone https://github.com/rigoberto12r/ohif.git
cd ohif

# Install dependencies
yarn install --frozen-lockfile

# Start development server
yarn dev

# Or use Vite for faster development (experimental)
npx vite
```

### Build

```bash
# Production build
yarn build

# Development build
yarn build:dev
```

### Testing

```bash
# Unit tests
yarn test:unit

# E2E tests (Playwright)
yarn test:e2e
```

## Configuration

The viewer is configured via `platform/app/public/config/default.js`. Key options:

```javascript
window.config = {
  routerBasename: '/',
  showStudyList: true,
  maxNumberOfWebWorkers: 6,  // Dynamic hardware detection
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'orthanc',
      configuration: {
        friendlyName: 'Local Orthanc',
        wadoUriRoot: 'http://localhost/pacs/dicom-web',
        qidoRoot: 'http://localhost/pacs/dicom-web',
        wadoRoot: 'http://localhost/pacs/dicom-web',
      },
    },
  ],
  // White labeling (NEW)
  whiteLabeling: {
    appTitle: 'My Medical Viewer',
    logoUrl: '/custom-logo.svg',
    themePreset: 'radiology-dark', // 'clinical-light' | 'radiology-dark' | 'high-contrast'
  },
};
```

## Acknowledgments

> _Open Health Imaging Foundation Viewer: An Extensible Open-Source Framework
> for Building Web-Based Imaging Applications to Support Cancer Research_
>
> Erik Ziegler, Trinity Urban, Danny Brown, James Petts, Steve D. Pieper, Rob
> Lewis, Chris Hafey, and Gordon J. Harris
>
> _JCO Clinical Cancer Informatics_, no. 4 (2020), 336-345, DOI:
> [10.1200/CCI.19.00131](https://www.doi.org/10.1200/CCI.19.00131)

## License

MIT

<!--
  Links
  -->

<!-- prettier-ignore-start -->
[npm-url]: https://npmjs.org/package/@ohif/app
[npm-version-image]: https://img.shields.io/npm/v/@ohif/app.svg?style=flat-square
[license-image]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square
[license-url]: LICENSE
<!-- prettier-ignore-end -->
