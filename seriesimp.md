# Walkthrough — Integración de Series DICOM

## Resumen

Se integró la tabla `[MIGlobal].[dbo].[series]` al sistema visor-dicom, permitiendo navegar estudios por series con información de parte del cuerpo, modalidad y otros metadatos clínicos.

## Archivos Creados

### [Series.js](file:///c:/Users/Informática/OneDrive%20-%20I%20MUNICIPALIDAD%20DE%20TEMUCO/Documentos/proyectos/visor-dicom/models/Series.js) (NUEVO)
Modelo Sequelize que mapea los 20 campos de la tabla `series`:
- `Series_Inc_ID` → PK
- `Study_inc_ID_det` → FK al estudio
- `Series_Patient_ID` → STRING (RUT del paciente)
- `Series_Directory` → Ruta absoluta al directorio de archivos DICOM
- Campos clave: `Body_Part`, `Modality`, `procedure_name`, `Contrast`, `View_Position`

## Archivos Modificados

### [index.js](file:///c:/Users/Informática/OneDrive%20-%20I%20MUNICIPALIDAD%20DE%20TEMUCO/Documentos/proyectos/visor-dicom/models/index.js)
- Importa y exporta `Series`
- Asociación `Study.hasMany(Series)` / `Series.belongsTo(Study)`

### [dicomService.js](file:///c:/Users/Informática/OneDrive%20-%20I%20MUNICIPALIDAD%20DE%20TEMUCO/Documentos/proyectos/visor-dicom/services/dicomService.js)
- `getSeriesByStudyId(studyId)` — Lista series ordenadas por número
- `getSeriesById(seriesId)` — Busca serie por ID
- `getStudyWithPatient()` ahora incluye Series en el eager loading

### [dicomController.js](file:///c:/Users/Informática/OneDrive%20-%20I%20MUNICIPALIDAD%20DE%20TEMUCO/Documentos/proyectos/visor-dicom/controllers/dicomController.js)
3 nuevos endpoints:
- `listStudySeries` — JSON con series de un estudio
- `listSeriesFiles` — Archivos DICOM de una serie (usa `Series_Directory`)
- `serveSeriesDicom` — Sirve un archivo DICOM individual de una serie
- `viewDicom` actualizado para pasar series al template

### [dicomRoutes.js](file:///c:/Users/Informática/OneDrive%20-%20I%20MUNICIPALIDAD%20DE%20TEMUCO/Documentos/proyectos/visor-dicom/routes/dicomRoutes.js)
3 nuevas rutas:
```
GET /dicom/series/:studyId
GET /dicom/series/:studyId/:seriesId/archivos
GET /dicom/series/:studyId/:seriesId/archivos/:filename
```

### [dashboardService.js](file:///c:/Users/Informática/OneDrive%20-%20I%20MUNICIPALIDAD%20DE%20TEMUCO/Documentos/proyectos/visor-dicom/services/dashboardService.js)
- Eager loading de Series en estudios recientes y búsqueda de pacientes

### [dashboard.ejs](file:///c:/Users/Informática/OneDrive%20-%20I%20MUNICIPALIDAD%20DE%20TEMUCO/Documentos/proyectos/visor-dicom/views/dashboard.ejs)
- Nueva columna **Parte del Cuerpo** con badges `bg-warning` por cada body part único
- Nueva columna **Series** con contador badge

### [viewer.ejs](file:///c:/Users/Informática/OneDrive%20-%20I%20MUNICIPALIDAD%20DE%20TEMUCO/Documentos/proyectos/visor-dicom/views/viewer.ejs)
Rediseño completo del sidebar con 3 paneles:
1. **Metadatos** — Info DICOM del header + metadatos de la serie activa (bodyPart, modalidad, procedimiento, contraste, equipo, vista)
2. **Series** — Tarjetas clickeables por serie con bodyPart destacado, badges de modalidad y vista
3. **Imágenes** — Thumbnails de la serie seleccionada

**Fallback**: Si un estudio no tiene series en la BD, funciona en modo legacy cargando desde el directorio del estudio.

## Verificación Pendiente

- Iniciar el servidor con `npm run dev` y probar:
  1. Dashboard muestra columnas de "Parte del Cuerpo" y "Series"
  2. Al abrir un estudio con series, el visor muestra las tarjetas de series
  3. Click en una serie carga sus imágenes correctamente
  4. Estudios sin series siguen funcionando en modo legacy
