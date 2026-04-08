# Plan de Mejoras - OHIF Viewer v3.12.0

## Resumen Ejecutivo

Plan de mejoras basado en un analisis profundo del codigo fuente de OHIF v3.12.0, cubriendo: rendimiento, UI/UX, accesibilidad, i18n, seguridad, nuevas funcionalidades y arquitectura.

---

## FASE 1 - QUICK WINS (Impacto Alto, Esfuerzo Bajo)

### 1.1 Rendimiento: Activar Code Splitting en Webpack
- **Archivo**: `.webpack/webpack.base.js` (linea 71)
- **Problema**: `splitChunks` esta comentado. Todo el codigo se empaqueta junto.
- **Solucion**: Descomentar y configurar splitChunks para vendor code y extensiones.
- **Impacto**: Reduccion ~20-30% del bundle inicial, mejor First Contentful Paint.

### 1.2 Rendimiento: Aumentar Web Workers por Defecto
- **Archivo**: `extensions/cornerstone/src/initWADOImageLoader.js`
- **Problema**: `maxNumberOfWebWorkers` fijado en 3 para todos los configs.
- **Solucion**: Subir a 4-6 por defecto; detectar capacidad del hardware automaticamente.
- **Impacto**: Decodificacion de imagenes mas rapida en hardware moderno.

### 1.3 Rendimiento: AbortController para Prefetch
- **Archivo**: `platform/core/src/services/StudyPrefetcherService/StudyPrefetcherService.ts` (TODO en lineas 49 y 125)
- **Problema**: Cuando el usuario cambia de serie, las peticiones de prefetch anteriores NO se cancelan.
- **Solucion**: Implementar AbortController para cancelar requests en vuelo al cambiar de serie.
- **Impacto**: Ahorro significativo de ancho de banda y recursos del navegador.

### 1.4 i18n: Completar Traducciones al Espanol
- **Directorio**: `platform/i18n/src/locales/es/`
- **Problema**: Faltan **20 de 34 archivos** de traduccion al espanol.
- **Archivos faltantes**:
  - CaptureViewportModal.json, Colormaps.json, DataSourceConfiguration.json
  - ErrorBoundary.json, HotkeysValidators.json, Hps.json, Messages.json
  - Modes.json, Onboarding.json, PanelSUV.json, ROIThresholdConfiguration.json
  - SegmentationPanel.json, StudyItem.json, ThumbnailTracked.json
  - ToolbarLayoutSelector.json, Tools.json, TooltipClipboard.json
  - TrackedCornerstoneViewport.json, USAnnotationPanel.json, WindowLevelActionMenu.json
- **Solucion**: Traducir los 20 archivos faltantes tomando como base en-US.
- **Impacto**: Cobertura completa del espanol (segundo idioma mas hablado).

---

## FASE 2 - SEGURIDAD Y ESTABILIDAD (Impacto Alto, Esfuerzo Medio)

### 2.1 Seguridad: Implementar UserAuthenticationService
- **Archivo**: `platform/core/src/services/UserAuthenticationService/UserAuthenticationService.ts`
- **Problema**: Todos los metodos son stubs con `console.warn`. No hay autenticacion real.
- **Solucion**: Implementar autenticacion completa con:
  - JWT token management con refresh automatico
  - Authorization headers en peticiones DICOMweb
  - Manejo de sesiones expiradas con redirect a login
  - Soporte para multiples providers (OIDC, SAML, custom)
- **Impacto**: Seguridad critica para despliegues en produccion.

### 2.2 Seguridad: Headers de Seguridad (CSP, X-Frame-Options)
- **Problema**: No hay Content-Security-Policy ni headers de seguridad en el codigo.
- **Solucion**: 
  - Agregar meta tag CSP en `platform/app/public/html-templates/index.html`
  - Configurar headers en los templates Docker/Nginx (`.docker/Viewer-v3.x/default.conf.template`)
  - Documentar configuracion recomendada de CORS
- **Impacto**: Prevencion de XSS, clickjacking y content injection.

### 2.3 Estabilidad: Limite de Cache de Viewports
- **Archivo**: `extensions/cornerstone/src/Viewport/OHIFCornerstoneViewport.tsx` (linea 24)
- **Problema**: `viewportDimensions` Map crece sin limite si se crean/destruyen muchos viewports.
- **Solucion**: Implementar LRU eviction o limite de tamano para el cache de dimensiones.
- **Impacto**: Prevencion de memory leaks en sesiones largas.

