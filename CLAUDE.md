# OHIF Viewer v3.12.0 - Analisis Completo de Arquitectura

## Resumen General
OHIF (Open Health Imaging Foundation) Viewer es un visor de imagenes medicas DICOM basado en web, open-source. Version 3.12.0 (Feb 5, 2026). Monorepo gestionado con Lerna + Yarn workspaces.

## Estructura del Monorepo

```
/home/user/Ohif/
├── platform/          # Core del visor
│   ├── app/           # Aplicacion principal React (entry point, routing, bootstrap)
│   ├── core/          # Servicios centrales, managers, tipos, utilidades
│   ├── ui/            # Componentes UI legacy
│   ├── ui-next/       # Componentes UI modernos (shadcn/tailwind)
│   ├── i18n/          # Internacionalizacion
│   ├── cli/           # CLI para desarrollo
│   └── docs/          # Documentacion
├── extensions/        # Extensiones (funcionalidades modulares)
├── modes/             # Modos clinicos (configuraciones de layout/tools)
└── addOns/            # Complementos externos
```

## Comandos Principales
- `yarn dev` - Desarrollo local
- `yarn build` - Build produccion
- `yarn test:unit` - Tests unitarios
- `yarn test:e2e` - Tests E2E (Playwright)
- `yarn dev:orthanc` - Dev con Orthanc PACS

---

## PLATFORM

### platform/core (Servicios Centrales)
Archivo principal: `platform/core/src/index.ts`

**Managers:**
- `ExtensionManager` - Registra/gestiona extensiones y sus modulos
- `CommandsManager` - Ejecuta comandos registrados por extensiones
- `HotkeysManager` - Atajos de teclado
- `ServicesManager` - Contenedor central de todos los servicios
- `ServiceProvidersManager` - Proveedores React para servicios

**Servicios (platform/core/src/services/):**
| Servicio | Funcion |
|----------|---------|
| `CineService` | Reproduccion cine de imagenes |
| `CustomizationService` | Personalizacion de UI y comportamiento |
| `DicomMetadataStore` | Almacen de metadatos DICOM |
| `DisplaySetService` | Gestiona display sets (series/instancias agrupadas) |
| `HangingProtocolService` | Protocolos de colgado automatico |
| `MeasurementService` | Gestion de mediciones/anotaciones |
| `MultiMonitorService` | Soporte multi-monitor |
| `PanelService` | Gestiona paneles laterales |
| `ToolBarService` | Barra de herramientas y secciones |
| `UIDialogService` | Dialogos modales |
| `UIModalService` | Modales genericos |
| `UINotificationService` | Notificaciones/toasts |
| `UIViewportDialogService` | Dialogos sobre viewports |
| `UserAuthenticationService` | Autenticacion OpenID Connect |
| `ViewportGridService` | Grid de viewports (layouts) |
| `WorkflowStepsService` | Pasos de flujo de trabajo |
| `StudyPrefetcherService` | Pre-carga de estudios |

### platform/app (Aplicacion Principal)
Archivo principal: `platform/app/src/App.tsx`

- Bootstrap via `appInit.js` (inicializa managers y servicios)
- Routing con React Router v6
- Proveedores React compuestos via `Compose`
- Configuracion en `platform/app/public/config/default.js`
- Plugin config en `platform/app/pluginConfig.json`

**Configuracion (default.js) soporta:**
- `routerBasename` - Ruta base
- `dataSources` - Fuentes de datos DICOMweb (Orthanc, DCM4CHEE, AWS S3 static WADO, etc.)
- `showStudyList` - Mostrar lista de estudios
- `multimonitor` - Configuracion multi-pantalla
- `maxNumberOfWebWorkers` - Workers para decodificacion
- `whiteLabeling` - Logo y marca personalizada
- `customizationService` - Personalizaciones
- `segmentation` - Config de segmentacion
- `maxNumRequests` - Limites de requests HTTP

