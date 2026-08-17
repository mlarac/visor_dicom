import {
  init as initCornerstone,
  RenderingEngine,
  Enums as coreEnums,
  imageLoader,
  metaData,
  getWebWorkerManager
} from '@cornerstonejs/core';

import {
  init as initCornerstoneTools,
  addTool,
  ToolGroupManager,
  Enums as toolEnums,
  WindowLevelTool,
  ZoomTool,
  PanTool,
  LengthTool,
  StackScrollTool
} from '@cornerstonejs/tools';

import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';

// Constantes de identificación
const RENDERING_ENGINE_ID = 'dicomRenderingEngine';
const VIEWPORT_ID = 'dicomStackViewport';
const TOOL_GROUP_ID = 'dicomToolGroup';

let renderingEngine = null;
let toolGroup = null;
let currentStack = { currentImageIdIndex: 0, imageIds: [] };
let activeThumbnails = [];
let isInitialized = false;

/**
 * Inicializa Cornerstone3D, CornerstoneTools y DicomImageLoader
 */
async function initializeVisor() {
  if (isInitialized) return;

  try {
    console.log('[Visor DICOM] Inicializando Cornerstone3D y Tools...');
    // 1. Inicializar Core y Tools
    await initCornerstone();
    await initCornerstoneTools();

    // 2. Inicializar DICOM Image Loader
    cornerstoneDICOMImageLoader.init({
      maxWebWorkers: 2,
      decodeConfig: {
        wasmBasePath: '/js'
      }
    });

    // Registrar explícitamente el Web Worker compilado
    try {
      const workerManager = getWebWorkerManager();
      const customWorkerFn = () => {
        return new Worker('/js/decodeImageFrameWorker.js', { type: 'module' });
      };
      workerManager.registerWorker('dicomImageLoader', customWorkerFn, {
        maxWorkerInstances: 2,
        overwrite: true
      });
      console.log('[Visor DICOM] Web Worker de decodificación registrado en /js/decodeImageFrameWorker.js');
    } catch (workerErr) {
      console.warn('[Visor DICOM] Aviso al registrar Worker:', workerErr);
    }

    // 3. Registrar herramientas globalmente
    addTool(WindowLevelTool);
    addTool(ZoomTool);
    addTool(PanTool);
    addTool(LengthTool);
    addTool(StackScrollTool);

    // 4. Crear ToolGroup
    toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID);
    toolGroup.addTool(WindowLevelTool.toolName);
    toolGroup.addTool(ZoomTool.toolName);
    toolGroup.addTool(PanTool.toolName);
    toolGroup.addTool(LengthTool.toolName);
    toolGroup.addTool(StackScrollTool.toolName);

    // Configuración inicial de herramientas
    toolGroup.setToolActive(WindowLevelTool.toolName, {
      bindings: [{ mouseButton: toolEnums.MouseBindings.Primary }]
    });
    toolGroup.setToolActive(ZoomTool.toolName, {
      bindings: [{ mouseButton: toolEnums.MouseBindings.Secondary }]
    });
    toolGroup.setToolActive(PanTool.toolName, {
      bindings: [{ mouseButton: toolEnums.MouseBindings.Auxiliary }]
    });
    toolGroup.setToolActive(StackScrollTool.toolName, {
      bindings: [{ mouseButton: toolEnums.MouseBindings.Wheel }]
    });

    // 5. Configurar RenderingEngine y Viewport
    const element = document.getElementById('dicomImage');
    if (!element) {
      console.error('[Visor DICOM] No se encontró el elemento #dicomImage');
      return;
    }

    renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID);
    const viewportInput = {
      viewportId: VIEWPORT_ID,
      type: coreEnums.ViewportType.STACK,
      element: element,
      defaultOptions: {
        background: [0, 0, 0]
      }
    };

    renderingEngine.enableElement(viewportInput);
    toolGroup.addViewport(VIEWPORT_ID, RENDERING_ENGINE_ID);

    isInitialized = true;
    console.log('[Visor DICOM] Cornerstone3D inicializado con éxito');
  } catch (err) {
    console.error('[Visor DICOM] Error fatal al inicializar Cornerstone3D:', err);
  }
}