### 2.4 Estabilidad: Cache Service usa API Privada
- **Archivo**: `extensions/cornerstone/src/services/CornerstoneCacheService/CornerstoneCacheService.ts` (linea 118)
- **Problema**: Acceso directo a `cs3DCache._volumeCache.delete()` (API privada de Cornerstone).
- **Solucion**: Migrar a la API publica de Cornerstone para eviccion de cache.
- **Impacto**: Menor riesgo de breaking changes en actualizaciones de Cornerstone.

---

## FASE 3 - ACCESIBILIDAD (a11y) (Impacto Medio-Alto, Esfuerzo Medio)

### 3.1 Atributos ARIA en Componentes Clave
- **Componentes a mejorar**: Modal, Dialog, SidePanel, SegmentationTable, ToolButton
- **Problema**: Falta de aria-labels, roles, y manejo de foco consistente.
- **Solucion**:
  - Agregar `role="dialog"`, `aria-modal="true"`, `aria-labelledby` en Modal/Dialog
  - `aria-label` descriptivos en ToolButton
  - `role="navigation"` en SidePanel
  - `aria-expanded` en Accordion/collapsibles
- **Impacto**: Cumplimiento WCAG 2.1 nivel AA.

### 3.2 Navegacion por Teclado
- **Problema**: No todos los componentes interactivos son accesibles via teclado.
- **Solucion**:
  - Focus trapping en modales y dialogs
  - Tab order logico en toolbar y paneles
  - Atajos de teclado documentados y configurables
  - Skip links para navegacion rapida
- **Impacto**: Usabilidad para personas con discapacidad motora.

### 3.3 Contraste y Legibilidad
- **Archivo**: `platform/ui-next/src/components/ThemeWrapper/`
- **Solucion**:
  - Auditar ratios de contraste en modo oscuro (minimo 4.5:1 texto normal)
  - Agregar modo de alto contraste
  - Asegurar que iconos criticos tengan texto alternativo
- **Impacto**: Cumplimiento WCAG para vision reducida.

---

## FASE 4 - NUEVAS FUNCIONALIDADES (Impacto Alto, Esfuerzo Alto)

### 4.1 Soporte para Modalidades Waveform (ECG)
- **Archivos**: `platform/core/src/utils/sopClassDictionary.js` (ya definidos, lineas 26-34)
- **Problema**: UIDs para ECG (12-Lead, General, Ambulatory) estan definidos pero NO hay handler ni viewport.
- **Solucion**:
  - Crear `extension-dicom-ecg/` nueva extension
  - Implementar SOP Class Handler para waveform SOP classes
  - Crear viewport con renderizado de senales ECG (canvas/SVG)
  - Integrar con LineChart de ui-next como base
- **Impacto**: Soporte para cardiologia, uno de los flujos clinicos mas demandados.

### 4.2 Integracion con IA/ML (Extension de AI)
- **Problema**: No hay soporte nativo para inferencia de modelos de IA.
- **Solucion**:
  - Crear `extension-ai/` con:
    - Panel de resultados de IA (hallazgos, probabilidades)
    - Overlay de heatmaps de atencion sobre imagenes
    - Integracion con APIs de inferencia (MONAI, ONNX Runtime Web)
    - Soporte para DICOM AI Results IOD
  - Registrar como extension opcional en pluginConfig.json
- **Impacto**: Habilitador para radiologia asistida por IA.

### 4.3 Modo de Colaboracion en Tiempo Real
- **Problema**: No hay soporte para sesiones colaborativas.
- **Solucion**:
  - Crear `extension-collaboration/` con:
    - WebSocket/WebRTC para sincronizacion de estado
    - Cursores compartidos en viewports
    - Anotaciones colaborativas en tiempo real
    - Chat integrado con referencia a imagenes
  - Integrar con UserAuthenticationService para permisos
- **Impacto**: Teleradiologia y consultas remotas.

### 4.4 Exportacion Avanzada de Reportes
- **Problema**: Exportacion limitada a DICOM SR.
- **Solucion**:
  - Agregar exportacion a PDF con imagenes anotadas
  - Exportacion a HL7 FHIR DiagnosticReport
  - Templates de reportes personalizables
  - Generacion de reportes estructurados con datos de mediciones
- **Impacto**: Integracion con sistemas de informacion hospitalaria (HIS/RIS).

### 4.5 Modo Offline / PWA Completo
- **Archivo**: `.webpack/webpack.pwa.js` (ya tiene soporte basico Workbox)
- **Problema**: PWA esta configurado pero no hay estrategia offline completa.
- **Solucion**:
  - Cache de estudios frecuentes en IndexedDB
  - Service worker con estrategia stale-while-revalidate para imagenes
  - UI para gestionar estudios descargados
  - Sincronizacion de anotaciones al reconectar