### platform/ui-next (Componentes UI Modernos)
Directorio: `platform/ui-next/src/components/`

**Componentes principales:**
- `Viewport` - Contenedor de viewport de imagenes
- `SidePanel` - Paneles laterales (izq/der)
- `Header` / `NavBar` - Cabecera y navegacion
- `StudyBrowser` / `StudyItem` / `StudySummary` - Navegador de estudios
- `Thumbnail` / `ThumbnailList` - Miniaturas de series
- `MeasurementTable` - Tabla de mediciones
- `SegmentationTable` - Tabla de segmentaciones
- `ToolButton` - Botones de herramientas
- `LayoutSelector` - Selector de layout de viewports
- `CinePlayer` - Reproductor cine
- `Modal` / `Dialog` - Modales y dialogos
- `OHIFToolbox` / `OHIFToolSettings` - Caja de herramientas
- `Accordion` / `Tabs` / `PanelSection` - Layout de paneles
- `ContextMenu` / `DropdownMenu` - Menus contextuales
- `Slider` / `DoubleSlider` - Controles deslizantes
- `Colorbar` (via `AllInOneMenu`) - Barra de color
- `Icons` - Iconografia del visor
- `Onboarding` - Tutorial/guia de usuario
- `InvestigationalUseDialog` - Dialogo de uso investigacional
- `LoadingIndicatorProgress` / `LoadingIndicatorTotalPercent` - Indicadores de carga
- `ViewportDialog` - Dialogos en viewport
- `ThemeWrapper` - Wrapper de tema oscuro/claro

---

## EXTENSIONES

Directorio: `/home/user/Ohif/extensions/`

### extension-default
Archivo: `extensions/default/src/index.ts`
La extension base. Proporciona:
- **DataSources**: DICOMweb, DICOM JSON, DICOM Local, DICOMweb Proxy
- **Layout Template**: `viewerLayout` (layout principal del visor)
- **Panels**: `seriesList` (lista de series/thumbnails)
- **Hanging Protocols**: Protocolo por defecto
- **SOP Class Handlers**: Stack handler para imagenes basicas
- **Commands**: Comandos genericos (exportar, guardar, navegar)
- **Toolbar**: Barra de herramientas base
- **Customization**: Modulo de personalizacion
- **Stores Zustand**: viewportGrid, UIState, displaySetSelector, hangingProtocolStageIndex, toggleOneUpViewportGrid, viewportsByPosition
- **Utils**: Toolbox, MoreDropdownMenu, callInputDialog, colorPickerDialog, promptSaveReport, promptLabelAnnotation

### extension-cornerstone
Archivo: `extensions/cornerstone/src/index.tsx`
Extension central de renderizado. Proporciona:
- **Viewport**: `OHIFCornerstoneViewport` (renderizado de imagenes con Cornerstone.js)
- **Servicios propios**:
  - `ToolGroupService` - Grupos de herramientas
  - `SyncGroupService` - Sincronizacion entre viewports
  - `SegmentationService` - Segmentaciones
  - `CornerstoneCacheService` - Cache de imagenes
  - `CornerstoneViewportService` - Gestion de viewports
  - `ColorbarService` - Barra de color
- **Panels**:
  - `panelMeasurement` - Panel de mediciones
  - `panelSegmentation` - Panel de segmentaciones
  - `panelSegmentationWithToolsLabelMap` - Segmentacion con tools LabelMap
  - `panelSegmentationWithToolsContour` - Segmentacion con tools Contorno
- **Commands**: Manipulacion de imagenes, mediciones, segmentaciones
- **Tools**: WindowLevel, Pan, Zoom, Crosshairs, etc. + ImageOverlayViewerTool
- **Hooks**: useMeasurements, useSegmentations, useMeasurementTracking, useActiveViewportSegmentationRepresentations
- **Stores**: lutPresentation, positionPresentation, segmentationPresentation, synchronizers, selectedSegmentationsForViewport