/**
 * Cambia la herramienta activa para el clic primario (botón izquierdo)
 */
function setLeftClickTool(toolName) {
  if (!toolGroup) return;

  // Desactivar herramientas primarias previas
  [WindowLevelTool.toolName, ZoomTool.toolName, PanTool.toolName, LengthTool.toolName].forEach(t => {
    toolGroup.setToolPassive(t);
  });

  // Mantener accesos directos secundarios / auxiliares
  toolGroup.setToolActive(ZoomTool.toolName, {
    bindings: [{ mouseButton: toolEnums.MouseBindings.Secondary }]
  });
  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: toolEnums.MouseBindings.Auxiliary }]
  });

  // Activar la seleccionada para el clic izquierdo
  toolGroup.setToolActive(toolName, {
    bindings: [{ mouseButton: toolEnums.MouseBindings.Primary }]
  });

  // Actualizar estado visual de los botones en la barra de herramientas
  const toolButtons = [
    { id: 'btnWwwc', name: WindowLevelTool.toolName },
    { id: 'btnZoom', name: ZoomTool.toolName },
    { id: 'btnPan', name: PanTool.toolName },
    { id: 'btnLength', name: LengthTool.toolName }
  ];

  toolButtons.forEach(btn => {
    const el = document.getElementById(btn.id);
    if (el) {
      if (btn.name === toolName) {
        el.classList.remove('btn-dark');
        el.classList.add('btn-primary');
      } else {
        el.classList.remove('btn-primary');
        el.classList.add('btn-dark');
      }
    }
  });
}

/**
 * Muestra los metadatos de la serie activa
 */
function showSeriesMetadata(seriesInfo) {
  const metaDiv = document.getElementById('seriesMetadata');
  if (!metaDiv) return;
  if (!seriesInfo) {
    metaDiv.innerHTML = '';
    return;
  }
  const entries = [
    { label: 'Parte del Cuerpo', value: seriesInfo.bodyPart, icon: 'bi-person-standing' },
    { label: 'Modalidad', value: seriesInfo.modality, icon: 'bi-display' },
    { label: 'Procedimiento', value: seriesInfo.procedureName, icon: 'bi-clipboard2-pulse' },
    { label: 'Descripción', value: seriesInfo.description, icon: 'bi-card-text' },
    { label: 'Contraste', value: seriesInfo.contrast, icon: 'bi-droplet-half' },
    { label: 'Equipo', value: seriesInfo.machine, icon: 'bi-cpu' },
    { label: 'Vista', value: seriesInfo.viewPosition, icon: 'bi-aspect-ratio' }
  ].filter(e => e.value && String(e.value).trim() !== '');

  if (entries.length === 0) {
    metaDiv.innerHTML = '';
    return;
  }

  metaDiv.innerHTML = entries.map(e => `
    <div class="mb-1">
      <span class="meta-label"><i class="bi ${e.icon} me-1"></i>${e.label}</span><br>
      <span class="meta-value">${e.value}</span>
    </div>
  `).join('');
}

/**
 * Limpia los thumbnails del sidebar
 */
function clearThumbnails() {
  activeThumbnails = [];
  const container = document.getElementById('thumbnailContainer');
  if (container) container.innerHTML = '';
}

/**
 * Carga las imágenes de una serie en el StackViewport
 */