- **Impacto**: Uso en entornos con conectividad limitada (rural, ambulancias).

---

## FASE 5 - MEJORAS DE ARQUITECTURA (Esfuerzo Alto, Impacto a Largo Plazo)

### 5.1 Lazy Loading de Extensiones
- **Problema**: Extensiones se cargan eagerly aunque no se usen en el modo actual.
- **Solucion**:
  - Aplicar React.lazy() a todas las extensiones (como ya hace OHIFCornerstoneViewport)
  - Webpack dynamic imports por extension
  - Carga bajo demanda cuando el modo las necesita
  - Estandarizar `sideEffects` en package.json de cada extension
- **Impacto**: Reduccion significativa del tiempo de carga inicial.

### 5.2 Migracion a Vite
- **Problema**: Webpack 5 tiene tiempos de build lentos en desarrollo.
- **Solucion**:
  - Migrar de Webpack a Vite para desarrollo
  - Mantener Webpack para produccion si es necesario
  - Aprovechar HMR nativo de Vite
- **Impacto**: DX mejorada, hot reload <1 segundo.

### 5.3 Sistema de Plugins Remoto
- **Problema**: Extensiones deben estar en el monorepo o instaladas via npm.
- **Solucion**:
  - Soporte para cargar extensiones desde URLs remotas
  - Module Federation (Webpack 5) o Import Maps
  - Registry de extensiones con versionado
  - Sandbox de seguridad para plugins de terceros
- **Impacto**: Ecosistema de extensiones de terceros sin recompilar.

### 5.4 Mejora del Sistema de Estado (Zustand)
- **Problema**: Stores distribuidos entre extensiones sin patron unificado.
- **Solucion**:
  - Centralizar store definitions
  - Implementar middleware de persistencia (localStorage/IndexedDB)
  - DevTools integration para debugging
  - Estado undo/redo global para mediciones y anotaciones
- **Impacto**: Mejor mantenibilidad y debugging.

---

## FASE 6 - UI/UX (Impacto Medio, Esfuerzo Medio)

### 6.1 Responsive Design / Mobile
- **Problema**: El visor esta disenado para desktop; no hay layout mobile.
- **Solucion**:
  - Layout adaptativo para tablet (viewport unico con gestos)
  - Touch gestures (pinch-to-zoom, swipe para scroll)
  - Toolbar colapsable para pantallas pequenas
  - Panel de series como drawer inferior
- **Impacto**: Uso en tablets en quirofano o rondas clinicas.

### 6.2 Mejora del Onboarding
- **Archivo**: `platform/ui-next/src/components/Onboarding/`
- **Solucion**:
  - Tours guiados por modo clinico
  - Tooltips contextuales para herramientas
  - Videos embebidos de entrenamiento
  - Progreso de onboarding persistente por usuario
- **Impacto**: Curva de aprendizaje mas corta para nuevos usuarios.

### 6.3 Temas y White Labeling Avanzado
- **Archivo**: `platform/app/public/config/default.js` (`whiteLabeling` config)
- **Solucion**:
  - Editor visual de temas (colores, tipografia, logos)
  - Presets de tema: Clinico (claro), Radiologia (oscuro), Alto Contraste
  - Custom CSS injection via configuracion
  - Favicon y titulo dinamicos desde config
- **Impacto**: Personalizacion para diferentes instituciones.

---

## Prioridad y Cronograma Sugerido

| Fase | Nombre | Prioridad | Items |
|------|--------|-----------|-------|
| **1** | Quick Wins | CRITICA | 1.1, 1.2, 1.3, 1.4 |
| **2** | Seguridad y Estabilidad | CRITICA | 2.1, 2.2, 2.3, 2.4 |
| **3** | Accesibilidad | ALTA | 3.1, 3.2, 3.3 |
| **4** | Nuevas Funcionalidades | ALTA | 4.1, 4.2, 4.3, 4.4, 4.5 |
| **5** | Arquitectura | MEDIA | 5.1, 5.2, 5.3, 5.4 |
| **6** | UI/UX | MEDIA | 6.1, 6.2, 6.3 |

---

## Metricas de Exito

| Metrica | Actual (estimado) | Objetivo |
|---------|-------------------|----------|
| Bundle size inicial | ~5-8 MB | < 3 MB |
| First Contentful Paint | ~3-5s | < 2s |
| Cobertura i18n espanol | 41% (14/34) | 100% |
| WCAG compliance | Parcial | AA completo |
| Modalidades soportadas | ~25 SOP classes | ~35 SOP classes |
| Web Workers | 3 fijos | 4-6 dinamicos |