### extension-measurement-tracking
Archivo: `extensions/measurement-tracking/`
Tracking de mediciones a lo largo del tiempo (longitudinal). Proporciona:
- **Panel**: `trackedMeasurements` (panel con tracking temporal)
- **Panel**: `seriesList` (lista de series con tracking)
- **Viewport**: `cornerstone-tracked` (viewport con tracking integrado)

### extension-cornerstone-dicom-sr
Archivo: `extensions/cornerstone-dicom-sr/`
Soporte para DICOM Structured Reports (SR):
- **SOP Class Handler**: Lectura de SR y SR 3D
- **Viewport**: Visualizacion de SR

### extension-cornerstone-dicom-seg
Archivo: `extensions/cornerstone-dicom-seg/`
Soporte para DICOM Segmentation:
- **SOP Class Handler**: Lectura de segmentaciones DICOM
- **Viewport**: Visualizacion de segmentaciones

### extension-cornerstone-dicom-pmap
Archivo: `extensions/cornerstone-dicom-pmap/`
Soporte para DICOM Parametric Maps (PMAP)

### extension-cornerstone-dicom-rt
Archivo: `extensions/cornerstone-dicom-rt/`
Soporte para DICOM RT (radioterapia): RT Structure Set, RT Dose

### extension-cornerstone-dynamic-volume
Archivo: `extensions/cornerstone-dynamic-volume/`
Soporte para volumenes dinamicos (4D)

### extension-dicom-microscopy
Archivo: `extensions/dicom-microscopy/`
Soporte para microscopia digital (Whole Slide Imaging)

### extension-dicom-pdf
Archivo: `extensions/dicom-pdf/`
Visualizacion de PDFs encapsulados en DICOM

### extension-dicom-video
Archivo: `extensions/dicom-video/`
Visualizacion de videos DICOM

### extension-tmtv
Archivo: `extensions/tmtv/`
Total Metabolic Tumor Volume (PET/CT)

### extension-usAnnotation
Archivo: `extensions/usAnnotation/`
Anotaciones de ultrasonido (pleura B-line)

### extension-test
Archivo: `extensions/test-extension/`
Extension de pruebas/desarrollo

---

## MODOS CLINICOS

Directorio: `/home/user/Ohif/modes/`

### mode-basic (`modes/basic/`)
Modo base del que heredan otros modos. Define:
- Layout: viewerLayout con panel izquierdo (thumbnails) y derecho (mediciones + segmentacion)
- Tools: WindowLevel, Pan, Zoom, Length, Bidirectional, ArrowAnnotate, EllipticalROI, etc.
- SOP Class Handlers: stack, video, pdf, SR, SEG, PMAP, RT
- Secciones de toolbar configurables

### mode-longitudinal (`modes/longitudinal/`)
Hereda de basic. Agrega:
- Tracking de mediciones en el tiempo
- Panel izquierdo: `trackedMeasurements.seriesList`
- Panel derecho: `segmentation` + `trackedMeasurements`
- Viewport: `cornerstone-tracked`
- Ruta: `/viewer` (modo principal por defecto)

### mode-segmentation (`modes/segmentation/`)
Modo dedicado a segmentacion. Agrega:
- Tools: LabelMap tools + Contour tools
- Panel de segmentacion con toolbox
- Tools: Brush, Eraser, Scissors, ThresholdBrush, etc.
- Toolbar: WindowLevel, Pan, Zoom, TrackballRotate, Capture, Layout, Crosshairs, MoreTools
- Auto-switch de pestanas entre LabelMap/Contour

### mode-tmtv (`modes/tmtv/`)
Total Metabolic Tumor Volume para PET/CT:
- Layout especial para fusion PET/CT
- Herramientas de calculo de SUV
- Segmentacion basada en umbral