async function loadImagesFromUrl(filesUrl, imageBaseUrl, seriesInfo) {
  const loaderInfo = document.getElementById('loaderInfo');
  if (loaderInfo) {
    loaderInfo.style.display = '';
    const p = loaderInfo.querySelector('p');
    if (p) p.textContent = 'Cargando imágenes de la serie...';
  }

  clearThumbnails();
  showSeriesMetadata(seriesInfo);

  try {
    const response = await fetch(filesUrl);
    const data = await response.json();

    if (!data.files || data.files.length === 0) {
      throw new Error('No se encontraron imágenes en esta serie.');
    }

    const imageCountEl = document.getElementById('imageCount');
    if (imageCountEl) imageCountEl.textContent = data.files.length;

    // Crear URIs absolutas para wadouri
    const origin = window.location.origin;
    const imageIds = data.files.map(filename => 'wadouri:' + origin + imageBaseUrl + '/' + encodeURIComponent(filename));

    currentStack = {
      currentImageIdIndex: 0,
      imageIds: imageIds
    };

    console.log('[Visor DICOM] Cargando Stack con', imageIds.length, 'imágenes en Cornerstone3D:', imageIds[0]);

    const viewport = renderingEngine.getViewport(VIEWPORT_ID);
    if (!viewport) {
      throw new Error('No se encontró el StackViewport de Cornerstone3D');
    }

    await viewport.setStack(imageIds, 0);
    viewport.resetCamera();
    viewport.render();

    if (loaderInfo) loaderInfo.style.display = 'none';

    // Cargar metadatos DICOM de la primera imagen
    imageLoader.loadAndCacheImage(imageIds[0]).then(image => {
      const patientModule = metaData.get('patientModule', imageIds[0]) || {};
      const generalStudyModule = metaData.get('generalStudyModule', imageIds[0]) || {};
      const generalSeriesModule = metaData.get('generalSeriesModule', imageIds[0]) || {};

      // Obtener valores con fallback a módulos y dataset
      const rawData = image?.data || {};
      const patientName = patientModule.patientName || rawData['x00100010'] || (rawData.string && rawData.string('x00100010')) || 'Desconocido';
      const patientId = patientModule.patientId || rawData['x00100020'] || (rawData.string && rawData.string('x00100020')) || 'N/A';
      const studyDate = generalStudyModule.studyDate || rawData['x00080020'] || (rawData.string && rawData.string('x00080020')) || 'Desconocida';
      const modality = generalSeriesModule.modality || rawData['x00080060'] || (rawData.string && rawData.string('x00080060')) || 'N/A';

      const dicomMetaEl = document.getElementById('dicomMetadata');
      if (dicomMetaEl) {
        dicomMetaEl.innerHTML = `
          <p class="mb-1"><strong>Paciente:</strong> <br> ${patientName}</p>
          <p class="mb-1"><strong>ID Paciente:</strong> ${patientId}</p>
          <p class="mb-1"><strong>Fecha Estudio:</strong> ${studyDate}</p>
          <p class="mb-1"><strong>Modalidad:</strong> ${modality}</p>
        `;
      }
    }).catch(err => console.warn('[Visor DICOM] Aviso al leer metadatos de cabecera:', err));

    // Renderizar lista de miniaturas en el sidebar
    const thumbContainer = document.getElementById('thumbnailContainer');
    imageIds.forEach((id, index) => {
      const thumbWrapper = document.createElement('div');
      thumbWrapper.style.position = 'relative';

      const thumbDiv = document.createElement('div');
      thumbDiv.className = 'thumbnail-box d-flex align-items-center justify-content-center text-secondary small' + (index === 0 ? ' active-thumb' : '');
      thumbDiv.dataset.index = index;
      thumbDiv.innerHTML = `<i class="bi bi-file-earmark-medical fs-2"></i>`;

      const label = document.createElement('span');
      label.textContent = (index + 1).toString();
      label.className = 'badge bg-dark position-absolute bottom-0 end-0 m-1';

      thumbWrapper.appendChild(thumbDiv);
      thumbWrapper.appendChild(label);
      thumbContainer.appendChild(thumbWrapper);
      activeThumbnails.push(thumbDiv);

      thumbDiv.addEventListener('click', async () => {
        document.querySelectorAll('.thumbnail-box').forEach(tb => tb.classList.remove('active-thumb'));
        thumbDiv.classList.add('active-thumb');

        currentStack.currentImageIdIndex = index;
        await viewport.setImageIdIndex(index);
        viewport.render();
      });
    });

  } catch (err) {
    console.error('[Visor DICOM] Error cargando archivos:', err);
    if (loaderInfo) {
      loaderInfo.innerHTML = `
        <div class="text-danger text-center bg-dark p-4 rounded border border-danger">
          <i class="bi bi-exclamation-triangle fs-1"></i>
          <h5 class="mt-3">Error al cargar la serie DICOM</h5>
          <p class="text-secondary">Asegúrate de que el directorio exista y contenga archivos .dcm válidos.</p>
          <div class="alert alert-danger mt-3 text-start bg-black border-secondary">
            <code>${err.message || err.toString()}</code>
          </div>
        </div>
      `;
    }
  }
}

/**
 * Renderiza la lista de series en el sidebar
 */
function renderSeriesList(seriesData, studyId) {
  const container = document.getElementById('seriesListBody');
  const countEl = document.getElementById('seriesCount');
  if (countEl) countEl.textContent = seriesData.length;
  if (!container) return;
  container.innerHTML = '';

  seriesData.forEach((s, index) => {
    const card = document.createElement('div');
    card.className = 'series-card' + (index === 0 ? ' active' : '');
    card.dataset.seriesId = s.id;

    const bodyPartText = s.bodyPart || 'Sin especificar';
    const modalityBadge = s.modality ? `<span class="badge bg-info text-dark series-modality-badge">${s.modality}</span>` : '';
    const viewBadge = s.viewPosition ? `<span class="badge bg-secondary series-modality-badge ms-1">${s.viewPosition}</span>` : '';
    const descText = s.description || s.procedureName || '';

    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <span class="series-number">Serie #${s.seriesNumber || (index + 1)}</span>
        <div>${modalityBadge}${viewBadge}</div>
      </div>
      <div class="series-body-part"><i class="bi bi-activity me-1"></i>${bodyPartText}</div>
      ${descText ? `<div class="series-desc">${descText}</div>` : ''}
    `;

    card.addEventListener('click', () => {
      container.querySelectorAll('.series-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const filesUrl = `/dicom/series/${studyId}/${s.id}/archivos`;
      const imageBaseUrl = `/dicom/series/${studyId}/${s.id}/archivos`;
      loadImagesFromUrl(filesUrl, imageBaseUrl, s);
    });

    container.appendChild(card);
  });

  // Auto-cargar primera serie
  if (seriesData.length > 0) {
    const firstSeries = seriesData[0];
    const filesUrl = `/dicom/series/${studyId}/${firstSeries.id}/archivos`;
    const imageBaseUrl = `/dicom/series/${studyId}/${firstSeries.id}/archivos`;
    loadImagesFromUrl(filesUrl, imageBaseUrl, firstSeries);
  }
}

/**
 * Inicializador global expuesto a la vista EJS
 */
window.initDicomViewer = async function(studyId, serverSeries) {
  await initializeVisor();

  // Botones de herramientas
  const btnWwwc = document.getElementById('btnWwwc');
  const btnZoom = document.getElementById('btnZoom');
  const btnPan = document.getElementById('btnPan');
  const btnLength = document.getElementById('btnLength');

  if (btnWwwc) btnWwwc.addEventListener('click', () => setLeftClickTool(WindowLevelTool.toolName));
  if (btnZoom) btnZoom.addEventListener('click', () => setLeftClickTool(ZoomTool.toolName));
  if (btnPan) btnPan.addEventListener('click', () => setLeftClickTool(PanTool.toolName));
  if (btnLength) btnLength.addEventListener('click', () => setLeftClickTool(LengthTool.toolName));

  // Botón Descargar JPG
  const btnDownloadJpg = document.getElementById('btnDownloadJpg');
  if (btnDownloadJpg) {
    btnDownloadJpg.addEventListener('click', () => {
      const element = document.getElementById('dicomImage');
      const canvas = element ? element.querySelector('canvas') : null;
      if (!canvas) {
        alert('No hay una imagen lista para descargar.');
        return;
      }
      const imageIndex = (currentStack && currentStack.currentImageIdIndex !== undefined) ? (currentStack.currentImageIdIndex + 1) : 1;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `estudio_${studyId}_imagen_${imageIndex}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // Carga inicial según modo (Series o Legacy)
  if (serverSeries && serverSeries.length > 0) {
    renderSeriesList(serverSeries, studyId);
  } else {
    const seriesListContainer = document.getElementById('seriesListContainer');
    if (seriesListContainer) seriesListContainer.style.display = 'none';
    const filesUrl = `/dicom/archivos/${studyId}`;
    const imageBaseUrl = `/dicom/archivos/${studyId}`;
    loadImagesFromUrl(filesUrl, imageBaseUrl, null);
  }
};