### mode-microscopy (`modes/microscopy/`)
Microscopia digital / Whole Slide Imaging

### mode-preclinical-4d (`modes/preclinical-4d/`)
Volumenes dinamicos 4D (precliniico)

### mode-basic-dev-mode (`modes/basic-dev-mode/`)
Modo de desarrollo con herramientas de debug

### mode-basic-test-mode (`modes/basic-test-mode/`)
Modo para testing E2E

### mode-usAnnotation
Modo para anotaciones de ultrasonido (pleura B-line)

---

## ARQUITECTURA DE DATOS

### Data Sources (Fuentes de Datos)
Configuradas en `default.js`. Tipos soportados:
1. **DICOMweb** - Protocolo estandar (Orthanc, DCM4CHEE, Google Cloud Healthcare, AWS)
2. **DICOM JSON** - Archivos JSON con metadatos DICOM
3. **DICOM Local** - Archivos DICOM locales (drag & drop)
4. **DICOMweb Proxy** - Proxy delegante

### Flujo de Datos
1. `DataSource` obtiene metadatos via QIDO-RS
2. `DicomMetadataStore` almacena metadatos
3. `DisplaySetService` crea DisplaySets (agrupaciones logicas)
4. `HangingProtocolService` decide layout segun protocolo
5. `ViewportGridService` distribuye DisplaySets en viewports
6. Cornerstone.js renderiza las imagenes

---

## TECNOLOGIAS CLAVE
- **React 18** + TypeScript
- **Cornerstone.js 3D** (renderizado medico, WebGL)
- **cornerstoneTools** (herramientas de medicion/anotacion)
- **Zustand** (estado global via stores)
- **Tailwind CSS** + shadcn/ui (UI components en ui-next)
- **Webpack 5** (bundler)
- **Lerna** + Yarn workspaces (monorepo)
- **React Router v6** (routing)
- **i18next** (internacionalizacion)
- **dcmjs** (parsing DICOM)

---

## SISTEMA DE EXTENSIONES
Las extensiones registran modulos via metodos `get*Module()`:
- `getViewportModule` - Viewports personalizados
- `getPanelModule` - Paneles laterales
- `getToolbarModule` - Botones/secciones de toolbar
- `getCommandsModule` - Comandos ejecutables
- `getSopClassHandlerModule` - Handlers para SOP Classes DICOM
- `getDataSourcesModule` - Fuentes de datos
- `getHangingProtocolModule` - Protocolos de colgado
- `getLayoutTemplateModule` - Templates de layout
- `getCustomizationModule` - Personalizaciones
- `getUtilityModule` - Utilidades compartidas

Los modos seleccionan que extensiones y modulos usar, y definen el layout y tools disponibles.

---

## CONFIGURACION DE PLUGINS
Archivo: `platform/app/pluginConfig.json`

### Extensiones registradas:
1. @ohif/extension-default
2. @ohif/extension-cornerstone
3. @ohif/extension-measurement-tracking
4. @ohif/extension-cornerstone-dicom-sr
5. @ohif/extension-cornerstone-dicom-seg
6. @ohif/extension-cornerstone-dicom-pmap
7. @ohif/extension-cornerstone-dynamic-volume
8. @ohif/extension-dicom-microscopy
9. @ohif/extension-dicom-pdf
10. @ohif/extension-dicom-video
11. @ohif/extension-tmtv
12. @ohif/extension-test
13. @ohif/extension-cornerstone-dicom-rt
14. @ohif/extension-ultrasound-pleura-bline

### Modos registrados:
1. @ohif/mode-longitudinal (visor principal)
2. @ohif/mode-basic
3. @ohif/mode-segmentation
4. @ohif/mode-tmtv
5. @ohif/mode-microscopy
6. @ohif/mode-preclinical-4d
7. @ohif/mode-test
8. @ohif/mode-basic-dev-mode
9. @ohif/mode-ultrasound-pleura-bline
